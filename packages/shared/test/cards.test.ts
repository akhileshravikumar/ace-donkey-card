import { describe, expect, it } from 'vitest';
import {
  type CardId,
  cardLabel,
  cardName,
  compareBySuit,
  fullDeck,
  isCardId,
  rankOf,
  suitOf,
} from '../src';

describe('cards', () => {
  it('has 52 unique valid cards', () => {
    const deck = fullDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck).size).toBe(52);
    expect(deck.every(isCardId)).toBe(true);
  });

  it('parses rank and suit', () => {
    expect(rankOf('AS')).toBe(14);
    expect(rankOf('TD')).toBe(10);
    expect(rankOf('2C')).toBe(2);
    expect(suitOf('QH')).toBe('H');
  });

  it('rejects malformed ids', () => {
    for (const bad of ['1S', 'AX', 'A', 'ASS', 10, null]) expect(isCardId(bad)).toBe(false);
  });

  it('labels cards for display and screen readers', () => {
    expect(cardLabel('QH')).toBe('Q♥');
    expect(cardLabel('TC')).toBe('10♣');
    expect(cardName('AS')).toBe('Ace of Spades');
    expect(cardName('7D')).toBe('7 of Diamonds');
  });

  it('sorts by suit (♠ ♥ ♣ ♦) then rank high to low', () => {
    expect((['2D', 'KS', '3H', 'AS', 'QC'] as CardId[]).sort(compareBySuit)).toEqual([
      'AS',
      'KS',
      '3H',
      'QC',
      '2D',
    ]);
  });
});
