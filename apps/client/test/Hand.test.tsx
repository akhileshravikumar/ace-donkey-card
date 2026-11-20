import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import type { CardId } from '@ace/shared';
import { Hand, type HandProps } from '../src/components/Hand';

function setup(overrides: Partial<HandProps> = {}) {
  const props: HandProps = {
    cards: ['AS', 'QH', '2C'] as CardId[],
    playable: ['QH'] as CardId[],
    selected: null,
    isMyTurn: true,
    onSelect: vi.fn(),
    onPlay: vi.fn(),
    onPlaySelected: vi.fn(),
    onMoveSelection: vi.fn(),
    onMoveCard: vi.fn(),
    onSort: vi.fn(),
    ...overrides,
  };
  render(
    <DndContext>
      <Hand {...props} />
    </DndContext>,
  );
  return props;
}

const card = (name: RegExp) => screen.getByRole('button', { name });

describe('<Hand>', () => {
  it('renders each card with an accessible name and marks unplayable cards on your turn', () => {
    setup();
    expect(card(/^Queen of Hearts$/)).toBeTruthy();
    expect(card(/Ace of Spades, cannot be played now/)).toBeTruthy();
  });

  it('shows each card as its image, hidden from screen readers (the button names the card)', () => {
    setup();
    const img = card(/Queen of Hearts/).querySelector('img')!;
    expect(img.getAttribute('src')).toBe('/cards/Qh.svg');
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('draggable')).toBe('false');
  });

  it('single click highlights a card', () => {
    const props = setup();
    fireEvent.click(card(/Queen of Hearts/));
    expect(props.onSelect).toHaveBeenCalledWith('QH');
    expect(props.onPlay).not.toHaveBeenCalled();
  });

  it('double click plays the card', () => {
    const props = setup();
    fireEvent.click(card(/Queen of Hearts/));
    fireEvent.click(card(/Queen of Hearts/));
    expect(props.onPlay).toHaveBeenCalledWith('QH');
  });

  it('two slow clicks are two selections, not a play', () => {
    vi.useFakeTimers();
    try {
      const props = setup();
      fireEvent.click(card(/Queen of Hearts/));
      act(() => vi.advanceTimersByTime(500));
      fireEvent.click(card(/Queen of Hearts/));
      expect(props.onPlay).not.toHaveBeenCalled();
      expect(props.onSelect).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clicks on two different cards are not a double click', () => {
    const props = setup();
    fireEvent.click(card(/Queen of Hearts/));
    fireEvent.click(card(/Ace of Spades/));
    expect(props.onPlay).not.toHaveBeenCalled();
  });

  it('shows the highlighted card as pressed', () => {
    setup({ selected: 'QH' as CardId });
    expect(card(/Queen of Hearts/).getAttribute('aria-pressed')).toBe('true');
    expect(card(/Ace of Spades/).getAttribute('aria-pressed')).toBe('false');
  });

  it('sort button and keyboard shortcuts', () => {
    const props = setup({ selected: 'QH' as CardId });
    fireEvent.click(screen.getByRole('button', { name: 'Sort by suit' }));
    expect(props.onSort).toHaveBeenCalledTimes(1);

    const hand = screen.getByRole('group', { name: 'Your hand' });
    fireEvent.keyDown(hand, { key: 'ArrowRight' });
    expect(props.onMoveSelection).toHaveBeenCalledWith(1);
    fireEvent.keyDown(hand, { key: 'ArrowLeft', shiftKey: true });
    expect(props.onMoveCard).toHaveBeenCalledWith('QH', 0);
    fireEvent.keyDown(hand, { key: 'Enter' });
    expect(props.onPlaySelected).toHaveBeenCalled();
    fireEvent.keyDown(hand, { key: 's' });
    expect(props.onSort).toHaveBeenCalledTimes(2);
  });

  it('"Play selected card" is only enabled on your turn with a card highlighted', () => {
    setup({ selected: null });
    expect(
      (screen.getByRole('button', { name: 'Play selected card' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
