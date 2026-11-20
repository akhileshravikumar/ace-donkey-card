import { type CardId, compareBySuit } from '@ace/shared';

/**
 * Keep the player's own arrangement of their hand across server updates: cards still held keep
 * their position, newly received cards (picked up / redistributed) are appended.
 */
export function mergeHandOrder(order: readonly CardId[], hand: readonly CardId[]): CardId[] {
  const held = new Set(hand);
  const kept = order.filter((c) => held.has(c));
  const known = new Set(kept);
  return [...kept, ...hand.filter((c) => !known.has(c))];
}

export function sortBySuit(hand: readonly CardId[]): CardId[] {
  return [...hand].sort(compareBySuit);
}

export function moveCard(order: readonly CardId[], card: CardId, toIndex: number): CardId[] {
  const from = order.indexOf(card);
  if (from === -1) return [...order];
  const next = [...order];
  next.splice(from, 1);
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, card);
  return next;
}
