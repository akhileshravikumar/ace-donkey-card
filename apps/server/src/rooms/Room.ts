/**
 * One game room: its players, the room session (scores/streaks/Joker) and the current game.
 * The Room is the only place that mutates game state; every change goes through the pure engine.
 */
import {
  type AckError,
  type CardId,
  type GameAction,
  type GameEvent,
  type GameState,
  type PlayerId,
  type RoomPhase,
  type RoomView,
  type Rng,
  type SessionState,
  MAX_PLAYERS,
  MIN_PLAYERS,
  applyAction,
  createSession,
  projectGame,
  recordGame,
  startSessionGame,
} from '@ace/shared';
import type { AuditSink } from '../audit';

export interface RoomPlayer {
  id: PlayerId;
  name: string;
  tokenHash: string;
  socketId: string | null;
  connected: boolean;
  disconnectDeadline: number | null;
  disconnectTimer: ReturnType<typeof setTimeout> | null;
  /** Recent actionIds, for idempotent retries. */
  recentActions: string[];
}

export type RoomResult = { ok: true; duplicate?: boolean } | { ok: false; error: AckError };

export interface RoomDeps {
  rng: Rng;
  audit: AuditSink;
  graceMs: number;
  now?: () => number;
  /** Called after any change so the transport can broadcast fresh views. */
  onChange: (room: Room, events: GameEvent[]) => void;
}

const err = (code: AckError['code'], message: string): RoomResult => ({
  ok: false,
  error: { code, message },
});

const RECENT_ACTIONS = 50;

export class Room {
  readonly players: RoomPlayer[] = [];
  /** Every name ever seated here, so history can still show players who left. */
  readonly names: Record<PlayerId, string> = {};
  hostId: PlayerId | null = null;
  session: SessionState = createSession();
  game: GameState | null = null;
  version = 0;
  lastActivity: number;
  private readonly now: () => number;

  constructor(
    readonly code: string,
    private readonly deps: RoomDeps,
  ) {
    this.now = deps.now ?? Date.now;
    this.lastActivity = this.now();
  }

  // -------------------------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------------------------

  get phase(): RoomPhase {
    if (!this.game) return 'lobby';
    return this.game.result ? 'gameOver' : 'playing';
  }

  getPlayer(id: PlayerId): RoomPlayer | undefined {
    return this.players.find((p) => p.id === id);
  }

  get connectedPlayers(): RoomPlayer[] {
    return this.players.filter((p) => p.connected);
  }

  isFull(): boolean {
    return this.players.length >= MAX_PLAYERS && !this.findEvictable();
  }

  nameTaken(name: string): boolean {
    return this.players.some((p) => p.name.toLowerCase() === name.toLowerCase());
  }

  view(viewer: PlayerId): RoomView {
    const joker = this.session.joker?.playerId ?? null;
    return {
      code: this.code,
      you: viewer,
      hostId: this.hostId ?? '',
      phase: this.phase,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        isHost: p.id === this.hostId,
        connected: p.connected,
        disconnectDeadline: p.disconnectDeadline,
        inGame: this.game?.seats.includes(p.id) ?? false,
        score: this.session.scores[p.id] ?? 0,
        streak: this.session.streaks[p.id] ?? 0,
        isJoker: p.id === joker,
      })),
      names: { ...this.names },
      game: this.game ? projectGame(this.game, viewer) : null,
      history: this.session.history,
      canStart: viewer === this.hostId && this.startBlocker() === null,
      minPlayers: MIN_PLAYERS,
      maxPlayers: MAX_PLAYERS,
    };
  }

  /** Why the host can't start right now, or null if they can. */
  private startBlocker(): RoomResult | null {
    if (this.phase === 'playing') return err('GAME_IN_PROGRESS', 'A game is already in progress');
    const ready = this.connectedPlayers.length;
    if (ready < MIN_PLAYERS) {
      return err('NOT_ENOUGH_PLAYERS', `Need at least ${MIN_PLAYERS} connected players`);
    }
    return null;
  }

  // -------------------------------------------------------------------------------------------
  // Membership
  // -------------------------------------------------------------------------------------------

  addPlayer(player: { id: PlayerId; name: string; tokenHash: string; socketId: string }): void {
    if (this.players.length >= MAX_PLAYERS) {
      const evict = this.findEvictable();
      if (evict) this.dropFromRoom(evict);
    }
    this.players.push({
      ...player,
      connected: true,
      disconnectDeadline: null,
      disconnectTimer: null,
      recentActions: [],
    });
    this.names[player.id] = player.name;
    this.hostId ??= player.id;
    this.touch();
    this.deps.onChange(this, []);
  }

  /**
   * A player who has been disconnected past the grace period and isn't in a running game can be
   * replaced by a new joiner when the room is full (oldest first).
   */
  private findEvictable(): RoomPlayer | undefined {
    return this.players
      .filter((p) => !p.connected && p.disconnectTimer === null && !this.isActiveInGame(p.id))
      .sort((a, b) => (a.disconnectDeadline ?? 0) - (b.disconnectDeadline ?? 0))[0];
  }

  private isActiveInGame(id: PlayerId): boolean {
    return this.phase === 'playing' && this.game!.status[id] === 'active';
  }

  /** A socket (re)attached to this player. */
  attach(id: PlayerId, socketId: string): void {
    const p = this.getPlayer(id);
    if (!p) return;
    if (p.disconnectTimer) clearTimeout(p.disconnectTimer);
    p.disconnectTimer = null;
    p.disconnectDeadline = null;
    p.connected = true;
    p.socketId = socketId;
    this.hostId ??= id;
    this.touch();
    this.deps.onChange(this, []);
  }

  /** R15: hold the seat for the grace period, then remove from the game (R16–R18). */
  detach(id: PlayerId, socketId: string): void {
    const p = this.getPlayer(id);
    if (!p || p.socketId !== socketId) return;
    p.connected = false;
    p.socketId = null;
    p.disconnectDeadline = this.now() + this.deps.graceMs;
    p.disconnectTimer = setTimeout(() => this.graceExpired(id), this.deps.graceMs);
    this.touch();
    this.deps.onChange(this, []);
  }

  private graceExpired(id: PlayerId): void {
    const p = this.getPlayer(id);
    if (!p || p.connected) return;
    p.disconnectTimer = null;
    const events: GameEvent[] = [];
    if (this.isActiveInGame(id))
      events.push(...this.applyGameAction({ type: 'remove', playerId: id }, 'timeout'));
    if (this.hostId === id) this.migrateHost();
    this.deps.onChange(this, events);
  }

  /** Voluntary leave: removed from the game immediately (R16) and from the room. */
  leave(id: PlayerId): RoomResult {
    const p = this.getPlayer(id);
    if (!p) return err('NOT_IN_ROOM', 'You are not in this room');
    const events: GameEvent[] = [];
    if (this.isActiveInGame(id))
      events.push(...this.applyGameAction({ type: 'remove', playerId: id }, 'leave'));
    this.dropFromRoom(p);
    this.touch();
    this.deps.onChange(this, events);
    return { ok: true };
  }

  private dropFromRoom(p: RoomPlayer): void {
    if (p.disconnectTimer) clearTimeout(p.disconnectTimer);
    this.players.splice(this.players.indexOf(p), 1);
    if (this.hostId === p.id) this.migrateHost();
  }

  /** R20: host passes to the earliest-joined connected player (or anyone, if none connected). */
  private migrateHost(): void {
    const next =
      this.connectedPlayers.find((p) => p.id !== this.hostId) ??
      this.players.find((p) => p.id !== this.hostId);
    this.hostId = next?.id ?? null;
  }

  // -------------------------------------------------------------------------------------------
  // Game actions
  // -------------------------------------------------------------------------------------------

  startGame(by: PlayerId): RoomResult {
    if (by !== this.hostId) return err('NOT_HOST', 'Only the host can start the game');
    const blocker = this.startBlocker();
    if (blocker) return blocker;
    const seats = this.connectedPlayers.map((p) => p.id).slice(0, MAX_PLAYERS);
    this.game = startSessionGame(this.session, seats, this.deps.rng);
    this.deps.audit.action({
      room: this.code,
      gameNo: this.gameNo,
      actor: by,
      action: 'start',
      detail: { seats, jokerId: this.game.jokerId, jokerAces: this.game.jokerAces },
    });
    this.touch();
    this.deps.onChange(this, []);
    return { ok: true };
  }

  play(by: PlayerId, card: CardId, actionId: string): RoomResult {
    return this.playerAction(by, actionId, { type: 'play', playerId: by, card });
  }

  giveUp(by: PlayerId, actionId: string): RoomResult {
    return this.playerAction(by, actionId, { type: 'giveUp', playerId: by });
  }

  private playerAction(by: PlayerId, actionId: string, action: GameAction): RoomResult {
    const p = this.getPlayer(by);
    if (!p) return err('NOT_IN_ROOM', 'You are not in this room');
    if (p.recentActions.includes(actionId)) return { ok: true, duplicate: true };
    if (this.phase !== 'playing') return err('NO_GAME', 'No game is in progress');

    const result = applyAction(this.game!, action);
    if (!result.ok) return { ok: false, error: result.error };

    p.recentActions.push(actionId);
    if (p.recentActions.length > RECENT_ACTIONS) p.recentActions.shift();
    this.commit(result.state, result.events, by, action.type);
    this.touch();
    this.deps.onChange(this, result.events);
    return { ok: true };
  }

  /** For server-initiated actions (removal). Returns the events produced. */
  private applyGameAction(action: GameAction, cause: string): GameEvent[] {
    const result = applyAction(this.game!, action);
    if (!result.ok) return [];
    this.commit(result.state, result.events, action.playerId, `${action.type}:${cause}`);
    return result.events;
  }

  private commit(state: GameState, events: GameEvent[], actor: PlayerId, action: string): void {
    const gameNo = this.gameNo;
    this.game = state;
    this.deps.audit.action({ room: this.code, gameNo, actor, action });
    this.deps.audit.events({ room: this.code, gameNo, events });
    if (state.result) {
      this.session = recordGame(this.session, state);
      this.deps.audit.gameResult({ room: this.code, record: this.session.history.at(-1)! });
    }
  }

  /** Number of the current game (1-based). */
  get gameNo(): number {
    return this.session.history.length + (this.phase === 'playing' ? 1 : 0);
  }

  bumpVersion(): number {
    this.version += 1;
    return this.version;
  }

  private touch(): void {
    this.lastActivity = this.now();
  }

  /** Stop all timers (room deleted / server shutdown). */
  dispose(): void {
    for (const p of this.players) if (p.disconnectTimer) clearTimeout(p.disconnectTimer);
  }
}
