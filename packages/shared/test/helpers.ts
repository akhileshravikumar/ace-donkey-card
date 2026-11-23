import type { CardId, GameState, PlayerId } from '../src';
import { applyAction } from '../src';

/** Build a mid-game state directly (does not require all 52 cards). */
export function stateWith(
  hands: Record<PlayerId, CardId[]>,
  overrides: Partial<GameState> = {},
): GameState {
  const seats = Object.keys(hands);
  return {
    seats,
    hands: structuredClone(hands),
    status: Object.fromEntries(seats.map((id) => [id, 'active' as const])),
    table: [],
    ledSuit: null,
    turn: seats[0]!,
    leader: seats[0]!,
    roundNo: 1,
    discarded: [],
    placings: [],
    loser: null,
    result: null,
    starter: seats[0]!,
    jokerId: null,
    jokerAces: [],
    pendingCut: null,
    ...overrides,
  };
}

/**
 * Apply a sequence of plays, failing loudly on any rejected move. After a cut the picker takes
 * the cards (R5a) before the next play, unless `take: false` leaves the last cut waiting.
 */
export function playAll(
  state: GameState,
  moves: [PlayerId, CardId][],
  { take = true }: { take?: boolean } = {},
) {
  let s = state;
  const events = [];
  for (const [i, [playerId, card]] of moves.entries()) {
    const r = applyAction(s, { type: 'play', playerId, card });
    if (!r.ok) throw new Error(`${playerId} ${card}: ${r.error.code}`);
    s = r.state;
    events.push(...r.events);
    const last = i === moves.length - 1;
    if (s.pendingCut && (take || !last)) {
      const t = applyAction(s, { type: 'take', playerId: s.pendingCut.pickerId });
      if (!t.ok) throw new Error(`take: ${t.error.code}`);
      s = t.state;
      events.push(...t.events);
    }
  }
  return { state: s, events };
}

export function totalCards(s: GameState): CardId[] {
  return [...Object.values(s.hands).flat(), ...s.table.map((t) => t.card), ...s.discarded];
}
