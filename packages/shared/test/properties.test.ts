import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  activePlayers,
  applyAction,
  canGiveUp,
  computePoints,
  createGame,
  createSession,
  playableCards,
  projectGame,
  recordGame,
  seededRng,
  startSessionGame,
  type GameState,
  type Rng,
  type SessionState,
} from '../src';
import { totalCards } from './helpers';

function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const seatsFor = (n: number) => Array.from({ length: n }, (_, i) => `P${i + 1}`);

/** Random legal play, with occasional removals and give-ups. Checks invariants after every step. */
function playChecked(start: GameState, rng: Rng, disruption: boolean): GameState {
  let s = start;
  for (let step = 0; !s.result; step++) {
    if (step > 5000) throw new Error('game did not terminate');
    const roll = rng(1000);
    let r;
    if (disruption && roll < 8) {
      const active = activePlayers(s);
      r = applyAction(s, { type: 'remove', playerId: active[rng(active.length)]! });
    } else if (disruption && roll < 20 && canGiveUp(s, s.turn!)) {
      r = applyAction(s, { type: 'giveUp', playerId: s.turn! });
    } else if (s.pendingCut) {
      r = applyAction(s, { type: 'take', playerId: s.turn! }); // R5a
    } else {
      const options = playableCards(s, s.turn!);
      r = applyAction(s, { type: 'play', playerId: s.turn!, card: options[rng(options.length)]! });
    }
    if (!r.ok) throw new Error(`legal action rejected: ${r.error.code}`);
    s = r.state;

    // Card conservation: every card exactly once across hands, table and discard pile.
    const cards = totalCards(s);
    check(cards.length === 52 && new Set(cards).size === 52, 'cards not conserved');
    if (!s.result) {
      // Finished/removed players hold nothing; the player to move is active.
      for (const id of s.seats) {
        if (s.status[id] !== 'active')
          check(s.hands[id]!.length === 0, 'inactive player holds cards');
      }
      check(s.status[s.turn!] === 'active', 'turn given to an inactive player');
      // A waiting cut (R5a) belongs to the player to move, and nobody can play over it.
      if (s.pendingCut) {
        check(s.turn === s.pendingCut.pickerId, 'turn is not the picker during a cut');
        check(playableCards(s, s.turn!).length === 0, 'cards playable during a cut');
      }
      // Out-of-turn plays are always rejected (sampled to keep the run fast).
      if (step % 7 === 0) {
        const notTurn = s.seats.find((id) => id !== s.turn && s.status[id] === 'active');
        if (notTurn && s.hands[notTurn]!.length) {
          const bad = applyAction(s, {
            type: 'play',
            playerId: notTurn,
            card: s.hands[notTurn]![0]!,
          });
          check(!bad.ok, 'out-of-turn play accepted');
        }
      }
    }
  }
  return s;
}

describe('engine properties (random full games)', () => {
  it('every game terminates with exactly one loser or a draw, and points match placings', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 7 }),
        fc.integer(),
        fc.boolean(),
        (n, seed, disruption) => {
          const rng = seededRng(seed);
          const final = playChecked(createGame({ seats: seatsFor(n), rng }), rng, disruption);
          const result = final.result!;
          if (result.outcome === 'draw') {
            expect(final.loser).toBeNull();
            expect(final.placings.at(-1)!.length).toBeGreaterThanOrEqual(2);
          } else {
            expect(final.loser).not.toBeNull();
            expect(final.placings.flat()).not.toContain(final.loser);
          }
          expect(result.points).toEqual(computePoints(final.seats, final.placings, final.loser));
          // Every seat is accounted for exactly once: placed, loser, or removed.
          for (const id of final.seats) {
            const placed = final.placings.flat().filter((p) => p === id).length;
            const accounted =
              placed +
              (final.loser === id ? 1 : 0) +
              (final.status[id] === 'removed' && final.loser !== id ? 1 : 0);
            expect(accounted).toBe(1);
          }
        },
      ),
      { numRuns: 600 },
    );
  }, 60_000);

  it('projections never leak another player’s hand', () => {
    fc.assert(
      fc.property(fc.integer({ min: 3, max: 7 }), fc.integer(), (n, seed) => {
        const rng = seededRng(seed);
        let s = createGame({ seats: seatsFor(n), rng });
        for (let i = 0; i < 15 && !s.result; i++) {
          const options = playableCards(s, s.turn!);
          const r = s.pendingCut
            ? applyAction(s, { type: 'take', playerId: s.turn! })
            : applyAction(s, {
                type: 'play',
                playerId: s.turn!,
                card: options[rng(options.length)]!,
              });
          if (!r.ok) throw new Error(r.error.code);
          s = r.state;
        }
        for (const viewer of s.seats) {
          const view = JSON.stringify(projectGame(s, viewer));
          const onTable = new Set(s.table.map((t) => t.card));
          for (const other of s.seats) {
            if (other === viewer) continue;
            for (const card of s.hands[other]!) {
              if (!onTable.has(card) && !s.jokerAces.includes(card)) {
                expect(view).not.toContain(`"${card}"`);
              }
            }
          }
        }
        expect(projectGame(s, 'spectator').hand).toEqual([]);
      }),
      { numRuns: 300 },
    );
  }, 60_000);

  it('streaks and the Joker follow R12–R14 across a whole session', () => {
    fc.assert(
      fc.property(fc.integer({ min: 3, max: 7 }), fc.integer(), (n, seed) => {
        const rng = seededRng(seed);
        const seats = seatsFor(n);
        let session: SessionState = createSession();
        for (let g = 0; g < 12; g++) {
          const game = startSessionGame(session, seats, rng);
          if (session.joker) {
            expect(game.jokerId).toBe(session.joker.playerId);
            expect(game.starter).toBe(session.joker.playerId);
          }
          const final = playChecked(game, rng, true);
          const before = session.streaks;
          session = recordGame(session, final);
          const finalGroup = final.result!.outcome === 'draw' ? final.placings.at(-1)! : [];
          for (const id of seats) {
            if (id === final.loser) expect(session.streaks[id]).toBe((before[id] ?? 0) + 1);
            else if (finalGroup.includes(id)) expect(session.streaks[id]).toBe(before[id] ?? 0);
            else expect(session.streaks[id]).toBe(0);
          }
          expect(session.joker?.playerId ?? null).toBe(
            final.result!.outcome === 'draw' ? null : final.loser,
          );
        }
        const totals = Object.values(session.scores).reduce((a, b) => a + b, 0);
        const fromHistory = session.history
          .flatMap((h) => Object.values(h.points))
          .reduce((a, b) => a + b, 0);
        expect(totals).toBe(fromHistory);
      }),
      { numRuns: 60 },
    );
  }, 60_000);
});
