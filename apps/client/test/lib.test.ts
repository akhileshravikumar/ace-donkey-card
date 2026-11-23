import { describe, expect, it } from 'vitest';
import type { CardId } from '@ace/shared';
import { mergeHandOrder, moveCard, sortBySuit } from '../src/lib/hand';
import { offset, tableShape } from '../src/lib/tableGeometry';
import { playerStats } from '../src/lib/stats';
import { cycle, loadAvatar, randomAvatar } from '../src/lib/avatar';
import { memoryStore, player, record, roomView } from './helpers';

const c = (...ids: string[]) => ids as CardId[];

describe('hand order', () => {
  it('keeps the player’s arrangement and appends new cards', () => {
    expect(mergeHandOrder(c('KS', '2H', '9D'), c('9D', 'KS', 'AC', '2C'))).toEqual(
      c('KS', '9D', 'AC', '2C'),
    );
  });

  it('moves a card to a new position', () => {
    expect(moveCard(c('A', 'B', 'C', 'D') as never, 'A' as never, 2)).toEqual(['B', 'C', 'A', 'D']);
    expect(moveCard(c('A', 'B', 'C') as never, 'C' as never, -5)).toEqual(['C', 'A', 'B']);
  });

  it('sorts by suit then rank', () => {
    expect(sortBySuit(c('2D', 'KS', '3H', 'AS', 'QC'))).toEqual(c('AS', 'KS', '3H', 'QC', '2D'));
  });
});

describe('table shape', () => {
  it('has one side per player with a flat bottom edge for you', () => {
    for (const n of [3, 4, 5, 6, 7]) {
      const shape = tableShape(n, 450, 300, 330, 262);
      expect(shape.vertices).toHaveLength(n);
      expect(shape.edgeMidpoints).toHaveLength(n);
      expect(shape.seatAngles[0]).toBe(90);
      // Edge 0 is horizontal and at the bottom.
      const [a, b] = [shape.vertices[n - 1]!, shape.vertices[0]!];
      expect(a.y).toBeCloseTo(b.y);
      expect(Math.max(...shape.vertices.map((v) => v.y))).toBeCloseTo(a.y);
      // Seats go clockwise: bottom, then left side, …
      expect(shape.edgeMidpoints[1]!.x).toBeLessThan(450);
      // The shape fills the box height.
      const ys = shape.vertices.map((v) => v.y);
      expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(524);
    }
  });

  it('keeps triangles and squares regular', () => {
    const sq = tableShape(4, 0, 0, 330, 262).vertices;
    const side = (p: { x: number; y: number }, q: { x: number; y: number }) =>
      Math.hypot(p.x - q.x, p.y - q.y);
    expect(side(sq[0]!, sq[1]!)).toBeCloseTo(side(sq[1]!, sq[2]!));
    const tri = tableShape(3, 0, 0, 330, 262).vertices;
    expect(side(tri[0]!, tri[1]!)).toBeCloseTo(side(tri[1]!, tri[2]!));
    expect(side(tri[0]!, tri[1]!)).toBeCloseTo(side(tri[2]!, tri[0]!));
  });

  it('points each seat straight out from its edge', () => {
    const shape = tableShape(5, 450, 300, 330, 262);
    shape.seatAngles.forEach((angle, i) => {
      const p = shape.vertices[(i + 4) % 5]!;
      const q = shape.vertices[i]!;
      const out = offset({ x: 0, y: 0 }, angle, 1);
      expect(out.x * (q.x - p.x) + out.y * (q.y - p.y)).toBeCloseTo(0);
    });
  });
});

describe('scoreboard stats', () => {
  it('counts points, games not lost, losses and the current streak’s Aces', () => {
    const seats = ['me', 'bob', 'cleo'];
    const room = roomView({
      players: [player('me'), player('bob', { streak: 0 }), player('cleo', { streak: 3 })],
      history: [
        record({ seats, loser: 'bob', points: { me: 2, cleo: 1 } }),
        record({ seats, loser: 'cleo', points: { me: 1, bob: 2 } }),
        record({ seats: ['me', 'cleo'], loser: 'cleo', points: { me: 1 }, removed: ['bob'] }),
        record({ seats, loser: 'cleo', points: { me: 1, bob: 2 }, removed: [] }),
      ],
    });
    expect(playerStats(room, 'me')).toEqual({ points: 5, wins: 4, losses: 0, aces: [] });
    expect(playerStats(room, 'bob')).toMatchObject({ points: 4, wins: 2, losses: 1 });
    expect(playerStats(room, 'cleo')).toMatchObject({ points: 1, wins: 1, losses: 3 });
    expect(playerStats(room, 'cleo').aces).toEqual(['AS', 'AC', 'AD']);
  });
});

describe('avatar', () => {
  it('cycles options both ways and wraps around', () => {
    expect(cycle(0, -1, 4)).toBe(3);
    expect(cycle(3, 1, 4)).toBe(0);
    expect(cycle(1, 1, 3)).toBe(2);
  });

  it('picks random parts within range', () => {
    expect(randomAvatar(() => 0)).toEqual({ face: 0, glasses: 0, mouth: 0 });
    expect(randomAvatar(() => 0.999)).toEqual({ face: 5, glasses: 3, mouth: 2 });
  });

  it('replaces a saved avatar from the old 3-part format', () => {
    const storage = memoryStore();
    storage.setItem('ace-donkey.avatar', JSON.stringify({ glasses: 1, eyes: 2, mouth: 0 }));
    const avatar = loadAvatar(storage);
    expect(Object.keys(avatar).sort()).toEqual(['face', 'glasses', 'mouth']);
    expect(JSON.parse(storage.getItem('ace-donkey.avatar')!)).toEqual(avatar);
  });
});
