import { describe, expect, it } from 'vitest';
import { createGame, dealHands, jokerAcesForStreak, seededRng } from '../src';

const seatsFor = (n: number) => Array.from({ length: n }, (_, i) => `P${i + 1}`);

describe('dealing', () => {
  it.each([3, 4, 5, 6, 7])('R1: deals all 52 cards evenly to %i players', (n) => {
    for (let seed = 0; seed < 50; seed++) {
      const { hands } = dealHands(seatsFor(n), null, seededRng(seed));
      const all = Object.values(hands).flat();
      expect(new Set(all).size).toBe(52);
      const sizes = Object.values(hands).map((h) => h.length);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    }
  });

  it('rejects fewer than 3 or more than 7 players', () => {
    expect(() => dealHands(seatsFor(2), null, seededRng(1))).toThrow();
    expect(() => dealHands(seatsFor(8), null, seededRng(1))).toThrow();
  });

  it('R2: Aces stack with the streak and cap at four', () => {
    expect(jokerAcesForStreak(0)).toEqual([]);
    expect(jokerAcesForStreak(1)).toEqual(['AS']);
    expect(jokerAcesForStreak(2)).toEqual(['AS', 'AC']);
    expect(jokerAcesForStreak(3)).toEqual(['AS', 'AC', 'AD']);
    expect(jokerAcesForStreak(4)).toEqual(['AS', 'AC', 'AD', 'AH']);
    expect(jokerAcesForStreak(9)).toEqual(['AS', 'AC', 'AD', 'AH']);
  });

  it.each([1, 2, 3, 4, 6])(
    'R2: the Joker on streak %i receives their Aces in a normal-sized hand',
    (streak) => {
      for (let seed = 0; seed < 20; seed++) {
        const seats = seatsFor(7);
        const { hands, jokerId, jokerAces } = dealHands(
          seats,
          { playerId: 'P4', streak },
          seededRng(seed),
        );
        expect(jokerId).toBe('P4');
        for (const ace of jokerAcesForStreak(streak)) expect(hands.P4).toContain(ace);
        expect(jokerAces).toEqual(jokerAcesForStreak(streak));
        expect([7, 8]).toContain(hands.P4!.length);
        expect(new Set(Object.values(hands).flat()).size).toBe(52);
      }
    },
  );

  it('R3: the A♠ holder starts — always the Joker after a loss', () => {
    const game = createGame({
      seats: seatsFor(5),
      joker: { playerId: 'P3', streak: 1 },
      rng: seededRng(7),
    });
    expect(game.starter).toBe('P3');
    expect(game.turn).toBe('P3');
    const plain = createGame({ seats: seatsFor(5), rng: seededRng(7) });
    expect(plain.hands[plain.starter]).toContain('AS');
  });

  it('E1: a Joker who is not seated is ignored', () => {
    const { jokerId, jokerAces } = dealHands(
      seatsFor(4),
      { playerId: 'ghost', streak: 2 },
      seededRng(3),
    );
    expect(jokerId).toBeNull();
    expect(jokerAces).toEqual([]);
  });

  it('E4: who receives the extra card varies between deals', () => {
    const owners = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const { hands } = dealHands(seatsFor(5), null, seededRng(seed));
      for (const [id, h] of Object.entries(hands)) if (h.length === 11) owners.add(id);
    }
    expect(owners.size).toBe(5);
  });
});
