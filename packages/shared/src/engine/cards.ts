/** Card primitives. A card is a 2-character id: rank char + suit char, e.g. "AS", "TD", "9C". */

export const SUITS = ['S', 'H', 'D', 'C'] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;
export type Rank = (typeof RANKS)[number];

const RANK_CHARS = '23456789TJQKA';
type RankChar = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';
export type CardId = `${RankChar}${Suit}`;

export const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const SUIT_NAME: Record<Suit, string> = {
  S: 'Spades',
  H: 'Hearts',
  D: 'Diamonds',
  C: 'Clubs',
};
const RANK_NAME: Record<number, string> = {
  11: 'Jack',
  12: 'Queen',
  13: 'King',
  14: 'Ace',
};
const RANK_SHORT: Record<number, string> = { 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

export function cardId(rank: Rank, suit: Suit): CardId {
  return `${RANK_CHARS[rank - 2]}${suit}` as CardId;
}

export function isCardId(value: unknown): value is CardId {
  return (
    typeof value === 'string' &&
    value.length === 2 &&
    RANK_CHARS.includes(value[0]!) &&
    (SUITS as readonly string[]).includes(value[1]!)
  );
}

export function suitOf(card: CardId): Suit {
  return card[1] as Suit;
}

export function rankOf(card: CardId): Rank {
  return (RANK_CHARS.indexOf(card[0]!) + 2) as Rank;
}

/** All 52 cards in a fixed order (suit by suit, low to high). */
export function fullDeck(): CardId[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => cardId(rank, suit)));
}

/** Short label, e.g. "Q♥", "10♣". */
export function cardLabel(card: CardId): string {
  const rank = rankOf(card);
  return `${RANK_SHORT[rank] ?? String(rank)}${SUIT_SYMBOL[suitOf(card)]}`;
}

/** Accessible name, e.g. "Queen of Hearts". */
export function cardName(card: CardId): string {
  const rank = rankOf(card);
  return `${RANK_NAME[rank] ?? String(rank)} of ${SUIT_NAME[suitOf(card)]}`;
}

/** Sort order used by the "sort by suit" button: ♠ ♥ ♣ ♦ (alternating colours), high to low. */
const SORT_SUIT_ORDER: Record<Suit, number> = { S: 0, H: 1, C: 2, D: 3 };
export function compareBySuit(a: CardId, b: CardId): number {
  return SORT_SUIT_ORDER[suitOf(a)] - SORT_SUIT_ORDER[suitOf(b)] || rankOf(b) - rankOf(a);
}
