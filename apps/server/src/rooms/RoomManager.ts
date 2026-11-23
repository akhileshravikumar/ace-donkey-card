/** Owns all rooms and the token → player index used for reconnecting. */
import type { AckError, Avatar, GameEvent, JoinedPayload, PlayerId } from '@ace/shared';
import type { AuditSink } from '../audit';
import { hashToken, newPlayerId, newRoomCode, newToken } from '../security';
import type { Rng } from '@ace/shared';
import { Room } from './Room';

export interface ManagerDeps {
  rng: Rng;
  audit: AuditSink;
  graceMs: number;
  roomIdleMs: number;
  now?: () => number;
  onRoomChange: (room: Room, events: GameEvent[]) => void;
  onRoomClosed?: (room: Room) => void;
}

type JoinResult = ({ ok: true; room: Room } & JoinedPayload) | { ok: false; error: AckError };

const fail = (code: AckError['code'], message: string): JoinResult => ({
  ok: false,
  error: { code, message },
});

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  /** tokenHash → where that player lives. */
  private readonly tokens = new Map<string, { code: string; playerId: PlayerId }>();
  private readonly now: () => number;

  constructor(private readonly deps: ManagerDeps) {
    this.now = deps.now ?? Date.now;
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  create(name: string, socketId: string, avatar?: Avatar): JoinResult {
    let code = newRoomCode();
    while (this.rooms.has(code)) code = newRoomCode();
    const room = new Room(code, {
      rng: this.deps.rng,
      audit: this.deps.audit,
      graceMs: this.deps.graceMs,
      now: this.now,
      onChange: (r, events) => this.deps.onRoomChange(r, events),
      onPlayerGone: (r, player) => {
        this.tokens.delete(player.tokenHash);
        if (r.players.length === 0) this.close(r);
      },
    });
    this.rooms.set(code, room);
    return this.addTo(room, name, socketId, avatar);
  }

  join(code: string, name: string, socketId: string, avatar?: Avatar): JoinResult {
    const room = this.rooms.get(code);
    if (!room) return fail('ROOM_NOT_FOUND', 'No room with that code');
    const existing = room.findByName(name);
    if (existing) {
      // R15: the same name within the grace period takes the disconnected player's seat back.
      if (room.canReclaim(existing))
        return this.reclaim(room, existing.id, existing.tokenHash, socketId);
      return fail('NAME_TAKEN', 'Someone in this room already uses that name');
    }
    if (room.isFull()) return fail('ROOM_FULL', 'This room is full');
    return this.addTo(room, name, socketId, avatar);
  }

  private reclaim(
    room: Room,
    playerId: PlayerId,
    oldTokenHash: string,
    socketId: string,
  ): JoinResult {
    const token = newToken();
    const tokenHash = hashToken(token);
    this.tokens.delete(oldTokenHash);
    this.tokens.set(tokenHash, { code: room.code, playerId });
    room.reclaim(playerId, tokenHash, socketId);
    return { ok: true, room, roomCode: room.code, playerId, token };
  }

  private addTo(room: Room, name: string, socketId: string, avatar?: Avatar): JoinResult {
    const token = newToken();
    const tokenHash = hashToken(token);
    const playerId = newPlayerId();
    room.addPlayer({ id: playerId, name, tokenHash, socketId, ...(avatar ? { avatar } : {}) });
    this.tokens.set(tokenHash, { code: room.code, playerId });
    return { ok: true, room, roomCode: room.code, playerId, token };
  }

  /** R15: reconnect with a stored token. Returns the previous socket id so it can be told it was replaced. */
  resume(token: string, socketId: string): JoinResult & { previousSocketId?: string | null } {
    const entry = this.tokens.get(hashToken(token));
    const room = entry && this.rooms.get(entry.code);
    const player = entry && room?.getPlayer(entry.playerId);
    if (!entry || !room || !player) return fail('SESSION_NOT_FOUND', 'That game session has ended');
    const previousSocketId = player.socketId;
    room.attach(player.id, socketId);
    return { ok: true, room, roomCode: room.code, playerId: player.id, token, previousSocketId };
  }

  leave(code: string, playerId: PlayerId): void {
    const room = this.rooms.get(code);
    const player = room?.getPlayer(playerId);
    if (!room || !player) return;
    this.tokens.delete(player.tokenHash);
    room.leave(playerId);
    if (room.players.length === 0) this.close(room);
  }

  /** R23: host removes a player. Returns the removed player's socket so it can be told. */
  kick(
    code: string,
    by: PlayerId,
    target: PlayerId,
  ): { ok: true; socketId: string | null } | { ok: false; error: AckError } {
    const room = this.rooms.get(code);
    if (!room)
      return { ok: false, error: { code: 'ROOM_NOT_FOUND', message: 'No room with that code' } };
    const result = room.kick(by, target);
    if (!result.ok) return result;
    this.tokens.delete(result.player.tokenHash);
    return { ok: true, socketId: result.player.socketId };
  }

  disconnect(code: string, playerId: PlayerId, socketId: string): void {
    this.rooms.get(code)?.detach(playerId, socketId);
  }

  /** Delete rooms nobody has been connected to for roomIdleMs. */
  sweep(): number {
    let closed = 0;
    for (const room of this.rooms.values()) {
      const idle =
        room.connectedPlayers.length === 0 && this.now() - room.lastActivity > this.deps.roomIdleMs;
      if (idle || room.players.length === 0) {
        this.close(room);
        closed++;
      }
    }
    return closed;
  }

  private close(room: Room): void {
    room.dispose();
    for (const p of room.players) this.tokens.delete(p.tokenHash);
    this.rooms.delete(room.code);
    this.deps.onRoomClosed?.(room);
  }

  closeAll(): void {
    for (const room of [...this.rooms.values()]) this.close(room);
  }
}
