import { describe, expect, it } from 'vitest';
import { applyAction, computePoints, createGameFromHands, type GameState } from '../src';
import fixture from './fixtures/draw-3p.json';
import { playAll, stateWith } from './helpers';

const play = (s: GameState, playerId: string, card: string) =>
  applyAction(s, { type: 'play', playerId, card: card as never });

describe('R4 follow suit', () => {
  const s = stateWith({ P1: ['5H', '2C'], P2: ['KH', '3S'], P3: ['4S', '9D'] });

  it('the leader may lead any card', () => {
    expect(play(s, 'P1', '2C').ok).toBe(true);
  });

  it('a player holding the led suit must follow it', () => {
    const led = playAll(s, [['P1', '5H']]).state;
    const r = play(led, 'P2', '3S');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('MUST_FOLLOW_SUIT');
  });

  it('rejects out-of-turn plays and cards not in hand', () => {
    const r1 = play(s, 'P2', 'KH');
    expect(!r1.ok && r1.error.code).toBe('NOT_YOUR_TURN');
    const r2 = play(s, 'P1', 'AS');
    expect(!r2.ok && r2.error.code).toBe('CARD_NOT_IN_HAND');
    const r3 = play(s, 'P1', 'ZZ');
    expect(!r3.ok && r3.error.code).toBe('INVALID_CARD');
    const r4 = play(s, 'P9', '5H');
    expect(!r4.ok && r4.error.code).toBe('NOT_IN_GAME');
  });

  it('never mutates the input state', () => {
    const before = structuredClone(s);
    play(s, 'P1', '5H');
    expect(s).toEqual(before);
  });
});

describe('R5 cut', () => {
  it('ends the round at once; highest led-suit card picks up everything and leads', () => {
    const s = stateWith({
      P1: ['5H', '2C'],
      P2: ['KH', '3C'],
      P3: ['4S', '9D'],
      P4: ['QH', '8C'],
    });
    const { state, events } = playAll(s, [
      ['P1', '5H'],
      ['P2', 'KH'],
      ['P3', '4S'],
    ]);
    expect(state.table).toEqual([]);
    expect(state.hands.P2).toEqual(['3C', '5H', 'KH', '4S']);
    expect(state.hands.P4).toEqual(['QH', '8C']); // P4 never got to play
    expect(state.turn).toBe('P2');
    expect(state.roundNo).toBe(2);
    expect(events).toContainEqual({
      type: 'roundCut',
      cutBy: 'P3',
      pickedUpBy: 'P2',
      cards: ['5H', 'KH', '4S'],
      nextLeader: 'P2',
    });
  });

  it('R7: a player who emptied their hand earlier in a cut round finishes; the picker does not', () => {
    const s = stateWith({ P1: ['5H'], P2: ['KH'], P3: ['4S', '9D'], P4: ['2C', '3C'] });
    const { state, events } = playAll(s, [
      ['P1', '5H'],
      ['P2', 'KH'],
      ['P3', '4S'],
    ]);
    expect(state.status.P1).toBe('finished');
    expect(state.status.P2).toBe('active');
    expect(state.hands.P2).toHaveLength(3);
    expect(events).toContainEqual({ type: 'playersFinished', playerIds: ['P1'], place: 1 });
  });
});

describe('R5a take cards', () => {
  // P1 leads 5H, P2 follows KH, P3 cuts with 4S: P2 has to take.
  const s = stateWith({ P1: ['5H', '2C'], P2: ['KH', '3C'], P3: ['4S', '9D'], P4: ['6H', '7C'] });
  const cut = playAll(
    s,
    [
      ['P1', '5H'],
      ['P2', 'KH'],
      ['P3', '4S'],
    ],
    { take: false },
  );

  it('keeps every card on the table until the picker takes them', () => {
    expect(cut.state.table.map((t) => t.card)).toEqual(['5H', 'KH', '4S']);
    expect(cut.state.pendingCut).toEqual({ cutBy: 'P3', pickerId: 'P2' });
    expect(cut.state.turn).toBe('P2');
    expect(cut.events.at(-1)).toEqual({ type: 'cutPending', cutBy: 'P3', pickerId: 'P2' });
    expect(cut.events.some((e) => e.type === 'roundCut')).toBe(false);
  });

  it('lets nobody play until then, and only the picker can take', () => {
    for (const [id, card] of [
      ['P4', '6H'],
      ['P2', '3C'],
    ] as const) {
      const r = play(cut.state, id, card);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('TAKE_CARDS_FIRST');
    }
    const wrong = applyAction(cut.state, { type: 'take', playerId: 'P1' });
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.error.code).toBe('NOTHING_TO_TAKE');
    const none = applyAction(s, { type: 'take', playerId: 'P1' });
    expect(none.ok).toBe(false);
  });

  it('taking resolves the cut: the picker picks up and leads', () => {
    const r = applyAction(cut.state, { type: 'take', playerId: 'P2' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.pendingCut).toBeNull();
    expect(r.state.table).toEqual([]);
    expect(r.state.hands.P2).toEqual(['3C', '5H', 'KH', '4S']);
    expect(r.state.turn).toBe('P2');
    expect(r.state.roundNo).toBe(2);
    expect(r.events[0]).toMatchObject({ type: 'roundCut', pickedUpBy: 'P2', nextLeader: 'P2' });
  });

  it('a cutter who played their last card only finishes once the cards are taken', () => {
    const last = stateWith({ P1: ['5H', '2C'], P2: ['KH', '3C'], P3: ['4S'], P4: ['6H', '7C'] });
    const waiting = playAll(
      last,
      [
        ['P1', '5H'],
        ['P2', 'KH'],
        ['P3', '4S'],
      ],
      { take: false },
    ).state;
    expect(waiting.status.P3).toBe('active');
    const r = applyAction(waiting, { type: 'take', playerId: 'P2' });
    expect(r.ok && r.state.status.P3).toBe('finished');
  });

  it('E2: if the picker is removed, the next-highest led-suit player still in takes', () => {
    const r = applyAction(cut.state, { type: 'remove', playerId: 'P2' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.pendingCut).toEqual({ cutBy: 'P3', pickerId: 'P1' });
    expect(r.state.turn).toBe('P1');
    expect(r.state.table).toHaveLength(3);
  });

  it('E2: with no led-suit player left, the cut cards are discarded and the cutter leads', () => {
    const three = stateWith({ P1: ['5H', '2C'], P2: ['3S', '3C'], P3: ['9D', '8D'] });
    const waiting = playAll(
      three,
      [
        ['P1', '5H'],
        ['P2', '3S'],
      ],
      { take: false },
    ).state;
    expect(waiting.pendingCut).toEqual({ cutBy: 'P2', pickerId: 'P1' });
    const r = applyAction(waiting, { type: 'remove', playerId: 'P1' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.pendingCut).toBeNull();
    expect(r.state.discarded).toEqual(['5H', '3S']);
    expect(r.state.turn).toBe('P2');
  });

  it('a removal of someone else keeps the cut waiting for the same picker', () => {
    const r = applyAction(cut.state, { type: 'remove', playerId: 'P4' });
    expect(r.ok && r.state.pendingCut).toEqual({ cutBy: 'P3', pickerId: 'P2' });
  });
});

describe('R6 fold', () => {
  it('discards when everyone follows; the highest card leads', () => {
    const s = stateWith({ P1: ['5H', '2C'], P2: ['KH', '3C'], P3: ['9H', '4D'] });
    const { state } = playAll(s, [
      ['P1', '5H'],
      ['P2', 'KH'],
      ['P3', '9H'],
    ]);
    expect(state.discarded).toEqual(['5H', 'KH', '9H']);
    expect(state.turn).toBe('P2');
  });

  it('if the highest card has run out, the next-highest card leads', () => {
    const f = stateWith({ P1: ['5H', '2C'], P2: ['KH'], P3: ['9H', '4D'], P4: ['3H', '8C'] });
    const folded = playAll(f, [
      ['P1', '5H'],
      ['P2', 'KH'],
      ['P3', '9H'],
      ['P4', '3H'],
    ]).state;
    expect(folded.status.P2).toBe('finished');
    expect(folded.turn).toBe('P3');
  });
});

describe('R7–R10 finishing, ties, points and the loser', () => {
  it('R9: players finishing on the same round share a placing group', () => {
    const s = stateWith({ P1: ['5H'], P2: ['KH'], P3: ['9H', '2C'], P4: ['3H', '3C'] });
    const { state, events } = playAll(s, [
      ['P1', '5H'],
      ['P2', 'KH'],
      ['P3', '9H'],
      ['P4', '3H'],
    ]);
    expect(state.placings).toEqual([['P1', 'P2']]);
    expect(events).toContainEqual({ type: 'playersFinished', playerIds: ['P1', 'P2'], place: 1 });
    expect(state.turn).toBe('P3');
  });

  it('R10: the last player holding cards is the loser', () => {
    const s = stateWith({ P1: ['5H'], P2: ['KH', '2C', '4C'], P3: ['9H', '3C'] });
    const { state } = playAll(s, [
      ['P1', '5H'],
      ['P2', 'KH'],
      ['P3', '9H'],
      ['P2', '2C'],
      ['P3', '3C'],
    ]);
    expect(state.placings).toEqual([['P1'], ['P3']]);
    expect(state.loser).toBe('P2');
    expect(state.result).toEqual({
      outcome: 'normal',
      reason: 'lastPlayer',
      points: { P1: 2, P2: 0, P3: 1 },
    });
    expect(state.turn).toBeNull();
  });

  it('R8 + R9: points follow the placings with ties taking the higher score', () => {
    const five = ['a', 'b', 'c', 'd', 'e'];
    expect(computePoints(five, [['a', 'b'], ['c'], ['d']], 'e')).toEqual({
      a: 4,
      b: 4,
      c: 2,
      d: 1,
      e: 0,
    });
    const six = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(computePoints(six, [['a'], ['b', 'c', 'd'], ['e']], 'f')).toEqual({
      a: 5,
      b: 4,
      c: 4,
      d: 4,
      e: 1,
      f: 0,
    });
    // R12 draws: last two → 1 each, last three → 2 each
    expect(computePoints(['a', 'b', 'c'], [['a'], ['b', 'c']], null)).toEqual({ a: 2, b: 1, c: 1 });
    expect(computePoints(five, [['a'], ['b'], ['c', 'd', 'e']], null)).toEqual({
      a: 4,
      b: 3,
      c: 2,
      d: 2,
      e: 2,
    });
    // R17: removed players score 0 and do not count toward N
    expect(computePoints(['a', 'b', 'c', 'x'], [['a'], ['b']], 'c')).toEqual({
      a: 2,
      b: 1,
      c: 0,
      x: 0,
    });
  });
});

describe('R11 give up', () => {
  it('is only allowed when exactly two players remain', () => {
    const s = stateWith({ P1: ['5H'], P2: ['KH'], P3: ['9H'] });
    const r = applyAction(s, { type: 'giveUp', playerId: 'P1' });
    expect(!r.ok && r.error.code).toBe('GIVE_UP_NOT_ALLOWED');
  });

  it('makes the giver the loser and the other player takes the last winning place', () => {
    const s = stateWith(
      { P1: [], P2: ['KH', '2C'], P3: ['9H', '3C'] },
      { status: { P1: 'finished', P2: 'active', P3: 'active' }, placings: [['P1']], turn: 'P2' },
    );
    const r = applyAction(s, { type: 'giveUp', playerId: 'P3' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.loser).toBe('P3');
    expect(r.state.placings).toEqual([['P1'], ['P2']]);
    expect(r.state.result).toEqual({
      outcome: 'normal',
      reason: 'giveUp',
      points: { P1: 2, P2: 1, P3: 0 },
    });
    // Nothing further is allowed once the game is over.
    const after = applyAction(r.state, { type: 'play', playerId: 'P2', card: 'KH' });
    expect(!after.ok && after.error.code).toBe('GAME_OVER');
  });
});

describe('R12 draw', () => {
  it('replays the simulated 3-player game from the trace and ends in a draw on round 25', () => {
    const game = createGameFromHands(fixture.seats, fixture.hands as never);
    expect(game.starter).toBe('P1');
    const { state } = playAll(game, fixture.moves as [string, never][]);
    expect(state.roundNo).toBe(25);
    expect(state.loser).toBeNull();
    expect(state.placings).toEqual([['P2'], ['P3', 'P1']]);
    expect(state.result).toEqual({
      outcome: 'draw',
      reason: 'draw',
      points: { P1: 1, P2: 2, P3: 1 },
    });
  });

  it('works for a 3-way draw too (everyone left gets the same points)', () => {
    const s = stateWith({ P1: ['5H'], P2: ['KH'], P3: ['9H'] });
    const { state } = playAll(s, [
      ['P1', '5H'],
      ['P2', 'KH'],
      ['P3', '9H'],
    ]);
    expect(state.result).toEqual({
      outcome: 'draw',
      reason: 'draw',
      points: { P1: 2, P2: 2, P3: 2 },
    });
  });
});

describe('R16–R18 removal', () => {
  it('R16: deals the removed hand round-robin starting with the next seat', () => {
    const s = stateWith(
      { P1: ['2C', '3C'], P2: ['4C', '5C', '6C', '7C', '8C'], P3: ['2D'], P4: ['3D'] },
      { turn: 'P1', leader: 'P1' },
    );
    const r = applyAction(s, { type: 'remove', playerId: 'P2' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.status.P2).toBe('removed');
    expect(r.state.hands.P2).toEqual([]);
    expect(r.state.hands.P3).toEqual(['2D', '4C', '7C']);
    expect(r.state.hands.P4).toEqual(['3D', '5C', '8C']);
    expect(r.state.hands.P1).toEqual(['2C', '3C', '6C']);
    expect(r.events).toContainEqual({
      type: 'playerRemoved',
      playerId: 'P2',
      cardsReceived: { P3: 2, P4: 2, P1: 1 },
    });
    expect(r.state.turn).toBe('P1');
  });

  it('R16: if it was their turn to lead, the next seat leads', () => {
    const s = stateWith(
      { P1: ['2C'], P2: ['4C'], P3: ['2D'], P4: ['3D'] },
      { turn: 'P2', leader: 'P2' },
    );
    const r = applyAction(s, { type: 'remove', playerId: 'P2' });
    expect(r.ok && r.state.turn).toBe('P3');
    expect(r.ok && r.state.leader).toBe('P3');
  });

  it('R16: mid-round, their played card stays and the turn passes on', () => {
    const s = stateWith({ P1: ['5H', '2C'], P2: ['KH', '3C'], P3: ['9H', '4D'], P4: ['3H', '7S'] });
    const led = playAll(s, [['P1', '5H']]).state;
    const r = applyAction(led, { type: 'remove', playerId: 'P2' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.table).toEqual([{ playerId: 'P1', card: '5H' }]);
    expect(r.state.turn).toBe('P3');
  });

  it('E3: if everyone remaining has now played, the round folds immediately', () => {
    const s = stateWith({ P1: ['5H', '2C'], P2: ['KH', '3C'], P3: ['9H', '4D'], P4: ['3H', '7S'] });
    const played = playAll(s, [
      ['P1', '5H'],
      ['P2', 'KH'],
      ['P3', '9H'],
    ]).state;
    const r = applyAction(played, { type: 'remove', playerId: 'P4' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.discarded).toEqual(['5H', 'KH', '9H']);
    expect(r.state.turn).toBe('P2');
  });

  it('E2: a removed player cannot pick up; with no other led-suit card the table is discarded', () => {
    const s = stateWith({
      P1: ['5H', '7S', '8S', '9S'],
      P2: ['2C', '3C'],
      P3: ['2D', '3D'],
      P4: ['4D', '5D'],
    });
    const led = playAll(s, [['P1', '5H']]).state;
    const removed = applyAction(led, { type: 'remove', playerId: 'P1' });
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    const r = applyAction(removed.state, { type: 'play', playerId: 'P2', card: '2C' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.discarded).toEqual(['5H', '2C']);
    expect(r.events).toContainEqual(
      expect.objectContaining({ type: 'roundCut', pickedUpBy: null, nextLeader: 'P2' }),
    );
  });

  it('R18: removal that leaves one player makes the removed player the loser', () => {
    const s = stateWith(
      { P1: [], P2: ['KH', '2C'], P3: ['9H', '3C'] },
      { status: { P1: 'finished', P2: 'active', P3: 'active' }, placings: [['P1']], turn: 'P2' },
    );
    const r = applyAction(s, { type: 'remove', playerId: 'P2' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.loser).toBe('P2');
    expect(r.state.placings).toEqual([['P1'], ['P3']]);
    expect(r.state.result).toEqual({
      outcome: 'normal',
      reason: 'removal',
      points: { P1: 2, P2: 0, P3: 1 },
    });
  });

  it('only active players can be removed', () => {
    const s = stateWith(
      { P1: [], P2: ['2C'], P3: ['3C'], P4: ['4C'] },
      { status: { P1: 'finished', P2: 'active', P3: 'active', P4: 'active' } },
    );
    const r = applyAction(s, { type: 'remove', playerId: 'P1' });
    expect(!r.ok && r.error.code).toBe('NOT_ACTIVE');
  });
});

describe('event order', () => {
  it('reports the round result before who finished', () => {
    const s = stateWith({ P1: ['5H'], P2: ['KH', '2C'], P3: ['9H', '3C'] });
    const { events } = playAll(s, [
      ['P1', '5H'],
      ['P2', 'KH'],
      ['P3', '9H'],
    ]);
    expect(events.map((e) => e.type)).toEqual([
      'cardPlayed',
      'cardPlayed',
      'cardPlayed',
      'roundFolded',
      'playersFinished',
    ]);
  });
});
