import type { CardId } from '@ace/shared';

/**
 * URL of a card's image in `public/cards` (Heratexx 4-colour deck, CC0).
 * Game ids use an upper-case suit ("TD"); the files use lower case ("Td.svg").
 */
export function cardImageUrl(card: CardId): string {
  return `${import.meta.env.BASE_URL}cards/${card[0]}${card[1]!.toLowerCase()}.svg`;
}
