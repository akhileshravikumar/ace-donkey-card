import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

  it('a removed player can resume and is still in the room for the next game', async () => {
    bots = await roomOf(4, server);
    await bots[0]!.emit('game:start', {});
    await synced(bots, server);
    const gone = bots[3]!;
    const { token, playerId } = gone.joined!;
    gone.close();
    await waitFor(() => bots[0]!.game.players.find((p) => p.id === playerId)!.status === 'removed');
    const back = new Bot(server.url);
    bots.push(back);
    expect(await back.emit('room:resume', { token })).toMatchObject({ ok: true, playerId });
    await waitFor(() => back.latest !== null);
    expect(back.game.hand).toEqual([]);
    expect(back.game.players.find((p) => p.id === playerId)!.status).toBe('removed');
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
