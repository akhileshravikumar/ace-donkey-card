import { describe, expect, it } from 'vitest';
import { createGame, projectGame, seededRng } from '../src';

describe('projectGame', () => {
  const game = createGame({ seats: ['A', 'B', 'C', 'D'], rng: seededRng(42) });

  it('shows the viewer their own hand and only counts for others', () => {
    const view = projectGame(game, 'B');
    expect(view.you).toBe('B');
    expect(view.hand).toEqual(game.hands.B);
    expect(view.players.map((p) => p.cardCount)).toEqual(
      ['A', 'B', 'C', 'D'].map((id) => game.hands[id]!.length),
    );
    expect(view.players[0]).toEqual({ id: 'A', cardCount: 13, status: 'active' });
  });

  it('lists playable cards only on the viewer’s turn', () => {
    const starterView = projectGame(game, game.starter);
    expect(starterView.playable).toEqual(game.hands[game.starter]);
    const other = game.seats.find((id) => id !== game.starter)!;
    expect(projectGame(game, other).playable).toEqual([]);
  });

  it('gives a non-seated viewer no hand', () => {
    const view = projectGame(game, 'Z');
    expect(view.you).toBeNull();
    expect(view.hand).toEqual([]);
    expect(view.canGiveUp).toBe(false);
  });
});
