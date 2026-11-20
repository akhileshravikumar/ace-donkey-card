import type { CardId, Suit } from './cards';

export type PlayerId = string;

/** active = still holding cards / in play; finished = out with a placing; removed = timed out or left (R16). */
export type PlayerStatus = 'active' | 'finished' | 'removed';

export interface TablePlay {
  playerId: PlayerId;
  card: CardId;
}

export type GameOutcome = 'normal' | 'draw';
/** Why the game ended: last player holding cards, everyone emptied together, a give-up, or a removal (R18). */
export type EndReason = 'lastPlayer' | 'draw' | 'giveUp' | 'removal';

export interface GameResult {
  outcome: GameOutcome;
  reason: EndReason;
  /** Points for every seated player (removed players get 0). */
  points: Record<PlayerId, number>;
}

export interface JokerAssignment {
  playerId: PlayerId;
  /** Consecutive-loss streak; decides how many Aces they receive (R2). */
  streak: number;
}

export interface GameState {
  /** Seat order (play goes clockwise in this order). Fixed for the whole game. */
  seats: PlayerId[];
  hands: Record<PlayerId, CardId[]>;
  status: Record<PlayerId, PlayerStatus>;
  /** Cards played in the current round, in order. */
  table: TablePlay[];
  ledSuit: Suit | null;
  /** Whose turn it is; null once the game is over. */
  turn: PlayerId | null;
  /** Who led (or will lead) the current round; null once the game is over. */
  leader: PlayerId | null;
  /** 1-based number of the current round. */
  roundNo: number;
  /** Cards removed from play by folds. */
  discarded: CardId[];
  /** Finishing groups in order; players in one group tied (R9). */
  placings: PlayerId[][];
  loser: PlayerId | null;
  result: GameResult | null;
  /** The A♠ holder at the deal (R3). */
  starter: PlayerId;
  jokerId: PlayerId | null;
  jokerAces: CardId[];
}

export type GameAction =
  | { type: 'play'; playerId: PlayerId; card: CardId }
  | { type: 'giveUp'; playerId: PlayerId }
  | { type: 'remove'; playerId: PlayerId };

export type GameEvent =
  | { type: 'cardPlayed'; playerId: PlayerId; card: CardId }
  | {
      type: 'roundCut';
      cutBy: PlayerId;
      /** Null only in edge case E2 (no remaining player played the led suit). */
      pickedUpBy: PlayerId | null;
      cards: CardId[];
      nextLeader: PlayerId | null;
    }
  | { type: 'roundFolded'; cards: CardId[]; nextLeader: PlayerId | null }
  | { type: 'playersFinished'; playerIds: PlayerId[]; place: number }
  | { type: 'playerGaveUp'; playerId: PlayerId }
  | {
      type: 'playerRemoved';
      playerId: PlayerId;
      /** How many cards each remaining player received (counts only — hands stay private). */
      cardsReceived: Record<PlayerId, number>;
    }
  | {
      type: 'gameOver';
      outcome: GameOutcome;
      reason: EndReason;
      loser: PlayerId | null;
      placings: PlayerId[][];
      points: Record<PlayerId, number>;
    };

export type EngineErrorCode =
  | 'GAME_OVER'
  | 'NOT_IN_GAME'
  | 'NOT_ACTIVE'
  | 'NOT_YOUR_TURN'
  | 'INVALID_CARD'
  | 'CARD_NOT_IN_HAND'
  | 'MUST_FOLLOW_SUIT'
  | 'GIVE_UP_NOT_ALLOWED';

export interface EngineError {
  code: EngineErrorCode;
  message: string;
}

export type ActionResult =
  { ok: true; state: GameState; events: GameEvent[] } | { ok: false; error: EngineError };
