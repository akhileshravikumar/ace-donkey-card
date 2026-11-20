import { describe, expect, it } from 'vitest';
import type { CardId } from '@ace/shared';
import { describeEvent, ordinal } from '../src/lib/describe';
import { mergeHandOrder, moveCard, sortBySuit } from '../src/lib/hand';

const c = (...ids: string[]) => ids as CardId[];

describe('hand order', () => {
  it('keeps the player’s arrangement and appends new cards', () => {
    expect(mergeHandOrder(c('KS', '2H', '9D'), c('9D', 'KS', 'AC', '2C'))).toEqual(
      c('KS', '9D', 'AC', '2C'),
    );
  });

  it('moves a card to a new position', () => {
    expect(moveCard(c('A', 'B', 'C', 'D') as never, 'A' as never, 2)).toEqual(['B', 'C', 'A', 'D']);
    expect(moveCard(c('A', 'B', 'C') as never, 'C' as never, -5)).toEqual(['C', 'A', 'B']);
  });

  it('sorts by suit then rank', () => {
    expect(sortBySuit(c('2D', 'KS', '3H', 'AS', 'QC'))).toEqual(c('AS', 'KS', '3H', 'QC', '2D'));
  });
});

describe('event descriptions', () => {
  const names: Record<string, string> = { a: 'Ann', b: 'Bob', c: 'Cat' };
  const nameOf = (id: string) => names[id] ?? '?';

  it('formats ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
    ]);
  });

  it('describes every event type in plain language', () => {
    expect(describeEvent({ type: 'cardPlayed', playerId: 'a', card: 'QH' }, nameOf)).toBe(
      'Ann played Q♥',
    );
    expect(
      describeEvent(
        {
          type: 'roundCut',
          cutBy: 'b',
          pickedUpBy: 'a',
          cards: c('2H', 'QH', '3S'),
          nextLeader: 'a',
        },
        nameOf,
      ),
    ).toBe('Bob cut the suit — Ann picks up 3 cards');
    expect(
      describeEvent({ type: 'roundFolded', cards: c('2H', 'QH'), nextLeader: 'c' }, nameOf),
    ).toBe('Everyone followed suit — cards folded; Cat leads');
    expect(
      describeEvent({ type: 'playersFinished', playerIds: ['a', 'b'], place: 1 }, nameOf),
    ).toBe('Ann and Bob finished 1st (tied)');
    expect(describeEvent({ type: 'playerGaveUp', playerId: 'c' }, nameOf)).toBe('Cat gave up');
    expect(
      describeEvent(
        { type: 'playerRemoved', playerId: 'c', cardsReceived: { a: 2, b: 1 } },
        nameOf,
      ),
    ).toBe('Cat left the game — their 3 cards were dealt to the others');
    expect(
      describeEvent(
        {
          type: 'gameOver',
          outcome: 'normal',
          reason: 'lastPlayer',
          loser: 'b',
          placings: [],
          points: {},
        },
        nameOf,
      ),
    ).toBe('Game over — Bob is the Donkey');
    expect(
      describeEvent(
        {
          type: 'gameOver',
          outcome: 'draw',
          reason: 'draw',
          loser: null,
          placings: [],
          points: {},
        },
        nameOf,
      ),
    ).toContain('draw');
  });
});
