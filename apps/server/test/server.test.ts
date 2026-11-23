import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR } from '@ace/shared';
import { loadConfig } from '../src/config';
import { Bot, playOut, roomOf, startServer, synced, waitFor, type TestServer } from './harness';

let server: TestServer;
let bots: Bot[] = [];

beforeEach(async () => {
  server = await startServer({ graceMs: 300 });
});

afterEach(async () => {
  for (const b of bots) b.close();
  bots = [];
  await server.close();
});

describe('health', () => {
  it('responds on /health', async () => {
    const res = await fetch(`${server.url}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });
});

describe('rooms', () => {
  it('creates a room with a 6-character code and makes the creator host', async () => {
    bots = [new Bot(server.url)];
    const joined = await bots[0]!.create('Ann');
    expect(joined.roomCode).toMatch(/^[A-Z2-9]{6}$/);
    expect(joined.token.length).toBeGreaterThanOrEqual(16);
    await waitFor(() => bots[0]!.latest !== null);
    expect(bots[0]!.room.hostId).toBe(joined.playerId);
    expect(bots[0]!.room.phase).toBe('lobby');
  });

  it('validates input and reports clear errors', async () => {
    bots = [new Bot(server.url), new Bot(server.url)];
    const { roomCode } = await bots[0]!.create('Ann');
    expect(await bots[1]!.emit('room:join', { code: 'ZZZZZZ', name: 'Bob' })).toMatchObject({
      ok: false,
      error: { code: 'ROOM_NOT_FOUND' },
    });
    expect(await bots[1]!.emit('room:join', { code: roomCode, name: '' })).toMatchObject({
      ok: false,
      error: { code: 'BAD_REQUEST' },
    });
    expect(await bots[1]!.emit('room:join', { code: roomCode, name: 'ann' })).toMatchObject({
      ok: false,
      error: { code: 'NAME_TAKEN' },
    });
    expect(await bots[1]!.emit('game:play', { card: 'AS', actionId: 'x' })).toMatchObject({
      ok: false,
      error: { code: 'NOT_IN_ROOM' },
    });
    // Codes are case-insensitive.
    expect(
      await bots[1]!.emit('room:join', { code: roomCode.toLowerCase(), name: 'Bob' }),
    ).toMatchObject({ ok: true });
    expect(await bots[1]!.emit('room:create', { name: 'Again' })).toMatchObject({
      ok: false,
      error: { code: 'ALREADY_IN_ROOM' },
    });
  });

  it('R19: allows at most 7 players', async () => {
    bots = await roomOf(7, server);
    const eighth = new Bot(server.url);
    bots.push(eighth);
    expect(
      await eighth.emit('room:join', { code: bots[0]!.joined!.roomCode, name: 'Late' }),
    ).toMatchObject({
      ok: false,
      error: { code: 'ROOM_FULL' },
    });
  });

  it('only the host can start, and only with 3+ connected players', async () => {
    bots = await roomOf(2, server);
    expect(await bots[0]!.emit('game:start', {})).toMatchObject({
      ok: false,
      error: { code: 'NOT_ENOUGH_PLAYERS' },
    });
    const third = new Bot(server.url);
    bots.push(third);
    await third.join(bots[0]!.joined!.roomCode, 'Cat');
    expect(await bots[1]!.emit('game:start', {})).toMatchObject({
      ok: false,
      error: { code: 'NOT_HOST' },
    });
    await synced(bots, server);
    expect(bots[0]!.room.canStart).toBe(true);
    expect(bots[1]!.room.canStart).toBe(false);
    expect(await bots[0]!.emit('game:start', {})).toMatchObject({ ok: true });
    expect(await bots[0]!.emit('game:start', {})).toMatchObject({
      ok: false,
      error: { code: 'GAME_IN_PROGRESS' },
    });
  });

  it('R20: host passes on when the host leaves', async () => {
    bots = await roomOf(3, server);
    const second = bots[1]!.joined!.playerId;
    expect(await bots[0]!.emit('room:leave', {})).toMatchObject({ ok: true });
    await waitFor(() => bots[1]!.room.hostId === second, 3000, 'host migration');
    expect(bots[0]!.ended).toBe('left');
  });
});

describe('playing', () => {
  it('plays a full game: everyone sees the same table and only their own hand', async () => {
    bots = await roomOf(4, server);
    await bots[0]!.emit('game:start', {});
    await synced(bots, server);

    for (const b of bots) {
      const g = b.game;
      expect(g.you).toBe(b.room.you);
      expect(g.hand).toHaveLength(13);
      // Hands are private: no bot can see another bot's cards.
      for (const other of bots) {
        if (other === b) continue;
        for (const card of other.game.hand)
          expect(JSON.stringify(b.latest)).not.toContain(`"${card}"`);
      }
    }

    // Wrong turn and illegal cards are rejected by the server.
    const starter = bots[0]!.game.turn;
    const notStarter = bots.find((b) => b.room.you !== starter)!;
    expect(
      await notStarter.emit('game:play', { card: notStarter.game.hand[0]!, actionId: 'a' }),
    ).toMatchObject({
      ok: false,
      error: { code: 'NOT_YOUR_TURN' },
    });

    await playOut(bots, server);
    await synced(bots, server);
    const views = bots.map((b) => b.latest!.room);
    for (const v of views) {
      expect(v.phase).toBe('gameOver');
      expect(v.game!.result).toEqual(views[0]!.game!.result);
      expect(v.history).toHaveLength(1);
    }
    const result = views[0]!.game!.result!;
    const totalPoints = Object.values(result.points).reduce((a, b) => a + b, 0);
    expect(totalPoints).toBeGreaterThan(0);
  });

  it('R2/R3: after a loss the next game gives the Joker the A♠ and they start', async () => {
    bots = await roomOf(3, server);
    await bots[0]!.emit('game:start', {});
    await playOut(bots, server);
    await synced(bots, server);
    const loser = bots[0]!.game.loser;
    if (!loser) return; // rare draw: no Joker (covered by engine tests)
    expect(bots[0]!.room.players.find((p) => p.id === loser)!.isJoker).toBe(true);
    await bots[0]!.emit('game:start', {});
    await synced(bots, server);
    const jokerBot = bots.find((b) => b.room.you === loser)!;
    expect(jokerBot.game.hand).toContain('AS');
    expect(jokerBot.game.turn).toBe(loser);
    expect(jokerBot.game.jokerAces).toEqual(['AS']);
  });

  it('R5a: a cut stays on the table for everyone until the picker takes the cards', async () => {
    bots = await roomOf(3, server);
    await bots[0]!.emit('game:start', {});
    // Play until somebody cuts (practically every game has one).
    for (let i = 0; i < 500 && !bots[0]!.game.pendingCut; i++) {
      await synced(bots, server);
      if (bots[0]!.game.pendingCut || bots[0]!.game.result) break;
      const mover = bots.find((b) => b.room.you === b.game.turn)!;
      const card = mover.game.playable[0]!;
      await mover.emit('game:play', { card, actionId: `c${i}` });
    }
    await synced(bots, server);
    const pending = bots[0]!.game.pendingCut;
    expect(pending).not.toBeNull();
    const { pickerId } = pending!;
    const tableSize = bots[0]!.game.table.length;
    expect(tableSize).toBeGreaterThanOrEqual(2);
    for (const b of bots) {
      expect(b.game.table).toHaveLength(tableSize);
      expect(b.game.turn).toBe(pickerId);
      expect(b.game.mustTake).toBe(b.room.you === pickerId);
      expect(b.game.playable).toEqual([]);
    }
    const picker = bots.find((b) => b.room.you === pickerId)!;
    const other = bots.find((b) => b.room.you !== pickerId)!;
    expect(await other.emit('game:take', { actionId: 'no' })).toMatchObject({
      ok: false,
      error: { code: 'NOTHING_TO_TAKE' },
    });
    expect(
      await picker.emit('game:play', { card: picker.game.hand[0]!, actionId: 'p' }),
    ).toMatchObject({ ok: false, error: { code: 'TAKE_CARDS_FIRST' } });
    const handBefore = picker.game.hand.length;
    expect(await picker.emit('game:take', { actionId: 'take' })).toMatchObject({ ok: true });
    await synced(bots, server);
    expect(bots[0]!.game.pendingCut).toBeNull();
    expect(bots[0]!.game.table).toEqual([]);
    expect(picker.game.hand).toHaveLength(handBefore + tableSize);
    expect(bots[0]!.game.turn).toBe(pickerId);
  });

  it('ignores a retried action with the same actionId', async () => {
    bots = await roomOf(3, server);
    await bots[0]!.emit('game:start', {});
    await synced(bots, server);
    const mover = bots.find((b) => b.room.you === b.game.turn)!;
    const card = mover.game.playable[0]!;
    expect(await mover.emit('game:play', { card, actionId: 'same' })).toMatchObject({ ok: true });
    expect(await mover.emit('game:play', { card, actionId: 'same' })).toMatchObject({ ok: true });
    await synced(bots, server);
    expect(mover.game.table).toHaveLength(1);
  });

  it('rejects malformed card ids', async () => {
    bots = await roomOf(3, server);
    await bots[0]!.emit('game:start', {});
    expect(await bots[0]!.emit('game:play', { card: 'XX' as never, actionId: 'a' })).toMatchObject({
      ok: false,
      error: { code: 'BAD_REQUEST' },
    });
  });

  it('rate-limits floods of events', async () => {
    const limited = await startServer({ rateLimit: loadConfig({}).rateLimit });
    const bot = new Bot(limited.url);
    try {
      await bot.create('Ann');
      const acks = await Promise.all(Array.from({ length: 40 }, () => bot.emit('state:sync', {})));
      expect(acks.some((a) => !a.ok && a.error.code === 'RATE_LIMITED')).toBe(true);
      expect(acks.filter((a) => a.ok).length).toBeGreaterThanOrEqual(15);
    } finally {
      bot.close();
      await limited.close();
    }
  });
});

describe('disconnects (R15–R18)', () => {
  it('R15: a player who reconnects within the grace period resumes with the same seat and hand', async () => {
    bots = await roomOf(3, server);
    await bots[0]!.emit('game:start', {});
    await synced(bots, server);
    const leaving = bots[2]!;
    const { token, playerId } = leaving.joined!;
    const hand = leaving.game.hand;
    leaving.close();
    await waitFor(() => bots[0]!.room.players.find((p) => p.id === playerId)!.connected === false);
    expect(
      bots[0]!.room.players.find((p) => p.id === playerId)!.disconnectDeadline,
    ).toBeGreaterThan(Date.now());

    const back = new Bot(server.url);
    bots.push(back);
    expect(await back.emit('room:resume', { token })).toMatchObject({ ok: true, playerId });
    await waitFor(
      () => back.latest !== null && back.room.players.find((p) => p.id === playerId)!.connected,
    );
    expect(back.game.hand).toEqual(hand);
    expect(back.game.players.find((p) => p.id === playerId)!.status).toBe('active');
  });

  it('R16: after the grace period the player is removed and their cards are redistributed', async () => {
    bots = await roomOf(4, server);
    await bots[0]!.emit('game:start', {});
    await synced(bots, server);
    const gone = bots[3]!;
    const goneId = gone.joined!.playerId;
    const before = bots[0]!.game.players
      .filter((p) => p.id !== goneId)
      .reduce((a, p) => a + p.cardCount, 0);
    gone.close();
    await waitFor(
      () => bots[0]!.game.players.find((p) => p.id === goneId)!.status === 'removed',
      3000,
      'removal',
    );
    const after = bots[0]!.game.players
      .filter((p) => p.id !== goneId)
      .reduce((a, p) => a + p.cardCount, 0);
    expect(after).toBe(before + 13);
    expect(bots[0]!.latest!.events).toContainEqual(
      expect.objectContaining({ type: 'playerRemoved', playerId: goneId }),
    );
    // The game continues to the end with the remaining players.
    await playOut(bots.slice(0, 3), server);
  });

  it('R15: rejoining with the same name within the grace period takes the seat back', async () => {
    bots = await roomOf(3, server);
    await bots[0]!.emit('game:start', {});
    await synced(bots, server);
    const leaving = bots[2]!;
    const { playerId, roomCode } = leaving.joined!;
    const hand = leaving.game.hand;
    leaving.close();
    await waitFor(() => bots[0]!.room.players.find((p) => p.id === playerId)!.connected === false);

    // A fresh browser (no stored token) opens the invite link and types the same name.
    const back = new Bot(server.url);
    bots.push(back);
    const ack = await back.emit('room:join', { code: roomCode, name: 'bot3' });
    expect(ack).toMatchObject({ ok: true, playerId });
    await waitFor(
      () => back.latest !== null && back.room.players.find((p) => p.id === playerId)!.connected,
    );
    expect(back.game.hand).toEqual(hand);
    expect(back.room.players).toHaveLength(3);
    // The new token works for later reconnects.
    expect(
      await new Bot(server.url).emit('room:resume', {
        token: (ack as unknown as { token: string }).token,
      }),
    ).toMatchObject({ ok: true });
  });

  it('a connected player’s name still cannot be taken', async () => {
    bots = await roomOf(3, server);
    const other = new Bot(server.url);
    bots.push(other);
    expect(
      await other.emit('room:join', { code: bots[0]!.joined!.roomCode, name: 'Bot2' }),
    ).toMatchObject({
      ok: false,
      error: { code: 'NAME_TAKEN' },
    });
  });

  it('after the grace period the player is gone from the room; coming back makes a new player', async () => {
    bots = await roomOf(4, server);
    await bots[0]!.emit('game:start', {});
    await synced(bots, server);
    const gone = bots[3]!;
    const { token, playerId, roomCode } = gone.joined!;
    gone.close();
    await waitFor(
      () => !bots[0]!.room.players.some((p) => p.id === playerId),
      3000,
      'removal from room',
    );
    // Removed from the game too (cards redistributed) and no longer shown in the lobby list.
    expect(bots[0]!.game.players.find((p) => p.id === playerId)!.status).toBe('removed');
    expect(bots[0]!.room.players).toHaveLength(3);
    // The old session is over…
    const back = new Bot(server.url);
    bots.push(back);
    expect(await back.emit('room:resume', { token })).toMatchObject({
      ok: false,
      error: { code: 'SESSION_NOT_FOUND' },
    });
    // …and joining again with the same name is a brand-new player waiting for the next game.
    const ack = await back.emit('room:join', { code: roomCode, name: 'Bot4' });
    expect(ack.ok).toBe(true);
    expect((ack as unknown as { playerId: string }).playerId).not.toBe(playerId);
    await waitFor(() => back.latest !== null);
    expect(back.game.you).toBeNull();
  });

  it('a player who times out in the lobby is removed, and their score and streak are forgotten', async () => {
    bots = await roomOf(3, server);
    await bots[0]!.emit('game:start', {});
    await playOut(bots, server);
    await synced(bots, server);
    const loserId = bots[0]!.game.loser;
    if (!loserId) return; // rare draw
    const loserBot = bots.find((b) => b.room.you === loserId)!;
    expect(bots[0]!.room.players.find((p) => p.id === loserId)!.isJoker).toBe(true);
    const observer = bots.find((b) => b !== loserBot)!;
    loserBot.close();
    await waitFor(() => !observer.room.players.some((p) => p.id === loserId), 3000, 'removal');
    expect(observer.room.players.some((p) => p.isJoker)).toBe(false);
  });

  it('opening the same session in a new tab ends the old socket', async () => {
    bots = await roomOf(3, server);
    const old = bots[1]!;
    const tab = new Bot(server.url);
    bots.push(tab);
    expect(await tab.emit('room:resume', { token: old.joined!.token })).toMatchObject({ ok: true });
    await waitFor(() => old.ended === 'replaced');
  });

  it('rejects an unknown token', async () => {
    bots = [new Bot(server.url)];
    expect(await bots[0]!.emit('room:resume', { token: 'x'.repeat(22) })).toMatchObject({
      ok: false,
      error: { code: 'SESSION_NOT_FOUND' },
    });
  });
});

describe('seating order (R22)', () => {
  const ids = (b: Bot) => b.room.players.map((p) => p.id);

  it('lets only the host reorder, host stays on top, and only between games', async () => {
    bots = await roomOf(4, server);
    const [host, b, c, d] = bots.map((x) => x.joined!.playerId);
    expect(ids(bots[0]!)).toEqual([host, b, c, d]);

    expect(await bots[1]!.emit('room:reorder', { order: [host!, d!, c!, b!] })).toMatchObject({
      ok: false,
      error: { code: 'NOT_HOST' },
    });
    expect(await bots[0]!.emit('room:reorder', { order: [d!, host!, c!, b!] })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_ORDER' },
    });
    expect(await bots[0]!.emit('room:reorder', { order: [host!, d!, c!] })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_ORDER' },
    });
    expect(await bots[0]!.emit('room:reorder', { order: [host!, d!, c!, b!] })).toMatchObject({
      ok: true,
    });
    await synced(bots, server);
    for (const bot of bots) expect(ids(bot)).toEqual([host, d, c, b]);

    await bots[0]!.emit('game:start', {});
    await synced(bots, server);
    // The game seats follow the lobby order.
    expect(bots[0]!.game.players.map((p) => p.id)).toEqual([host, d, c, b]);
    expect(await bots[0]!.emit('room:reorder', { order: [host!, b!, c!, d!] })).toMatchObject({
      ok: false,
      error: { code: 'GAME_IN_PROGRESS' },
    });
  });

  it('the host deals the first game: extra cards go to the players right below the host', async () => {
    bots = await roomOf(5, server);
    await bots[0]!.emit('game:start', {});
    await synced(bots, server);
    // 52 cards / 5 players = 10 each + 2 extra for seats 2 and 3.
    expect(bots[0]!.game.players.map((p) => p.cardCount)).toEqual([10, 11, 11, 10, 10]);
  });

  it('a new host moves to the top when the host leaves', async () => {
    bots = await roomOf(3, server);
    const second = bots[1]!.joined!.playerId;
    const third = bots[2]!.joined!.playerId;
    await bots[0]!.emit('room:reorder', { order: [bots[0]!.joined!.playerId, third, second] });
    await synced(bots, server);
    await bots[0]!.emit('room:leave', {});
    await waitFor(() => bots[1]!.room.players.length === 2);
    expect(ids(bots[1]!)).toEqual([third, second]);
    expect(bots[1]!.room.hostId).toBe(third);
  });
});

describe('avatars (R25)', () => {
  it('uses the avatar sent on join, lets players change it, and rejects invalid ones', async () => {
    bots = [new Bot(server.url), new Bot(server.url)];
    const created = await bots[0]!.emit('room:create', {
      name: 'Ann',
      avatar: { face: 4, glasses: 3, mouth: 0 },
    });
    expect(created.ok).toBe(true);
    const code = (created as unknown as { roomCode: string }).roomCode;
    await bots[1]!.join(code, 'Bob'); // no avatar → default
    await waitFor(() => bots[0]!.latest?.room.players.length === 2);
    expect(bots[0]!.room.players.map((p) => p.avatar)).toEqual([
      { face: 4, glasses: 3, mouth: 0 },
      DEFAULT_AVATAR,
    ]);
    expect(
      await bots[1]!.emit('player:avatar', { avatar: { face: 0, glasses: 2, mouth: 2 } }),
    ).toMatchObject({ ok: true });
    await waitFor(() => bots[0]!.room.players[1]!.avatar.glasses === 2);
    expect(
      await bots[1]!.emit('player:avatar', { avatar: { face: 6, glasses: 0, mouth: 0 } }),
    ).toMatchObject({
      ok: false,
      error: { code: 'BAD_REQUEST' },
    });
  });
});

describe('host controls (R23)', () => {
  it('host can remove a player; they are told and can rejoin as a new player', async () => {
    bots = await roomOf(4, server);
    const target = bots[2]!;
    const { playerId, roomCode, token } = target.joined!;
    expect(await bots[1]!.emit('room:kick', { playerId })).toMatchObject({
      ok: false,
      error: { code: 'NOT_HOST' },
    });
    expect(await bots[0]!.emit('room:kick', { playerId: bots[0]!.joined!.playerId })).toMatchObject(
      {
        ok: false,
        error: { code: 'BAD_REQUEST' },
      },
    );
    expect(await bots[0]!.emit('room:kick', { playerId })).toMatchObject({ ok: true });
    await waitFor(() => target.ended === 'kicked');
    await waitFor(() => !bots[0]!.room.players.some((p) => p.id === playerId));
    expect(await new Bot(server.url).emit('room:resume', { token })).toMatchObject({ ok: false });
    const again = new Bot(server.url);
    bots.push(again);
    const ack = await again.emit('room:join', { code: roomCode, name: 'Bot3' });
    expect(ack.ok && (ack as unknown as { playerId: string }).playerId !== playerId).toBe(true);
  });

  it('removing a player mid-game takes them out of the game too', async () => {
    bots = await roomOf(4, server);
    await bots[0]!.emit('game:start', {});
    await synced(bots, server);
    const playerId = bots[3]!.joined!.playerId;
    expect(await bots[0]!.emit('room:kick', { playerId })).toMatchObject({ ok: true });
    await waitFor(() => bots[0]!.game.players.find((p) => p.id === playerId)!.status === 'removed');
  });

  it('host can hand over the host role; the new host moves to the top', async () => {
    bots = await roomOf(3, server);
    const third = bots[2]!.joined!.playerId;
    expect(await bots[1]!.emit('room:setHost', { playerId: third })).toMatchObject({
      ok: false,
      error: { code: 'NOT_HOST' },
    });
    expect(await bots[0]!.emit('room:setHost', { playerId: third })).toMatchObject({ ok: true });
    await synced(bots, server);
    expect(bots[0]!.room.hostId).toBe(third);
    expect(bots[0]!.room.players[0]!.id).toBe(third);
    expect(bots[2]!.room.canStart).toBe(true);
    expect(bots[0]!.room.canStart).toBe(false);
  });
});

describe('chat (R24)', () => {
  it('broadcasts messages to the room and sends recent history to newcomers', async () => {
    bots = await roomOf(3, server);
    expect(await bots[0]!.emit('chat:send', { text: '  hello  ' })).toMatchObject({ ok: true });
    expect(await bots[1]!.emit('chat:send', { text: 'hi!' })).toMatchObject({ ok: true });
    await waitFor(() => bots.every((b) => b.chat.length === 2));
    expect(bots[2]!.chat.map((m) => [m.name, m.text])).toEqual([
      ['Bot1', 'hello'],
      ['Bot2', 'hi!'],
    ]);
    expect(await bots[0]!.emit('chat:send', { text: '   ' })).toMatchObject({
      ok: false,
      error: { code: 'BAD_REQUEST' },
    });
    expect(await bots[0]!.emit('chat:send', { text: 'x'.repeat(301) })).toMatchObject({
      ok: false,
    });

    const late = new Bot(server.url);
    bots.push(late);
    await late.join(bots[0]!.joined!.roomCode, 'Late');
    await waitFor(() => late.chat.length === 2);
  });

  it('keeps only the most recent messages', async () => {
    bots = await roomOf(3, server);
    for (let i = 0; i < 105; i++) await bots[0]!.emit('chat:send', { text: `m${i}` });
    const late = new Bot(server.url);
    bots.push(late);
    await late.join(bots[0]!.joined!.roomCode, 'Late');
    await waitFor(() => late.chat.length === 100);
    expect(late.chat[0]!.text).toBe('m5');
  });
});
