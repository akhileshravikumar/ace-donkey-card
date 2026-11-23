/**
 * Thin, typed wrapper over socket.io-client. The store depends on the Transport interface only,
 * so tests can swap in a fake.
 */
import { io, type Socket } from 'socket.io-client';
import type {
  Ack,
  ChatMessage,
  ClientToServerEvents,
  ServerToClientEvents,
  RoomUpdate,
  SessionEndReason,
} from '@ace/shared';
import { ACK_TIMEOUT_MS } from '../config';

export type ClientAck<T = object> =
  Ack<T> | { ok: false; error: { code: 'TIMEOUT'; message: string } };

type PayloadOf<E extends keyof ClientToServerEvents> = Parameters<ClientToServerEvents[E]>[0];
type AckDataOf<E extends keyof ClientToServerEvents> =
  Parameters<Parameters<ClientToServerEvents[E]>[1]>[0] extends Ack<infer T> ? T : never;

export interface TransportListeners {
  onConnect(): void;
  onDisconnect(): void;
  onUpdate(update: RoomUpdate): void;
  onSessionEnded(reason: SessionEndReason): void;
  onChatMessage(message: ChatMessage): void;
  onChatHistory(messages: ChatMessage[]): void;
}

export interface Transport {
  connect(listeners: TransportListeners): void;
  send<E extends keyof ClientToServerEvents>(
    event: E,
    payload: PayloadOf<E>,
  ): Promise<ClientAck<AckDataOf<E>>>;
  readonly connected: boolean;
}

export function createSocketTransport(url: string): Transport {
  let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  return {
    get connected() {
      return socket?.connected ?? false;
    },
    connect(listeners) {
      socket = io(url, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 500,
        reconnectionDelayMax: 4000,
      });
      socket.on('connect', listeners.onConnect);
      socket.on('disconnect', listeners.onDisconnect);
      socket.on('room:update', listeners.onUpdate);
      socket.on('session:ended', ({ reason }) => listeners.onSessionEnded(reason));
      socket.on('chat:message', listeners.onChatMessage);
      socket.on('chat:history', listeners.onChatHistory);
    },
    async send(event, payload) {
      if (!socket) throw new Error('Transport not connected');
      try {
        // socket.io's typed emitWithAck can't express our generic event map; the shape is checked by
        // ClientToServerEvents at the call site.
        const emitter = socket.timeout(ACK_TIMEOUT_MS) as unknown as {
          emitWithAck(e: string, p: unknown): Promise<unknown>;
        };
        return (await emitter.emitWithAck(event, payload)) as never;
      } catch {
        return {
          ok: false,
          error: { code: 'TIMEOUT', message: 'The server did not respond. Check your connection.' },
        };
      }
    },
  };
}
