// @vitest-environment node
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fullDeck } from '@ace/shared';
import { cardImageUrl } from '../src/lib/cardImages';

const cardsDir = join(import.meta.dirname, '..', 'public', 'cards') + '/';

describe('card images', () => {
  it('maps every card id to its file name', () => {
    expect(cardImageUrl('AS')).toBe('/cards/As.svg');
    expect(cardImageUrl('TD')).toBe('/cards/Td.svg');
    expect(cardImageUrl('2C')).toBe('/cards/2c.svg');
  });

  it('has an image file for all 52 cards (exact case, for case-sensitive hosts)', () => {
    const files = new Set(readdirSync(cardsDir));
    for (const card of fullDeck()) {
      const name = cardImageUrl(card).split('/').pop()!;
      expect(files.has(name), `${card} → ${name}`).toBe(true);
      expect(existsSync(cardsDir + name)).toBe(true);
    }
  });
});
