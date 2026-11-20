import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { type CardId, cardName } from '@ace/shared';
import { DOUBLE_TAP_MS } from '../config';
import { CardImage } from './CardImage';
import { Button, cn } from './ui';

export interface HandProps {
  cards: CardId[];
  playable: CardId[];
  selected: CardId | null;
  isMyTurn: boolean;
  onSelect(card: CardId): void;
  onPlay(card: CardId): void;
  onPlaySelected(): void;
  onMoveSelection(delta: number): void;
  onMoveCard(card: CardId, toIndex: number): void;
  onSort(): void;
  /** Status line under the heading (e.g. whose turn it is). */
  status?: ReactNode;
  /** Extra toolbar actions (e.g. Give up). */
  actions?: ReactNode;
}

/**
 * The player's own cards.
 * - click / tap: highlight a card
 * - double-click / double-tap: play it
 * - drag: rearrange, or drop on the table to play (drag context lives in GameScreen)
 * - keyboard: ←/→ move the highlight, Shift+←/→ move the card, Enter plays, S sorts
 */
export function Hand(props: HandProps) {
  const { cards, playable, selected, isMyTurn } = props;
  const lastTap = useRef<{ card: CardId; at: number } | null>(null);

  const onCardClick = (card: CardId) => {
    const now = Date.now();
    const previous = lastTap.current;
    if (previous && previous.card === card && now - previous.at <= DOUBLE_TAP_MS) {
      lastTap.current = null;
      props.onPlay(card);
      return;
    }
    lastTap.current = { card, at: now };
    props.onSelect(card);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const delta = e.key === 'ArrowLeft' ? -1 : 1;
      if (e.shiftKey && selected) props.onMoveCard(selected, cards.indexOf(selected) + delta);
      else props.onMoveSelection(delta);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      props.onPlaySelected();
    } else if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      props.onSort();
    }
  };

  // Overlap cards more as the hand grows so it stays on one row.
  const overlap = cards.length <= 10 ? 12 : cards.length <= 18 ? 30 : cards.length <= 26 ? 44 : 54;

  return (
    <section
      aria-labelledby="hand-heading"
      className={cn(
        'rounded-2xl border bg-surface p-4 shadow-lg transition',
        isMyTurn ? 'border-accent/60 shadow-accent/10' : 'border-line',
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h2 id="hand-heading" className="text-lg font-semibold">
            Your cards ({cards.length}){isMyTurn ? ' — your turn' : ''}
          </h2>
          {props.status && <p className="text-sm text-muted">{props.status}</p>}
        </div>
        <Button onClick={props.onSort}>Sort by suit</Button>
        <Button variant="primary" onClick={props.onPlaySelected} disabled={!isMyTurn || !selected}>
          Play selected card
        </Button>
        {props.actions}
      </div>
      <SortableContext items={cards} strategy={rectSortingStrategy}>
        <div
          role="group"
          aria-label="Your hand"
          onKeyDown={onKeyDown}
          className="mt-4 flex flex-wrap gap-1.5 px-1 pt-6 pb-2 sm:flex-nowrap sm:gap-0 sm:overflow-x-auto sm:px-2"
          style={{ ['--overlap' as string]: `${overlap}px` }}
        >
          {cards.map((card) => (
            <HandCard
              key={card}
              card={card}
              selected={selected === card}
              playable={playable.includes(card)}
              isMyTurn={isMyTurn}
              onClick={() => onCardClick(card)}
            />
          ))}
        </div>
      </SortableContext>
      <p className="mt-1 text-xs text-muted">
        <span className="sm:hidden">
          Tap to select · double-tap or drag onto the table to play · drag to rearrange
        </span>
        <span className="hidden sm:inline">
          Click to select · double-click or drag onto the table to play · drag to rearrange · keys:
          ← → select, Shift+← → move, Enter play, S sort
        </span>
      </p>
    </section>
  );
}

function HandCard({
  card,
  selected,
  playable,
  isMyTurn,
  onClick,
}: {
  card: CardId;
  selected: boolean;
  playable: boolean;
  isMyTurn: boolean;
  onClick(): void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card,
  });
  // Functional only: dnd-kit needs the transform to move the card while dragging, and
  // touch-action so a touch drag doesn't scroll the page.
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: 'none' as const,
  };
  const hint = isMyTurn && !playable ? ', cannot be played now' : '';
  const dimmed = isMyTurn && !playable;
  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      {...attributes}
      {...listeners}
      aria-pressed={selected}
      aria-label={`${cardName(card)}${hint}`}
      data-card={card}
      data-playable={playable || undefined}
      onClick={onClick}
      className={cn(
        'relative shrink-0 rounded-lg transition-[translate,filter,opacity] duration-150',
        // Phones: no overlap, the hand wraps onto rows so every card is a full-width tap target.
        'sm:not-first:-ml-[var(--overlap)]',
        'focus-visible:z-20',
        selected ? '-translate-y-5' : 'hover:-translate-y-2',
        dimmed && 'opacity-45 saturate-50',
        isDragging && 'z-30 opacity-80',
      )}
    >
      <CardImage
        card={card}
        decorative
        className={cn(
          'w-12 sm:w-16 lg:w-20',
          selected && 'ring-2 ring-accent',
          isMyTurn && playable && 'shadow-accent/30',
        )}
      />
    </button>
  );
}
