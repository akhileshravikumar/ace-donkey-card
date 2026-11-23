import { type CardId, cardName } from '@ace/shared';
import { cardImageUrl } from '../lib/cardImages';
import { cn } from './cn';

/** A card face (Heratexx 4-colour deck). `decorative` when the surrounding control names the card. */
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
      draggable={false}
      data-card-image={card}
      className={cn('block h-auto select-none', className)}
    />
  );
}
