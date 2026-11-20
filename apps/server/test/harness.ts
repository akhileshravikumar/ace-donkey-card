import { io as connect, type Socket } from 'socket.io-client';
import type {
  Ack,
  ClientToServerEvents,
  JoinedPayload,
  RoomUpdate,
  ServerToClientEvents,
} from '@ace/shared';
import { createApp, type App } from '../src/app';
import { nullAuditSink } from '../src/audit';
import { loadConfig } from '../src/config';
import { createLogger } from '../src/logger';

export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface TestServer {
  app: App;
  url: string;
  close(): Promise<void>;
}

export async function startServer(
  overrides: { graceMs?: number; rateLimit?: { burst: number; perSecond: number } } = {},
): Promise<TestServer> {
  const config = {
    ...loadConfig({}),
    disconnectGraceMs: overrides.graceMs ?? 300,
    // Bots play far faster than people; the rate-limit test opts back into the defaults.
    rateLimit: overrides.rateLimit ?? { burst: 10_000, perSecond: 10_000 },
  };
  const app = createApp({ config, logger: createLogger('silent'), audit: nullAuditSink });
  const port = await app.listen(0);
  return { app, url: `http://localhost:${port}`, close: () => app.close() };
}

export class Bot {
  readonly socket: ClientSocket;
  latest: RoomUpdate | null = null;
  updates = 0;
  ended: string | null = null;
  joined: JoinedPayload | null = null;

  constructor(url: string) {
    this.socket = connect(url, { transports: ['websocket'], forceNew: true, reconnection: false });
    this.socket.on('room:update', (u) => {
      if (!this.latest || u.version >= this.latest.version) this.latest = u;
      this.updates++;
    });
    this.socket.on('session:ended', ({ reason }) => (this.ended = reason));
  }

  emit<E extends keyof ClientToServerEvents>(
    event: E,
    payload: Parameters<ClientToServerEvents[E]>[0],
  ): Promise<Ack<Record<string, unknown>>> {
    return new Promise((resolve) => {
      (this.socket.emit as (...args: unknown[]) => void)(event, payload, resolve);
    });
  }

  get room() {
    return this.latest!.room;
  }

  get game() {
    return this.latest!.room.game!;
  }

  async create(name: string) {
    const ack = await this.emit('room:create', { name });
    if (!ack.ok) throw new Error(ack.error.code);
    this.joined = ack as unknown as JoinedPayload;
    return this.joined;
  }

  async join(code: string, name: string) {
    const ack = await this.emit('room:join', { code, name });
    if (!ack.ok) throw new Error(ack.error.code);
    this.joined = ack as unknown as JoinedPayload;
    return this.joined;
  }

  close() {
    this.socket.disconnect();
  }
}

export async function waitFor(
  check: () => boolean,
  timeoutMs = 3000,
  label = 'condition',
): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 5));
  }
}

/** All bots have seen the same (latest) version. */
export async function synced(bots: Bot[], server: TestServer): Promise<void> {
  const code = bots.find((b) => b.joined)!.joined!.roomCode;
  await waitFor(
    () => {
      const version = server.app.manager.getRoom(code)?.version;
      return bots.every((b) => b.latest?.version === version);
    },
    3000,
    'bots to sync',
  );
}

export async function roomOf(n: number, server: TestServer): Promise<Bot[]> {
  const bots = Array.from({ length: n }, () => new Bot(server.url));
  const { roomCode } = await bots[0]!.create('Bot1');
  for (let i = 1; i < n; i++) await bots[i]!.join(roomCode, `Bot${i + 1}`);
  await synced(bots, server);
  return bots;
}

/** Each bot plays a random playable card on its turn until the game ends. */
export async function playOut(bots: Bot[], server: TestServer, maxMoves = 2000): Promise<void> {
  for (let i = 0; i < maxMoves; i++) {
    await synced(bots, server);
    const game = bots[0]!.game;
    if (game.result) return;
    const mover = bots.find((b) => b.room.you === game.turn)!;
    const playable = mover.game.playable;
    const card = playable[Math.floor(Math.random() * playable.length)]!;
    const ack = await mover.emit('game:play', { card, actionId: `m${i}-${Math.random()}` });
    if (!ack.ok) throw new Error(`play rejected: ${ack.error.code}`);
  }
  throw new Error('game did not finish');
}
