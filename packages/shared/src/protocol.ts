/**
 * Socket.IO contract shared by server and client. Client → server payloads are validated with zod
 * on the server; server → client payloads are plain typed objects.
 */
import { z } from 'zod';
import { type CardId, isCardId } from './engine/cards';
import type { GameRecord } from './engine/session';
import type { EngineErrorCode, GameEvent, PlayerId } from './engine/types';
import type { GameView } from './engine/projection';
import { MAX_PLAYERS, MIN_PLAYERS } from './engine/game';

export const ROOM_CODE_LENGTH = 6;
/** No 0/O/1/I to avoid misreading codes aloud. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const NAME_MAX_LENGTH = 20;
export const DEFAULT_DISCONNECT_GRACE_MS = 60_000;
export { MAX_PLAYERS, MIN_PLAYERS };

// ---------------------------------------------------------------------------------------------
// Client → server payload schemas
// ---------------------------------------------------------------------------------------------

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a name')
  .max(NAME_MAX_LENGTH, `Names are at most ${NAME_MAX_LENGTH} characters`);

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(ROOM_CODE_LENGTH, `Room codes are ${ROOM_CODE_LENGTH} characters`)
  .regex(new RegExp(`^[${ROOM_CODE_ALPHABET}]+$`), 'Invalid room code');

const cardSchema = z.custom<CardId>((v) => isCardId(v), 'Invalid card');
const actionIdSchema = z.string().min(1).max(64);

export const clientSchemas = {
  'room:create': z.object({ name: displayNameSchema }),
  'room:join': z.object({ code: roomCodeSchema, name: displayNameSchema }),
  'room:resume': z.object({ token: z.string().min(16).max(128) }),
  'room:leave': z.object({}),
  'game:start': z.object({}),
  'game:play': z.object({ card: cardSchema, actionId: actionIdSchema }),
  'game:giveUp': z.object({ actionId: actionIdSchema }),
  'state:sync': z.object({}),
} as const;

export type ClientEventName = keyof typeof clientSchemas;
export type ClientPayload<E extends ClientEventName> = z.input<(typeof clientSchemas)[E]>;

// ---------------------------------------------------------------------------------------------
// Acknowledgements
// ---------------------------------------------------------------------------------------------

export type ServerErrorCode =
  | EngineErrorCode
  | 'BAD_REQUEST'
  | 'RATE_LIMITED'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'NAME_TAKEN'
  | 'SESSION_NOT_FOUND'
  | 'NOT_IN_ROOM'
  | 'ALREADY_IN_ROOM'
  | 'NOT_HOST'
  | 'NOT_ENOUGH_PLAYERS'
  | 'GAME_IN_PROGRESS'
  | 'NO_GAME';

export interface AckError {
  code: ServerErrorCode;
  message: string;
}

export type Ack<T = object> = ({ ok: true } & T) | { ok: false; error: AckError };

/** Returned by create / join / resume: who you are in the room and the token to resume with. */
export interface JoinedPayload {
  roomCode: string;
  playerId: PlayerId;
  token: string;
}

// ---------------------------------------------------------------------------------------------
// Server → client payloads
// ---------------------------------------------------------------------------------------------

export type RoomPhase = 'lobby' | 'playing' | 'gameOver';

export interface RoomPlayerView {
  id: PlayerId;
  name: string;
  isHost: boolean;
  connected: boolean;
  /** Epoch ms when a disconnected player's seat is released (R15); null when connected. */
  disconnectDeadline: number | null;
  /** Seated in the current/last game. */
  inGame: boolean;
  score: number;
  streak: number;
  /** Receives Aces in the next game (R2). */
  isJoker: boolean;
}

export interface RoomView {
  code: string;
  you: PlayerId;
  hostId: PlayerId;
  phase: RoomPhase;
  players: RoomPlayerView[];
  /** Names for every id that ever sat in this room (players who left still appear in history). */
  names: Record<PlayerId, string>;
  game: GameView | null;
  history: GameRecord[];
  canStart: boolean;
  minPlayers: number;
  maxPlayers: number;
}

export interface RoomUpdate {
  /** Increments on every change; clients ignore updates older than what they have. */
  version: number;
  room: RoomView;
  /** What just happened (for messages/animations). Never contains private hand data. */
  events: GameEvent[];
}

export type SessionEndReason = 'left' | 'replaced' | 'roomClosed';

// ---------------------------------------------------------------------------------------------
// Typed Socket.IO event maps
// ---------------------------------------------------------------------------------------------

type Handler<P, R> = (payload: P, ack: (response: Ack<R>) => void) => void;

export interface ClientToServerEvents {
  'room:create': Handler<ClientPayload<'room:create'>, JoinedPayload>;
  'room:join': Handler<ClientPayload<'room:join'>, JoinedPayload>;
  'room:resume': Handler<ClientPayload<'room:resume'>, JoinedPayload>;
  'room:leave': Handler<ClientPayload<'room:leave'>, object>;
  'game:start': Handler<ClientPayload<'game:start'>, object>;
  'game:play': Handler<ClientPayload<'game:play'>, object>;
  'game:giveUp': Handler<ClientPayload<'game:giveUp'>, object>;
  'state:sync': Handler<ClientPayload<'state:sync'>, object>;
}

export interface ServerToClientEvents {
  'room:update': (update: RoomUpdate) => void;
  /** This socket no longer represents a player (left, opened in another tab, or room closed). */
  'session:ended': (payload: { reason: SessionEndReason }) => void;
}
