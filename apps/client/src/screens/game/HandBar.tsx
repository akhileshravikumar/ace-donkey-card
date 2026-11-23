import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { type Avatar as AvatarData, type CardId, cardName } from '@ace/shared';
import { DOUBLE_TAP_MS } from '../../config';
import { Avatar, type CrownKind } from '../../ui/Avatar';
import { CardImage } from '../../ui/CardImage';
import { cn } from '../../ui/cn';

export interface HandBarProps {
  name: string;
  avatar: AvatarData;
  crown: CrownKind;
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
  /** Shown instead of cards (waiting for the next game, already out, …). */
  message?: ReactNode;
}

/** Room for cards inside the bar, in wireframe pixels (cards are 64 wide, 81 apart when they fit). */
const CARDS_WIDTH = 690;
const CARD_W = 64;

/**
 * The hand bar from the game wireframe: your cards, then your avatar and name.
 * - click / tap: select (the card lifts) · double-click / double-tap: play
 * - drag: rearrange, or drop on the table to play (drag context lives in GameScreen)
 * - keyboard: ←/→ select, Shift+←/→ move the card, Enter plays, S sorts
 * Cards you can't play on your turn are greyed out.
 */
export function HandBar(props: HandBarProps) {
  const { cards, playable, selected, isMyTurn } = props;
  const lastTap = useRef<{ card: CardId; at: number } | null>(null);
  const step = cards.length > 1 ? Math.min(81, (CARDS_WIDTH - CARD_W) / (cards.length - 1)) : 81;

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

  return (
    <section
      aria-labelledby="hand-heading"
      className="mx-auto flex h-138 w-1174 max-w-full items-center rounded-bar bg-bar pr-40 pl-77"
    >
      <h2 id="hand-heading" className="sr-only">
        Your cards ({cards.length}){isMyTurn ? ' — your turn' : ''}
      </h2>
      <div
        className="flex h-full flex-1 items-center"
        style={{ maxWidth: `calc(var(--u) * ${CARDS_WIDTH + 20})` }}
      >
        {props.message ? (
          <p className="text-w30 text-shade">{props.message}</p>
        ) : (
          <SortableContext items={cards} strategy={horizontalListSortingStrategy}>
            <div
              role="group"
              aria-label="Your hand"
              onKeyDown={onKeyDown}
              className="flex items-center"
            >
              {cards.map((card, i) => (
                <HandCard
                  key={card}
                  card={card}
                  first={i === 0}
                  overlap={CARD_W - step}
                  gap={step - CARD_W}
                  selected={selected === card}
                  playable={playable.includes(card)}
                  isMyTurn={isMyTurn}
                  onClick={() => onCardClick(card)}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-48">
        <Avatar avatar={props.avatar} size={96} crown={props.crown} />
        <span className="max-w-260 truncate text-w30 font-semibold">{props.name}</span>
      </div>
    </section>
  );
}

function HandCard({
  card,
  first,
  overlap,
  gap,
  selected,
  playable,
  isMyTurn,
  onClick,
}: {
  card: CardId;
  first: boolean;
  overlap: number;
  gap: number;
  selected: boolean;
  playable: boolean;
  isMyTurn: boolean;
  onClick(): void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card,
  });
  const dimmed = isMyTurn && !playable;
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      aria-pressed={selected}
      aria-label={`${cardName(card)}${dimmed ? ', cannot be played now' : ''}`}
      data-card={card}
      data-playable={playable || undefined}
      onClick={onClick}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        touchAction: 'none',
        marginLeft: first
          ? 0
          : overlap > 0
            ? `calc(var(--u) * ${-overlap})`
            : `calc(var(--u) * ${gap})`,
      }}
      className={cn(
        'relative shrink-0 rounded-[calc(var(--u)*6)] transition-[translate]',
        selected ? '-translate-y-38' : 'hover:-translate-y-8',
        isDragging && 'z-30 opacity-80',
      )}
    >
      <CardImage
        card={card}
        decorative
        className={cn(
          'w-64 rounded-[calc(var(--u)*6)] shadow-sm',
          dimmed && 'brightness-75 grayscale',
          selected && 'shadow-lg',
        )}
      />
      {dimmed && (
        <span aria-hidden className="absolute inset-0 rounded-[calc(var(--u)*6)] bg-mid/45" />
      )}
    </button>
  );
}
