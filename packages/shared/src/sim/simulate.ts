/** Random-play simulator used by property tests, bot clients and the `npm run sim` CLI. */
import { applyAction, createGame, playableCards } from '../engine/game';
import type { Rng } from '../engine/rng';
import type { GameEvent, GameState, JokerAssignment, PlayerId } from '../engine/types';

export interface SimulatedGame {
  initial: GameState;
  final: GameState;
  events: GameEvent[];
  moves: number;
}

/** Plays a whole game with random legal moves. */
export function simulateGame(
  seats: PlayerId[],
  rng: Rng,
  options: { joker?: JokerAssignment | null; maxMoves?: number } = {},
): SimulatedGame {
  const initial = createGame({ seats, joker: options.joker ?? null, rng });
  let state = initial;
  const events: GameEvent[] = [];
  let moves = 0;
  const maxMoves = options.maxMoves ?? 20_000;
  while (!state.result) {
    if (moves++ > maxMoves) throw new Error('Simulation did not terminate');
    const player = state.turn!;
    const options_ = playableCards(state, player);
    const card = options_[rng(options_.length)]!;
    const result = applyAction(state, { type: 'play', playerId: player, card });
    if (!result.ok) throw new Error(`Illegal move generated: ${result.error.message}`);
    state = result.state;
    events.push(...result.events);
  }
  return { initial, final: state, events, moves };
}
