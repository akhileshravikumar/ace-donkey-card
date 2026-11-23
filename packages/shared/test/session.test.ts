import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createGameFromHands,
  createSession,
  forgetPlayer,
  recordGame,
  seededRng,
  startSessionGame,
  type GameState,
  type SessionState,
} from '../src';
import fixture from './fixtures/draw-3p.json';
import { playAll, stateWith } from './helpers';

function finishedNormal(): GameState {
  // P1 out first, P3 second, P2 loses.
  return playAll(stateWith({ P1: ['5H'], P2: ['KH', '2C', '4C'], P3: ['9H', '3C'] }), [
    ['P1', '5H'],
    ['P2', 'KH'],
    ['P3', '9H'],
    ['P2', '2C'],
    ['P3', '3C'],
  ]).state;
}

describe('session scoring, streaks and the Joker', () => {
  it('R8 + R13 + R14: adds points, increments the loser, resets everyone else', () => {
    const start: SessionState = { ...createSession(), streaks: { P1: 2, P2: 1, P3: 3 } };
    const next = recordGame(start, finishedNormal());
    expect(next.scores).toEqual({ P1: 2, P2: 0, P3: 1 });
    expect(next.streaks).toEqual({ P1: 0, P2: 2, P3: 0 });
    expect(next.joker).toEqual({ playerId: 'P2', streak: 2 });
    expect(next.history).toHaveLength(1);
    expect(next.history[0]).toMatchObject({ gameNo: 1, loser: 'P2', outcome: 'normal' });
  });

  it('R2: the next deal gives the Joker their stacked Aces', () => {
    const session = recordGame({ ...createSession(), streaks: { P2: 1 } }, finishedNormal());
    const game = startSessionGame(session, ['P1', 'P2', 'P3'], seededRng(5));
    expect(game.jokerId).toBe('P2');
    expect(game.hands.P2).toEqual(expect.arrayContaining(['AS', 'AC']));
    expect(game.starter).toBe('P2');
  });

  it('R12: a draw carries over streaks in the final group, resets others and clears the Joker', () => {
    const game = playAll(
      createGameFromHands(fixture.seats, fixture.hands as never),
      fixture.moves as [string, never][],
    ).state;
    const start: SessionState = {
      ...createSession(),
      streaks: { P1: 2, P2: 3, P3: 1 },
      joker: { playerId: 'P1', streak: 2 },
    };
    const next = recordGame(start, game);
    expect(next.streaks).toEqual({ P1: 2, P2: 0, P3: 1 });
    expect(next.joker).toBeNull();
    expect(next.scores).toEqual({ P1: 1, P2: 2, P3: 1 });
    const deal = startSessionGame(next, ['P1', 'P2', 'P3'], seededRng(1));
    expect(deal.jokerId).toBeNull();
    expect(deal.jokerAces).toEqual([]);
  });

  it('R17: a removed player (3+ remaining) scores 0 and has their streak reset; earlier points stay', () => {
    const s = stateWith(
      { P1: [], P2: ['KH', '2C'], P3: ['9H', '3C'], P4: ['7S', '8S'] },
      {
        status: { P1: 'finished', P2: 'active', P3: 'active', P4: 'active' },
        placings: [['P1']],
        turn: 'P2',
      },
    );
    const r = applyAction(s, { type: 'remove', playerId: 'P4' });
    if (!r.ok) throw new Error(r.error.code);
    expect(r.state.result).toBeNull(); // two players still in
    const end = applyAction(r.state, { type: 'giveUp', playerId: 'P3' });
    if (!end.ok) throw new Error(end.error.code);
    const next = recordGame(
      { ...createSession(), scores: { P4: 7 }, streaks: { P4: 2 } },
      end.state,
    );
    expect(next.scores.P4).toBe(7);
    expect(next.streaks.P4).toBe(0);
    expect(next.history[0]!.removed).toEqual(['P4']);
  });

  it('R18: a removed loser gets the streak and becomes the Joker', () => {
    const s = stateWith(
      { P1: [], P2: ['KH', '2C'], P3: ['9H', '3C'] },
      { status: { P1: 'finished', P2: 'active', P3: 'active' }, placings: [['P1']], turn: 'P2' },
    );
    const r = applyAction(s, { type: 'remove', playerId: 'P2' });
    if (!r.ok) throw new Error(r.error.code);
    const next = recordGame({ ...createSession(), streaks: { P2: 1 } }, r.state);
    expect(next.streaks.P2).toBe(2);
    expect(next.joker).toEqual({ playerId: 'P2', streak: 2 });
  });

  it('refuses to record an unfinished game', () => {
    expect(() =>
      recordGame(createSession(), stateWith({ P1: ['2C'], P2: ['3C'], P3: ['4C'] })),
    ).toThrow();
  });
});

describe('forgetPlayer', () => {
  it('drops the score, streak and Joker status of a player who left', () => {
    const session: SessionState = {
      ...createSession(),
      scores: { P1: 5, P2: 3 },
      streaks: { P1: 0, P2: 2 },
      joker: { playerId: 'P2', streak: 2 },
    };
    const next = forgetPlayer(session, 'P2');
    expect(next.scores).toEqual({ P1: 5 });
    expect(next.streaks).toEqual({ P1: 0 });
    expect(next.joker).toBeNull();
    expect(forgetPlayer(session, 'P1').joker).toEqual({ playerId: 'P2', streak: 2 });
  });
});
