import { type CardId, cardName } from '@ace/shared';
import { CARD_ASPECT, cardImageUrl } from '../lib/cardImages';
import { cn } from './ui';

/**
 * A card face. `decorative` hides it from screen readers when the surrounding control already
 * names the card (e.g. a hand button with an aria-label). Size it with a width class; height
 * follows the card's aspect ratio.
 */
export function CardImage({
  card,
  className,
  decorative = false,
}: {
  card: CardId;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <img
      src={cardImageUrl(card)}
      alt={decorative ? '' : cardName(card)}
      width={240}
      height={Math.round(240 * CARD_ASPECT)}
      // The browser's native image drag would fight the drag-and-drop library.
      draggable={false}
      data-card-image={card}
      className={cn('h-auto select-none rounded-[6px] shadow-md', className ?? 'w-16')}
    />
  );
}
