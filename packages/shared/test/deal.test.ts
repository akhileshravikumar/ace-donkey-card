import { describe, expect, it } from 'vitest';
import {
  createGame,
  dealHands,
  dealSequence,
  fullDeck,
  jokerAcesForStreak,
  seededRng,
  shuffle,
} from '../src';

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

describe('R2 dealing order with a Joker', () => {
  it('skips the Joker for one round per Ace, then deals to everyone (the 3-Ace example)', () => {
    // 4 players, P1 lost 3 in a row: dealing starts at P2 and skips P1 for the first 3 rounds.
    const seq = dealSequence(['P1', 'P2', 'P3', 'P4'], 1, { playerId: 'P1', rounds: 3 }, 49);
    expect(seq.slice(0, 9)).toEqual(['P2', 'P3', 'P4', 'P2', 'P3', 'P4', 'P2', 'P3', 'P4']);
    expect(seq.slice(9, 13)).toEqual(['P2', 'P3', 'P4', 'P1']);
    const counts = Object.fromEntries(
      ['P1', 'P2', 'P3', 'P4'].map((id) => [id, seq.filter((x) => x === id).length]),
    );
    expect(counts).toEqual({ P1: 10, P2: 13, P3: 13, P4: 13 }); // P1: 3 Aces + 10 = 13
  });

  it('gives any extra cards to the first players after the Joker', () => {
    // 5 players, Joker P3 with 1 Ace: 51 cards to deal → two players get 11.
    const seats = ['P1', 'P2', 'P3', 'P4', 'P5'];
    const { hands } = dealHands(seats, { playerId: 'P3', streak: 1 }, seededRng(9));
    expect(Object.fromEntries(seats.map((id) => [id, hands[id]!.length]))).toEqual({
      P1: 10,
      P2: 10,
      P3: 10, // A♠ + 9
      P4: 11,
      P5: 11,
    });
  });

  it('deals real cards in that order (first dealt card goes to the player after the Joker)', () => {
    const seats = ['A', 'B', 'C', 'D'];
    const rng = seededRng(21);
    const { hands } = dealHands(seats, { playerId: 'B', streak: 2 }, rng);
    const deck = shuffle(
      fullDeck().filter((c) => c !== 'AS' && c !== 'AC'),
      seededRng(21),
    );
    const seq = dealSequence(seats, 2, { playerId: 'B', rounds: 2 }, deck.length);
    const expected: Record<string, string[]> = { A: [], B: ['AS', 'AC'], C: [], D: [] };
    seq.forEach((id, i) => expected[id]!.push(deck[i]!));
    expect(hands).toEqual(expected);
    expect(seq.slice(0, 3)).toEqual(['C', 'D', 'A']);
  });

  it.each([1, 2, 3, 4])('hands stay even (±1) with %i Aces for 3–7 players', (streak) => {
    for (let n = 3; n <= 7; n++) {
      const seats = seatsFor(n);
      const { hands } = dealHands(seats, { playerId: 'P2', streak }, seededRng(n * 10 + streak));
      const sizes = seats.map((id) => hands[id]!.length);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
      expect(new Set(Object.values(hands).flat()).size).toBe(52);
    }
  });
});

describe('R22 the host deals when there is no Joker', () => {
  it('starts with the player below the host; extra cards go to the first players after the host', () => {
    // 5 players, host P1 at the top: 52 = 10 each + 2 extra → P2 and P3 get 11.
    const seats = ['P1', 'P2', 'P3', 'P4', 'P5'];
    for (let seed = 0; seed < 10; seed++) {
      const { hands } = dealHands(seats, null, seededRng(seed), 'P1');
      expect(seats.map((id) => hands[id]!.length)).toEqual([10, 11, 11, 10, 10]);
    }
  });

  it('the Joker still overrides the dealer (R2a)', () => {
    const seats = ['P1', 'P2', 'P3', 'P4', 'P5'];
    const { hands } = dealHands(seats, { playerId: 'P3', streak: 1 }, seededRng(3), 'P1');
    expect(seats.map((id) => hands[id]!.length)).toEqual([10, 10, 10, 11, 11]);
  });

  it('a Joker who is not seated falls back to the dealer (E1)', () => {
    const seats = ['P1', 'P2', 'P3', 'P4', 'P5'];
    const { hands } = dealHands(seats, { playerId: 'gone', streak: 2 }, seededRng(3), 'P1');
    expect(seats.map((id) => hands[id]!.length)).toEqual([10, 11, 11, 10, 10]);
  });
});
