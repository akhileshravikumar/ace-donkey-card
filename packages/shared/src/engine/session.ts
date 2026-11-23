/**
 * Room-session bookkeeping across games: running scores, losing streaks and the Joker.
 * Pure functions; the server stores the returned objects.
 */
import { createGame } from './game';
import type { Rng } from './rng';
import type { CardId } from './cards';
import type { EndReason, GameOutcome, GameState, JokerAssignment, PlayerId } from './types';

export interface GameRecord {
  gameNo: number;
  seats: PlayerId[];
  outcome: GameOutcome;
  reason: EndReason;
  placings: PlayerId[][];
  loser: PlayerId | null;
  points: Record<PlayerId, number>;
  removed: PlayerId[];
  jokerId: PlayerId | null;
  jokerAces: CardId[];
  streaksAfter: Record<PlayerId, number>;
}

export interface SessionState {
  /** Running point totals (R8). */
  scores: Record<PlayerId, number>;
  /** Consecutive-loss streaks (R13, R14). */
  streaks: Record<PlayerId, number>;
  /** Who receives Aces in the next game; null after a draw or before the first game (R2, R12). */
  joker: JokerAssignment | null;
  history: GameRecord[];
}

export function createSession(): SessionState {
  return { scores: {}, streaks: {}, joker: null, history: [] };
}

/**
 * Deal the next game. `seats` is the seating order (R22). The Joker's seat starts the deal
 * (R2a); with no Joker (or Joker not seated, E1) the dealer — the host — deals.
 */
export function startSessionGame(
  session: SessionState,
  seats: PlayerId[],
  rng: Rng,
  dealerId: PlayerId | null = null,
): GameState {
  return createGame({ seats, joker: session.joker, dealerId, rng });
}

/** Apply a finished game's result to the session: scores, streaks and next Joker. */
export function recordGame(session: SessionState, game: GameState): SessionState {
  const result = game.result;
  if (!result) throw new Error('Cannot record a game that has not finished');

  const scores = { ...session.scores };
  const streaks = { ...session.streaks };

  for (const id of game.seats) scores[id] = (scores[id] ?? 0) + (result.points[id] ?? 0);

  const finalGroup = result.outcome === 'draw' ? (game.placings.at(-1) ?? []) : [];
  const removed = game.seats.filter((id) => game.status[id] === 'removed' && id !== game.loser);

  for (const id of game.seats) {
    if (id === game.loser) {
      streaks[id] = (streaks[id] ?? 0) + 1; // R13 / R18
    } else if (finalGroup.includes(id)) {
      streaks[id] = streaks[id] ?? 0; // R12: carries over
    } else {
      streaks[id] = 0; // R14 / R17
    }
  }

  const joker: JokerAssignment | null =
    result.outcome === 'normal' && game.loser
      ? { playerId: game.loser, streak: streaks[game.loser]! }
      : null; // R12: draw resets the Joker

  const record: GameRecord = {
    gameNo: session.history.length + 1,
    seats: [...game.seats],
    outcome: result.outcome,
    reason: result.reason,
    placings: game.placings.map((g) => [...g]),
    loser: game.loser,
    points: { ...result.points },
    removed,
    jokerId: game.jokerId,
    jokerAces: [...game.jokerAces],
    streaksAfter: Object.fromEntries(game.seats.map((id) => [id, streaks[id]!])),
  };

  return { scores, streaks, joker, history: [...session.history, record] };
}

/**
 * R17/R18: a player who left the room for good (timed out or left) is forgotten: their running
 * score, losing streak and Joker status go. Past game records are kept for the other players.
 */
export function forgetPlayer(session: SessionState, playerId: PlayerId): SessionState {
  const scores = { ...session.scores };
  const streaks = { ...session.streaks };
  delete scores[playerId];
  delete streaks[playerId];
  return {
    ...session,
    scores,
    streaks,
    joker: session.joker?.playerId === playerId ? null : session.joker,
  };
}
