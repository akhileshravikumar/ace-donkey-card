import { Modal } from '../ui/Modal';

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: 'Setup & Start',
    body: (
      <>
        Deal all 52 cards equally among 3 or more players. The player holding the{' '}
        <b>Ace of Spades</b> starts the first round and may lead any card.
      </>
    ),
  },
  {
    title: 'Following Suit',
    body: (
      <>
        Play one card per turn matching the led suit whenever possible. If everyone follows suit,
        the cards are <b>folded</b> (discarded), and the player with the highest card starts the
        next round.
      </>
    ),
  },
  {
    title: 'The Cut',
    body: (
      <>
        If you cannot follow suit, play any card. The round stops immediately, and the player who
        played the highest card of the led suit has to collect all the cards on the table: the cards
        stay there for everyone to see until that player presses Take Cards, then they start the
        next round.
      </>
    ),
  },
  {
    title: 'Winning & Losing',
    body: (
      <>
        Empty your hand to become <b>safe</b>; the last player remaining with cards loses. Points go
        by finishing order, and players who finish in the same round tie. When only two are left,
        either can give up and take the loss.
      </>
    ),
  },
  {
    title: 'The Loser’s Crown',
    body: (
      <>
        The loser wears the dotted crown. Next game they’re dealt the <b>Ace of Spades</b> — plus
        the Ace of Clubs, Diamonds and Hearts for 2, 3 and 4 losses in a row — and sit out one
        dealing round per Ace. Any other finish ends the losing streak.
      </>
    ),
  },
  {
    title: 'Seats & Host',
    body: (
      <>
        The lobby order is the seating, dealing and turn order. The host (spiky crown) can drag
        players to rearrange them, remove players, hand over the host role and start the game. In
        the first game the host deals.
      </>
    ),
  },
  {
    title: 'Leaving',
    body: (
      <>
        If you lose connection you have 60 seconds to come back — rejoin with the same name. After
        that your cards go to the others and you join again as a new player.
      </>
    ),
  },
  {
    title: 'Controls',
    body: (
      <>
        Click a card to select it, double-click (or double-tap) to play it, or drag it onto the
        table. Drag cards in your hand to rearrange them. Keys: ← → select, Shift + ← → move, Enter
        plays, S sorts by suit.
      </>
    ),
  },
];

export function RulesModal({ onClose }: { onClose(): void }) {
  return (
    <Modal title="Rules" onClose={onClose} panelClassName="max-h-616">
      <div className="space-y-36 text-w30 leading-[1.2]">
        {SECTIONS.map((s) => (
          <p key={s.title}>
            <b>{s.title}:</b> {s.body}
          </p>
        ))}
      </div>
    </Modal>
  );
}
