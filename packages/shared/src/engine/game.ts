/**
 * Pure game engine. Every function here is deterministic given its inputs; randomness is injected
 * via an Rng. Rule IDs (R1…R18, E1…E4) refer to docs/rules.md.
 */
import { type CardId, type Suit, fullDeck, isCardId, rankOf, suitOf } from './cards';
import { type Rng, shuffle } from './rng';
import type {
  ActionResult,
  EndReason,
  EngineErrorCode,
  GameAction,
  GameEvent,
  GameOutcome,
  GameState,
  JokerAssignment,
  PlayerId,
} from './types';

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 7;

/** R2: Aces given to the Joker, by streak. */
const JOKER_ACE_ORDER: CardId[] = ['AS', 'AC', 'AD', 'AH'];

export function jokerAcesForStreak(streak: number): CardId[] {
  return JOKER_ACE_ORDER.slice(0, Math.max(0, Math.min(streak, JOKER_ACE_ORDER.length)));
}

function assertSeats(seats: readonly PlayerId[]): void {
  if (seats.length < MIN_PLAYERS || seats.length > MAX_PLAYERS) {
    throw new Error(`A game needs ${MIN_PLAYERS}–${MAX_PLAYERS} players, got ${seats.length}`);
  }
  if (new Set(seats).size !== seats.length) throw new Error('Duplicate player ids in seats');
}

/**
 * R1 + R2 + E1 + E4: deal all 52 cards. The Joker (if seated and on a streak) receives their Aces,
 * which count toward a normal-sized hand. Extra cards go to randomly chosen players.
 */
export function dealHands(
  seats: readonly PlayerId[],
  joker: JokerAssignment | null,
  rng: Rng,
): { hands: Record<PlayerId, CardId[]>; jokerId: PlayerId | null; jokerAces: CardId[] } {
  assertSeats(seats);
  const jokerSeated = joker !== null && seats.includes(joker.playerId) && joker.streak > 0;
  const aces = jokerSeated ? jokerAcesForStreak(joker.streak) : [];
  const deck = shuffle(
    fullDeck().filter((c) => !aces.includes(c)),
    rng,
  );

  const n = seats.length;
  const base = Math.floor(52 / n);
  const extraSeats = new Set(shuffle(seats, rng).slice(0, 52 % n));

  const hands: Record<PlayerId, CardId[]> = {};
  for (const id of seats) hands[id] = jokerSeated && id === joker.playerId ? [...aces] : [];

  let next = 0;
  for (const id of seats) {
    const hand = hands[id]!;
    const size = base + (extraSeats.has(id) ? 1 : 0);
    while (hand.length < size) hand.push(deck[next++]!);
  }
  return { hands, jokerId: jokerSeated ? joker.playerId : null, jokerAces: aces };
}

/** Build a game from explicit hands (used by createGame, tests and fixtures). */
export function createGameFromHands(
  seats: readonly PlayerId[],
  hands: Record<PlayerId, CardId[]>,
  joker: { jokerId: PlayerId | null; jokerAces: CardId[] } = { jokerId: null, jokerAces: [] },
): GameState {
  assertSeats(seats);
  const all = seats.flatMap((id) => hands[id] ?? []);
  if (all.length !== 52 || new Set(all).size !== 52 || !all.every(isCardId)) {
    throw new Error('Hands must contain each of the 52 cards exactly once');
  }
  const starter = seats.find((id) => hands[id]!.includes('AS'))!;
  return {
    seats: [...seats],
    hands: Object.fromEntries(seats.map((id) => [id, [...hands[id]!]])),
    status: Object.fromEntries(seats.map((id) => [id, 'active' as const])),
    table: [],
    ledSuit: null,
    turn: starter,
    leader: starter,
    roundNo: 1,
    discarded: [],
    placings: [],
    loser: null,
    result: null,
    starter,
    jokerId: joker.jokerId,
    jokerAces: [...joker.jokerAces],
  };
}

/** Deal and start a new game (R1–R3). */
export function createGame(options: {
  seats: readonly PlayerId[];
  joker?: JokerAssignment | null;
  rng: Rng;
}): GameState {
  const { hands, jokerId, jokerAces } = dealHands(
    options.seats,
    options.joker ?? null,
    options.rng,
  );
  return createGameFromHands(options.seats, hands, { jokerId, jokerAces });
}

// ---------------------------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------------------------

export function activePlayers(state: GameState): PlayerId[] {
  return state.seats.filter((id) => state.status[id] === 'active');
}

export function isGameOver(state: GameState): boolean {
  return state.result !== null;
}

/** R4: cards a hand may play given the led suit (null = leading, anything goes). */
export function legalCardsForHand(hand: readonly CardId[], ledSuit: Suit | null): CardId[] {
  if (ledSuit === null) return [...hand];
  const following = hand.filter((c) => suitOf(c) === ledSuit);
  return following.length > 0 ? following : [...hand];
}

/** Cards this player may play right now (empty when it isn't their turn). */
export function playableCards(state: GameState, playerId: PlayerId): CardId[] {
  if (state.result || state.turn !== playerId) return [];
  return legalCardsForHand(state.hands[playerId] ?? [], state.ledSuit);
}

/** R11: give-up is available to the last two active players. */
export function canGiveUp(state: GameState, playerId: PlayerId): boolean {
  const active = activePlayers(state);
  return !state.result && active.length === 2 && active.includes(playerId);
}

// ---------------------------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------------------------

function fail(code: EngineErrorCode, message: string): ActionResult {
  return { ok: false, error: { code, message } };
}

export function applyAction(state: GameState, action: GameAction): ActionResult {
  if (state.result) return fail('GAME_OVER', 'The game is over');
  if (!state.seats.includes(action.playerId))
    return fail('NOT_IN_GAME', 'Player is not in this game');

  const s: GameState = structuredClone(state);
  const events: GameEvent[] = [];
  switch (action.type) {
    case 'play': {
      const error = play(s, action.playerId, action.card, events);
      return error ? fail(error[0], error[1]) : { ok: true, state: s, events };
    }
    case 'giveUp': {
      if (!canGiveUp(s, action.playerId)) {
        return fail('GIVE_UP_NOT_ALLOWED', 'You can only give up when two players remain');
      }
      giveUp(s, action.playerId, events);
      return { ok: true, state: s, events };
    }
    case 'remove': {
      if (s.status[action.playerId] !== 'active') {
        return fail('NOT_ACTIVE', 'Only an active player can be removed');
      }
      remove(s, action.playerId, events);
      return { ok: true, state: s, events };
    }
  }
}

function play(
  s: GameState,
  playerId: PlayerId,
  card: CardId,
  events: GameEvent[],
): [EngineErrorCode, string] | null {
  if (s.status[playerId] !== 'active') return ['NOT_ACTIVE', 'You are out of this game'];
  if (s.turn !== playerId) return ['NOT_YOUR_TURN', 'It is not your turn'];
  if (!isCardId(card)) return ['INVALID_CARD', 'Unknown card'];
  const hand = s.hands[playerId]!;
  const index = hand.indexOf(card);
  if (index === -1) return ['CARD_NOT_IN_HAND', 'You do not hold that card'];
  if (!legalCardsForHand(hand, s.ledSuit).includes(card)) {
    return ['MUST_FOLLOW_SUIT', 'You must follow the suit that was led'];
  }

  hand.splice(index, 1);
  s.table.push({ playerId, card });
  events.push({ type: 'cardPlayed', playerId, card });
  if (s.ledSuit === null) s.ledSuit = suitOf(card);

  if (suitOf(card) !== s.ledSuit) {
    resolveCut(s, playerId, events); // R5
  } else if (allActivePlayed(s)) {
    resolveFold(s, events); // R6
  } else {
    s.turn = nextToPlay(s, playerId);
  }
  return null;
}

function allActivePlayed(s: GameState): boolean {
  return activePlayers(s).every((id) => s.table.some((t) => t.playerId === id));
}

/** Next active seat clockwise after `from` that hasn't played this round. */
function nextToPlay(s: GameState, from: PlayerId): PlayerId | null {
  const n = s.seats.length;
  const start = s.seats.indexOf(from);
  for (let step = 1; step <= n; step++) {
    const id = s.seats[(start + step) % n]!;
    if (s.status[id] === 'active' && !s.table.some((t) => t.playerId === id)) return id;
  }
  return null;
}

/** Next active seat clockwise after `from` (from itself is checked last). */
function nextActiveFrom(s: GameState, from: PlayerId): PlayerId | null {
  const n = s.seats.length;
  const start = s.seats.indexOf(from);
  for (let step = 1; step <= n; step++) {
    const id = s.seats[(start + step) % n]!;
    if (s.status[id] === 'active') return id;
  }
  return null;
}

/** Led-suit plays on the table, highest first. */
function ledSuitPlaysDesc(s: GameState) {
  return s.table
    .filter((t) => suitOf(t.card) === s.ledSuit)
    .sort((a, b) => rankOf(b.card) - rankOf(a.card));
}

/** R5 (+E2): off-suit card ends the round; highest led-suit card among active players picks up. */
function resolveCut(s: GameState, cutter: PlayerId, events: GameEvent[]): void {
  const participants = s.table.map((t) => t.playerId);
  const cards = s.table.map((t) => t.card);
  const picker =
    ledSuitPlaysDesc(s).find((t) => s.status[t.playerId] === 'active')?.playerId ?? null;

  if (picker) s.hands[picker]!.push(...cards);
  else s.discarded.push(...cards); // E2

  clearTable(s);
  const finished = markFinishers(s, participants); // R7 — the picker can never be empty
  let nextLeader: PlayerId | null = picker ?? cutter;
  if (s.status[nextLeader] !== 'active') nextLeader = nextActiveFrom(s, nextLeader);
  events.push(
    { type: 'roundCut', cutBy: cutter, pickedUpBy: picker, cards, nextLeader },
    ...finished,
  );
  endRoundOrContinue(s, nextLeader, events);
}

/** R6: everyone followed suit; discard and let the highest still-active card lead. */
function resolveFold(s: GameState, events: GameEvent[]): void {
  const participants = s.table.map((t) => t.playerId);
  const cards = s.table.map((t) => t.card);
  const ranked = ledSuitPlaysDesc(s);
  s.discarded.push(...cards);
  clearTable(s);
  const finished = markFinishers(s, participants); // R7
  const nextLeader = ranked.find((t) => s.status[t.playerId] === 'active')?.playerId ?? null;
  events.push({ type: 'roundFolded', cards, nextLeader }, ...finished);
  endRoundOrContinue(s, nextLeader, events);
}

function clearTable(s: GameState): void {
  s.table = [];
  s.ledSuit = null;
}

/**
 * R7 + R9: active players from this round with empty hands finish together, as one placing group.
 * Returns the event so callers can report it after the round result.
 */
function markFinishers(s: GameState, participants: PlayerId[]): GameEvent[] {
  const finished = [...new Set(participants)].filter(
    (id) => s.status[id] === 'active' && s.hands[id]!.length === 0,
  );
  if (finished.length === 0) return [];
  const place = s.placings.flat().length + 1;
  for (const id of finished) s.status[id] = 'finished';
  s.placings.push(finished);
  return [{ type: 'playersFinished', playerIds: finished, place }];
}

/** R10 / R12: end the game when ≤1 active player remains, otherwise start the next round. */
function endRoundOrContinue(s: GameState, nextLeader: PlayerId | null, events: GameEvent[]): void {
  const active = activePlayers(s);
  if (active.length === 0) {
    endGame(s, 'draw', 'draw', null, events); // R12
  } else if (active.length === 1) {
    endGame(s, 'normal', 'lastPlayer', active[0]!, events); // R10
  } else {
    const leader = nextLeader && s.status[nextLeader] === 'active' ? nextLeader : active[0]!;
    s.leader = leader;
    s.turn = leader;
    s.roundNo += 1;
  }
}

/** R11: the giver loses; the other remaining player takes the last winning place. */
function giveUp(s: GameState, playerId: PlayerId, events: GameEvent[]): void {
  const other = activePlayers(s).find((id) => id !== playerId)!;
  events.push({ type: 'playerGaveUp', playerId });
  finishAlone(s, other, events);
  endGame(s, 'normal', 'giveUp', playerId, events);
}

/** R16–R18 (+E3): remove a player, redistributing their hand round-robin. */
function remove(s: GameState, playerId: PlayerId, events: GameEvent[]): void {
  const othersActive = activePlayers(s).filter((id) => id !== playerId);
  s.status[playerId] = 'removed';

  if (othersActive.length === 1) {
    // R18: removal leaves one player — the removed player is the loser.
    events.push({ type: 'playerRemoved', playerId, cardsReceived: {} });
    finishAlone(s, othersActive[0]!, events);
    endGame(s, 'normal', 'removal', playerId, events);
    return;
  }

  // R16: deal the hand round-robin starting with the next active seat.
  const hand = s.hands[playerId]!;
  s.hands[playerId] = [];
  const recipients: PlayerId[] = [];
  let cursor: PlayerId | null = playerId;
  for (let i = 0; i < othersActive.length; i++) {
    cursor = nextActiveFrom(s, cursor!);
    recipients.push(cursor!);
  }
  const cardsReceived: Record<PlayerId, number> = {};
  hand.forEach((card, i) => {
    const to = recipients[i % recipients.length]!;
    s.hands[to]!.push(card);
    cardsReceived[to] = (cardsReceived[to] ?? 0) + 1;
  });
  events.push({ type: 'playerRemoved', playerId, cardsReceived });

  if (s.table.length === 0) {
    if (s.turn === playerId) {
      const next = nextActiveFrom(s, playerId);
      s.turn = next;
      s.leader = next;
    }
  } else if (allActivePlayed(s)) {
    resolveFold(s, events); // E3
  } else if (s.turn === playerId) {
    s.turn = nextToPlay(s, playerId);
  }
}

function finishAlone(s: GameState, playerId: PlayerId, events: GameEvent[]): void {
  const place = s.placings.flat().length + 1;
  s.status[playerId] = 'finished';
  s.placings.push([playerId]);
  events.push({ type: 'playersFinished', playerIds: [playerId], place });
}

/** R8 + R9 points: group at position p (0-based) scores N−1−p; the loser and removed players score 0. */
export function computePoints(
  seats: readonly PlayerId[],
  placings: readonly PlayerId[][],
  loser: PlayerId | null,
): Record<PlayerId, number> {
  const n = placings.flat().length + (loser ? 1 : 0);
  const points: Record<PlayerId, number> = Object.fromEntries(seats.map((id) => [id, 0]));
  let position = 0;
  for (const group of placings) {
    for (const id of group) points[id] = n - 1 - position;
    position += group.length;
  }
  return points;
}

function endGame(
  s: GameState,
  outcome: GameOutcome,
  reason: EndReason,
  loser: PlayerId | null,
  events: GameEvent[],
): void {
  s.loser = loser;
  s.turn = null;
  s.leader = null;
  const points = computePoints(s.seats, s.placings, loser);
  s.result = { outcome, reason, points };
  events.push({
    type: 'gameOver',
    outcome,
    reason,
    loser,
    placings: s.placings.map((g) => [...g]),
    points,
  });
}
