/** Wires Socket.IO events to the RoomManager: validation, rate limiting, acks and broadcasting. */
import {
  type Ack,
  type ClientEventName,
  type ClientToServerEvents,
  type GameEvent,
  type ServerToClientEvents,
  clientSchemas,
} from '@ace/shared';
import type { Server, Socket } from 'socket.io';
import type { z } from 'zod';
import type { Logger } from './logger';
import type { Room } from './rooms/Room';
import type { RoomManager } from './rooms/RoomManager';
import { RateLimiter } from './security';

interface SocketData {
  roomCode?: string;
  playerId?: string;
  limiter: RateLimiter;
}

export type AceServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
type AceSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

/** Send every connected player in the room their own projected view. */
export function broadcastRoom(io: AceServer, room: Room, events: GameEvent[]): void {
  const version = room.bumpVersion();
  for (const p of room.players) {
    if (p.socketId)
      io.to(p.socketId).emit('room:update', { version, room: room.view(p.id), events });
  }
}

export function registerHandlers(
  io: AceServer,
  manager: RoomManager,
  logger: Logger,
  rateLimit: { burst: number; perSecond: number },
): void {
  io.on('connection', (socket: AceSocket) => {
    socket.data.limiter = new RateLimiter(rateLimit.burst, rateLimit.perSecond);
    const log = logger.child({ socket: socket.id });

    /** Common wrapper: rate limit → validate → run → ack. */
    function on<E extends ClientEventName>(
      event: E,
      run: (data: z.output<(typeof clientSchemas)[E]>) => Ack<object>,
    ): void {
      socket.on(
        event as never,
        ((payload: unknown, ack: unknown) => {
          const reply = typeof ack === 'function' ? (ack as (r: Ack<object>) => void) : () => {};
          if (!socket.data.limiter.take()) {
            reply({ ok: false, error: { code: 'RATE_LIMITED', message: 'Slow down' } });
            return;
          }
          const parsed = clientSchemas[event].safeParse(payload ?? {});
          if (!parsed.success) {
            reply({
              ok: false,
              error: {
                code: 'BAD_REQUEST',
                message: parsed.error.issues[0]?.message ?? 'Invalid request',
              },
            });
            return;
          }
          try {
            reply(run(parsed.data as z.output<(typeof clientSchemas)[E]>));
          } catch (error) {
            log.error({ err: error, event }, 'handler failed');
            reply({ ok: false, error: { code: 'BAD_REQUEST', message: 'Something went wrong' } });
          }
        }) as never,
      );
    }

    const current = () => {
      const { roomCode, playerId } = socket.data;
      const room = roomCode ? manager.getRoom(roomCode) : undefined;
      return room && playerId && room.getPlayer(playerId) ? { room, playerId } : null;
    };
    const notInRoom = {
      ok: false as const,
      error: { code: 'NOT_IN_ROOM' as const, message: 'Join a room first' },
    };
    const alreadyInRoom = {
      ok: false as const,
      error: { code: 'ALREADY_IN_ROOM' as const, message: 'Leave your current room first' },
    };

    on('room:create', ({ name }) => {
      if (current()) return alreadyInRoom;
      const result = manager.create(name, socket.id);
      if (!result.ok) return result;
      socket.data.roomCode = result.roomCode;
      socket.data.playerId = result.playerId;
      log.info({ room: result.roomCode, player: result.playerId }, 'room created');
      return {
        ok: true,
        roomCode: result.roomCode,
        playerId: result.playerId,
        token: result.token,
      };
    });

    on('room:join', ({ code, name }) => {
      if (current()) return alreadyInRoom;
      const result = manager.join(code, name, socket.id);
      if (!result.ok) return result;
      socket.data.roomCode = result.roomCode;
      socket.data.playerId = result.playerId;
      log.info({ room: result.roomCode, player: result.playerId }, 'joined');
      return {
        ok: true,
        roomCode: result.roomCode,
        playerId: result.playerId,
        token: result.token,
      };
    });

    on('room:resume', ({ token }) => {
      const result = manager.resume(token, socket.id);
      if (!result.ok) return result;
      if (result.previousSocketId && result.previousSocketId !== socket.id) {
        const old = io.sockets.sockets.get(result.previousSocketId);
        if (old) {
          old.emit('session:ended', { reason: 'replaced' });
          old.data.roomCode = undefined;
          old.data.playerId = undefined;
        }
      }
      socket.data.roomCode = result.roomCode;
      socket.data.playerId = result.playerId;
      log.info({ room: result.roomCode, player: result.playerId }, 'resumed');
      return {
        ok: true,
        roomCode: result.roomCode,
        playerId: result.playerId,
        token: result.token,
      };
    });

    on('room:leave', () => {
      const ctx = current();
      if (!ctx) return notInRoom;
      manager.leave(ctx.room.code, ctx.playerId);
      socket.data.roomCode = undefined;
      socket.data.playerId = undefined;
      socket.emit('session:ended', { reason: 'left' });
      return { ok: true };
    });

    on('game:start', () => {
      const ctx = current();
      return ctx ? ctx.room.startGame(ctx.playerId) : notInRoom;
    });

    on('game:play', ({ card, actionId }) => {
      const ctx = current();
      return ctx ? ctx.room.play(ctx.playerId, card, actionId) : notInRoom;
    });

    on('game:giveUp', ({ actionId }) => {
      const ctx = current();
      return ctx ? ctx.room.giveUp(ctx.playerId, actionId) : notInRoom;
    });

    on('state:sync', () => {
      const ctx = current();
      if (!ctx) return notInRoom;
      socket.emit('room:update', {
        version: ctx.room.version,
        room: ctx.room.view(ctx.playerId),
        events: [],
      });
      return { ok: true };
    });

    socket.on('disconnect', () => {
      const { roomCode, playerId } = socket.data;
      if (roomCode && playerId) manager.disconnect(roomCode, playerId, socket.id);
    });
  });
}
