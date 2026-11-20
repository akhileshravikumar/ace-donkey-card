// @vitest-environment node
/**
 * End to end without a browser: three real client stores (with the real socket transport) play
 * against the real server.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { StoreApi } from 'zustand/vanilla';
import { createApp, type App } from '../../server/src/app';
import { nullAuditSink } from '../../server/src/audit';
import { loadConfig } from '../../server/src/config';
import { createLogger } from '../../server/src/logger';
import { createSocketTransport } from '../src/net/transport';
import { createGameStore, type GameStore } from '../src/state/store';
import type { KeyValueStore } from '../src/lib/storage';

let app: App;
let url: string;

beforeAll(async () => {
  app = createApp({
    config: { ...loadConfig({}), rateLimit: { burst: 10_000, perSecond: 10_000 } },
    logger: createLogger('silent'),
    audit: nullAuditSink,
  });
  url = `http://localhost:${await app.listen(0)}`;
});

afterAll(() => app.close());

const memory = (): KeyValueStore => {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
};

async function until(check: () => boolean, label: string, ms = 4000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error(`timed out: ${label}`);
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe('client ↔ server', () => {
  it('three players create, join, play a whole game and see the same result', async () => {
    const stores: StoreApi<GameStore>[] = Array.from({ length: 3 }, () =>
      createGameStore(createSocketTransport(url), memory()),
    );
    await until(() => stores.every((s) => s.getState().connection === 'connected'), 'connect');

    expect(await stores[0]!.getState().createRoom('Ann')).toBe(true);
    const code = stores[0]!.getState().session!.roomCode;
    expect(await stores[1]!.getState().joinRoom(code, 'Bob')).toBe(true);
    expect(await stores[2]!.getState().joinRoom(code, 'Cat')).toBe(true);
    await until(() => stores.every((s) => s.getState().update?.room.players.length === 3), 'lobby');
    expect(stores[0]!.getState().update!.room.canStart).toBe(true);

    await stores[0]!.getState().startGame();
    await until(() => stores.every((s) => s.getState().update?.room.phase === 'playing'), 'start');
    for (const s of stores) {
      expect(s.getState().handOrder.length).toBeGreaterThanOrEqual(17);
      s.getState().sortHand();
    }

    for (let moves = 0; moves < 2000; moves++) {
      const version = Math.max(...stores.map((s) => s.getState().update!.version));
      await until(() => stores.every((s) => s.getState().update!.version === version), 'sync');
      const game = stores[0]!.getState().update!.room.game!;
      if (game.result) break;
      const mover = stores.find((s) => s.getState().session!.playerId === game.turn)!;
      const playable = mover.getState().update!.room.game!.playable;
      expect(await mover.getState().playCard(playable[0]!)).toBe(true);
      await until(() => mover.getState().update!.version > version, 'ack');
    }

    const results = stores.map((s) => s.getState().update!.room.game!.result);
    expect(results[0]).not.toBeNull();
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
    expect(stores[0]!.getState().log.at(-1)).toMatch(/^Game over/);
    expect(stores.every((s) => s.getState().update!.room.history.length === 1)).toBe(true);
  }, 30_000);
});
