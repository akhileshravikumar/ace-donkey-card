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
    ...overrides,
  };
}

/** Apply a sequence of plays, failing loudly on any rejected move. */
export function playAll(state: GameState, moves: [PlayerId, CardId][]) {
  let s = state;
  const events = [];
  for (const [playerId, card] of moves) {
    const r = applyAction(s, { type: 'play', playerId, card });
    if (!r.ok) throw new Error(`${playerId} ${card}: ${r.error.code}`);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

export function totalCards(s: GameState): CardId[] {
  return [...Object.values(s.hands).flat(), ...s.table.map((t) => t.card), ...s.discarded];
}
