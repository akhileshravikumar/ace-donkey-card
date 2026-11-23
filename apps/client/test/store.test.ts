import { describe, expect, it } from 'vitest';
import {
  CHAT_HISTORY,
  type RoomUpdate,
  type RoomView,
  type GameView,
  type CardId,
} from '@ace/shared';
import { createGameStore } from '../src/state/store';
import { FakeTransport, gameView, memoryStore } from './helpers';

function update(
  version: number,
  game: Partial<GameView> | null,
  extra: Partial<RoomView> = {},
): RoomUpdate {
  const fullGame: GameView | null = game ? gameView(game) : null;
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
    expect(storage.data.has('ace-donkey.session')).toBe(false);
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

  it('sends the host’s new seating order', async () => {
    const t = new FakeTransport();
    const store = createGameStore(t, memoryStore());
    expect(await store.getState().reorderPlayers(['me', 'c', 'b'])).toBe(true);
    expect(t.sent.at(-1)).toEqual({ event: 'room:reorder', payload: { order: ['me', 'c', 'b'] } });
    t.replies['room:reorder'] = {
      ok: false,
      error: { code: 'NOT_HOST', message: 'Only the host can change the order' },
    };
    expect(await store.getState().reorderPlayers(['me', 'b', 'c'])).toBe(false);
    expect(store.getState().error).toBe('Only the host can change the order');
  });

  it('clears everything when the server ends the session', () => {
    const t = new FakeTransport();
    const store = createGameStore(t, memoryStore());
    t.listeners.onUpdate(update(1, null));
    t.listeners.onSessionEnded('replaced');
    expect(store.getState().update).toBeNull();
    expect(store.getState().notice).toMatch(/another tab/);
  });

  it('keeps the avatar between visits and sends it when creating or joining', async () => {
    const storage = memoryStore();
    const t = new FakeTransport();
    const store = createGameStore(t, storage);
    const avatar = store.getState().avatar;
    expect(JSON.parse(storage.getItem('ace-donkey.avatar')!)).toEqual(avatar);
    expect(createGameStore(new FakeTransport(), storage).getState().avatar).toEqual(avatar);

    await store.getState().joinRoom('ABCDEF', 'Me');
    expect(t.sent.at(-1)).toEqual({
      event: 'room:join',
      payload: { code: 'ABCDEF', name: 'Me', avatar },
    });
    await store.getState().createRoom('Me');
    expect(t.sent.at(-1)).toEqual({ event: 'room:create', payload: { name: 'Me', avatar } });
  });

  it('sends the host controls (R23)', async () => {
    const t = new FakeTransport();
    const store = createGameStore(t, memoryStore());
    await store.getState().kickPlayer('b');
    await store.getState().setHost('b');
    expect(t.sent.map((s) => s.event)).toEqual(['room:kick', 'room:setHost']);
    expect(t.sent[0]!.payload).toEqual({ playerId: 'b' });
  });

  it('keeps the room chat: history, new messages without duplicates, last 100 only', async () => {
    const t = new FakeTransport();
    const store = createGameStore(t, memoryStore());
    const msg = (id: number) => ({
      id,
      playerId: 'b',
      name: 'Bob',
      text: `m${id}`,
      at: id,
    });
    t.listeners.onChatHistory([msg(1), msg(2)]);
    t.listeners.onChatMessage(msg(2));
    t.listeners.onChatMessage(msg(3));
    expect(store.getState().chat.map((m) => m.id)).toEqual([1, 2, 3]);
    for (let i = 4; i <= CHAT_HISTORY + 10; i++) t.listeners.onChatMessage(msg(i));
    expect(store.getState().chat).toHaveLength(CHAT_HISTORY);
    expect(store.getState().chat.at(-1)!.id).toBe(CHAT_HISTORY + 10);

    expect(await store.getState().sendChat('   ')).toBe(false);
    expect(await store.getState().sendChat('hi')).toBe(true);
    expect(t.sent.at(-1)).toEqual({ event: 'chat:send', payload: { text: 'hi' } });
  });

  it('closes the results for this game only with Back to lobby', () => {
    const t = new FakeTransport();
    const store = createGameStore(t, memoryStore());
    const history = [{ gameNo: 1 }] as unknown as RoomView['history'];
    t.listeners.onUpdate(update(1, {}, { phase: 'gameOver', history }));
    expect(store.getState().resultsClosedFor).toBeNull();
    store.getState().backToLobby();
    expect(store.getState().resultsClosedFor).toBe(1);
  });

  it('explains being removed by the host and clears the chat', () => {
    const t = new FakeTransport();
    const store = createGameStore(t, memoryStore());
    t.listeners.onUpdate(update(1, null));
    t.listeners.onChatMessage({ id: 1, playerId: 'b', name: 'Bob', text: 'hi', at: 1 });
    t.listeners.onSessionEnded('kicked');
    expect(store.getState().notice).toBe('The host removed you from the room.');
    expect(store.getState().chat).toEqual([]);
    expect(store.getState().update).toBeNull();
  });

  it('won’t play over a cut that is waiting to be taken (R5a)', async () => {
    const t = new FakeTransport();
    const store = createGameStore(t, memoryStore());
    const pendingCut = { cutBy: 'b', pickerId: 'me' };
    t.listeners.onUpdate(update(1, { hand: ['2C'], pendingCut, mustTake: true }));
    expect(await store.getState().playCard('2C')).toBe(false);
    expect(store.getState().error).toBe('Take the cards first.');
    t.listeners.onUpdate(update(2, { hand: ['2C'], pendingCut, mustTake: false, turn: 'b' }));
    expect(await store.getState().playCard('2C')).toBe(false);
    expect(store.getState().error).toBe('Wait for the cut cards to be taken.');
    expect(await store.getState().takeCards()).toBe(true);
    expect(t.sent.at(-1)!.event).toBe('game:take');
    expect(t.sentEvents('game:play')).toEqual([]);
  });
});
