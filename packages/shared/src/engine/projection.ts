/**
 * Per-player view of a game. The full GameState never leaves the server; clients only receive
 * their own hand plus public information (card counts, table, placings).
 */
import type { CardId, Suit } from './cards';
import { canGiveUp, mustTake, playableCards } from './game';
import type { GameResult, GameState, PendingCut, PlayerId, PlayerStatus, TablePlay } from './types';

export interface GamePlayerView {
  id: PlayerId;
  cardCount: number;
  status: PlayerStatus;
}

export interface GameView {
  /** The viewer's id if they are seated in this game, otherwise null (waiting / spectating). */
  you: PlayerId | null;
  hand: CardId[];
  /** Cards the viewer may play right now (empty when it isn't their turn). */
  playable: CardId[];
  canGiveUp: boolean;
  /** R5a: the viewer has to take the cards of a cut before play goes on. */
  mustTake: boolean;
  players: GamePlayerView[];
  table: TablePlay[];
  ledSuit: Suit | null;
  turn: PlayerId | null;
  leader: PlayerId | null;
  roundNo: number;
  discardedCount: number;
  placings: PlayerId[][];
  loser: PlayerId | null;
  result: GameResult | null;
  starter: PlayerId;
  jokerId: PlayerId | null;
  jokerAces: CardId[];
  /** R5a: a cut waiting for its picker to take the cards (table still shows them). */
  pendingCut: PendingCut | null;
}

export function projectGame(state: GameState, viewer: PlayerId | null): GameView {
  const seated = viewer !== null && state.seats.includes(viewer);
  const you = seated ? viewer : null;
  return {
    you,
    hand: you ? [...state.hands[you]!] : [],
    playable: you ? playableCards(state, you) : [],
    canGiveUp: you ? canGiveUp(state, you) : false,
    mustTake: you ? mustTake(state, you) : false,
    players: state.seats.map((id) => ({
      id,
      cardCount: state.hands[id]!.length,
      status: state.status[id]!,
    })),
    table: state.table.map((t) => ({ ...t })),
    ledSuit: state.ledSuit,
    turn: state.turn,
    leader: state.leader,
    roundNo: state.roundNo,
    discardedCount: state.discarded.length,
    placings: state.placings.map((g) => [...g]),
    loser: state.loser,
    result: state.result,
    starter: state.starter,
    jokerId: state.jokerId,
    jokerAces: [...state.jokerAces],
    pendingCut: state.pendingCut ? { ...state.pendingCut } : null,
  };
}
