import { describe, expect, it } from 'vitest';
import type { RoomUpdate, RoomView, GameView, CardId } from '@ace/shared';
import { createGameStore } from '../src/state/store';
import type { ClientAck, Transport, TransportListeners } from '../src/net/transport';
import type { KeyValueStore } from '../src/lib/storage';

class FakeTransport implements Transport {
  listeners!: TransportListeners;
  sent: { event: string; payload: unknown }[] = [];
  replies: Record<string, ClientAck<Record<string, unknown>>> = {};
  connected = false;
  connect(listeners: TransportListeners) {
    this.listeners = listeners;
  }
  async send(event: string, payload: unknown) {
    this.sent.push({ event, payload });
    return (this.replies[event] ?? { ok: true }) as never;
  }
}

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

function update(
  version: number,
  game: Partial<GameView> | null,
  extra: Partial<RoomView> = {},
): RoomUpdate {
  const fullGame: GameView | null = game
    ? {
        you: 'me',
        hand: [],
        playable: [],
        canGiveUp: false,
        players: [],
        table: [],
        ledSuit: null,
        turn: 'me',
        leader: 'me',
        roundNo: 1,
        discardedCount: 0,
        placings: [],
        loser: null,
        result: null,
        starter: 'me',
        jokerId: null,
        jokerAces: [],
        ...game,
      }
    : null;
  return {
    version,
    events: [],
    room: {
      code: 'ABCDEF',
      you: 'me',
      hostId: 'me',
      phase: game ? 'playing' : 'lobby',
      players: [],
      names: { me: 'Me', b: 'Bob' },
      game: fullGame,
      history: [],
      canStart: false,
      minPlayers: 3,
      maxPlayers: 7,
      ...extra,
    },
  };
}

describe('client store', () => {
  it('stores the session after creating a room and resumes it on reconnect', async () => {
    const t = new FakeTransport();
    const storage = memoryStore();
    t.replies['room:create'] = {
      ok: true,
      roomCode: 'ABCDEF',
      playerId: 'me',
      token: 't'.repeat(22),
    };
    const store = createGameStore(t, storage);
    expect(await store.getState().createRoom('Me')).toBe(true);
    expect(store.getState().session).toEqual({
      roomCode: 'ABCDEF',
      playerId: 'me',
      token: 't'.repeat(22),
    });

    // A new page load with the same storage resumes automatically once connected.
    const t2 = new FakeTransport();
    const reloaded = createGameStore(t2, storage);
    expect(reloaded.getState().session?.playerId).toBe('me');
    t2.listeners.onConnect();
    await Promise.resolve();
    expect(t2.sent[0]).toEqual({ event: 'room:resume', payload: { token: 't'.repeat(22) } });
  });

  it('forgets a session the server no longer knows', async () => {
    const t = new FakeTransport();
    const storage = memoryStore();
    storage.setItem(
      'ace-donkey.session',
      JSON.stringify({ roomCode: 'ABCDEF', playerId: 'me', token: 'x'.repeat(22) }),
    );
    t.replies['room:resume'] = { ok: false, error: { code: 'SESSION_NOT_FOUND', message: 'gone' } };
    const store = createGameStore(t, storage);
    t.listeners.onConnect();
    await new Promise((r) => setTimeout(r, 0));
    expect(store.getState().session).toBeNull();
    expect(storage.data.size).toBe(0);
  });

  it('shows server errors from acks', async () => {
    const t = new FakeTransport();
    t.replies['room:join'] = {
      ok: false,
      error: { code: 'ROOM_FULL', message: 'This room is full' },
    };
    const store = createGameStore(t, memoryStore());
    expect(await store.getState().joinRoom('ABCDEF', 'Me')).toBe(false);
    expect(store.getState().error).toBe('This room is full');
  });

  it('ignores stale updates and keeps the player’s card arrangement within a game', () => {
    const t = new FakeTransport();
    const store = createGameStore(t, memoryStore());
    t.listeners.onUpdate(update(1, { hand: ['2C', 'KS', 'QH'] as CardId[] }));
    store.getState().sortHand();
    expect(store.getState().handOrder).toEqual(['KS', 'QH', '2C']);
    t.listeners.onUpdate(update(3, { hand: ['2C', 'QH', '9D', 'KS'] as CardId[] }));
    expect(store.getState().handOrder).toEqual(['KS', 'QH', '2C', '9D']);
    t.listeners.onUpdate(update(2, { hand: [] }));
    expect(store.getState().update?.version).toBe(3);
  });

  it('checks turn and suit locally, and sends plays with unique action ids', async () => {
    const t = new FakeTransport();
    const store = createGameStore(t, memoryStore());
    t.listeners.onUpdate(
      update(1, { hand: ['2C', 'QH'] as CardId[], playable: ['QH'] as CardId[], turn: 'b' }),
    );
    expect(await store.getState().playCard('QH' as CardId)).toBe(false);
    expect(store.getState().error).toBe('It is not your turn yet.');

    t.listeners.onUpdate(
      update(2, { hand: ['2C', 'QH'] as CardId[], playable: ['QH'] as CardId[], turn: 'me' }),
    );
    expect(await store.getState().playCard('2C' as CardId)).toBe(false);
    expect(store.getState().error).toBe('You must follow the suit that was led.');

    store.getState().select('QH' as CardId);
    expect(await store.getState().playSelected()).toBe(true);
    await store.getState().playCard('QH' as CardId);
    const plays = t.sent.filter((s) => s.event === 'game:play') as {
      payload: { card: string; actionId: string };
    }[];
    expect(plays).toHaveLength(2);
    expect(plays[0]!.payload.card).toBe('QH');
    expect(plays[0]!.payload.actionId).not.toBe(plays[1]!.payload.actionId);
  });

  it('moves the highlight with the keyboard and clears it when the card leaves the hand', () => {
    const t = new FakeTransport();
    const store = createGameStore(t, memoryStore());
    t.listeners.onUpdate(update(1, { hand: ['2C', 'QH', 'KS'] as CardId[] }));
    store.getState().moveSelection(1);
    expect(store.getState().selected).toBe('2C');
    store.getState().moveSelection(1);
    expect(store.getState().selected).toBe('QH');
    t.listeners.onUpdate(update(2, { hand: ['2C', 'KS'] as CardId[] }));
    expect(store.getState().selected).toBeNull();
  });

  it('clears everything when the server ends the session', () => {
    const t = new FakeTransport();
    const store = createGameStore(t, memoryStore());
    t.listeners.onUpdate(update(1, null));
    t.listeners.onSessionEnded('replaced');
    expect(store.getState().update).toBeNull();
    expect(store.getState().notice).toMatch(/another tab/);
  });
});
