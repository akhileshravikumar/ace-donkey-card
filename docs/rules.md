# Ace Donkey – Game Rules

These rules are the single source of truth for the game engine (`packages/shared/src/engine`).
Every rule has an ID; tests reference these IDs.

## Dealing & starting

- **R1. Deal everything.** All 52 cards are dealt; hand sizes differ by at most 1.
- **R2. Joker's Aces stack up.** The previous game's loser (the **Joker**) receives Aces according
  to their consecutive-loss streak. The Aces count toward a normal-sized hand; the rest of the
  deck is dealt to everyone.

  | Streak | Aces given to the Joker |
  | ------ | ----------------------- |
  | 1      | A♠                      |
  | 2      | A♠ A♣                   |
  | 3      | A♠ A♣ A♦                |
  | 4+     | A♠ A♣ A♦ A♥             |

- **R2a. Dealing order.** The Joker is given their Aces first. The rest of the deck is then dealt
  clockwise, one card per player per round, starting with the player after the Joker. The Joker
  is **skipped for as many rounds as they hold Aces**; after that every player, the Joker
  included, gets one card per round until the deck runs out. Example: 4 players, the Joker holds
  3 Aces → the first 3 rounds go to the other three players only (9 cards), then everyone gets a
  card each round; all hands end at 13. Any extra cards (when the deck doesn't divide evenly) go to
  the first players after the Joker, so the Joker never gets one.
- **R3. Starter.** The A♠ holder starts and may lead any card. After a loss that's always the Joker.

## Playing a round

- **R4. Follow suit.** Players must follow the led suit if they can; otherwise they may play any card.
- **R5. Cut.** An off-suit card ends the round immediately. The player with the highest card **of
  the led suit** picks up every table card and leads the next round.
- **R5a. Take cards.** After a cut, every card played that round stays on the table, visible to
  everyone, until the player picking up presses **Take Cards**. Nobody can play in the meantime.
  Players who emptied their hand that round (the cutter included) only finish once the cards are
  taken.
- **R6. Fold.** If every active player follows suit, the table cards are discarded permanently.
  The highest card's player leads next. If that player has run out, the **next-highest card** in
  that round leads, and so on.

## Finishing, scoring & losing

- **R7. Finishing.** A player is out when their hand is empty after the round resolves. Picking up
  cards in a cut means they are not out.
- **R8. Points.** With N players, finishing places are worth N−1, N−2, … 1, and the loser gets 0.
  N counts the players who completed the game (removed players under R17 are not counted).
- **R9. Ties (any number of players).** Everyone who finishes in the same round shares the place and
  gets the **highest** score among the places they occupy; following places are skipped.
  5 players, two tie first: 4, 4, 2, 1, 0. 6 players, three tie second: 5, 4, 4, 4, 1, 0.
- **R10. Loser.** The last player holding cards is the loser and gets 0 points. Everyone else is a
  winner with their placing score.
- **R11. Give up.** When exactly two players remain, either may give up (at any time). That player
  becomes the loser and the game ends; the other takes the last winning place.
- **R12. Draw.** If **all** remaining players (2 or more) empty their hands on the same folded
  round, the game is a **draw**: no loser; those players tie under R9 (last two → 1 point each,
  last three → 2 points each). Losing streaks of everyone in that final group carry over (not reset,
  not increased); all other players reset as normal (R14). The Joker is reset: nobody receives
  Aces next game and all 52 cards are dealt normally.

## Losing streaks

- **R13. Streak +1** for the loser of a game.
- **R14. Streak reset to 0** for any player who doesn't lose, except players in a draw's final
  group (R12).

## Disconnects & removal

- **R15. Grace period.** A disconnected player's seat is held for **60 s**. If it's their turn,
  play waits. Within those 60 s they can come back either automatically (same browser) or by
  opening the invite link and joining with the **same name**: they get their seat, hand and score
  back. A name that belongs to a connected player can't be used.
- **R16. Removal.** After 60 s (or if the player leaves voluntarily) the player is removed and their
  hand is dealt round-robin to the remaining active players, starting with the next seat. A card
  they already played stays on the table. If it was their turn, the turn passes to the next seat.
  They disappear from the table and the lobby.
- **R17. Everything about them is forgotten.** A removed player gets 0 points for that game, and
  their running score, losing streak and Joker status are dropped; they no longer appear on the
  scoreboard. Past games still count for everyone else. If they join again later they are a brand
  new player.
- **R18. Removal leaves only one player.** For that game's result the **removed player is the
  loser** and the remaining player takes the last winning place. As they've left (R17), there is no
  Joker next game: the host deals.

## Room & identity

- **R19. Room size.** 3–7 players. Late joiners wait for the next game.
- **R20. Joining.** 6-character room code + shareable link. The creator is host and starts games;
  host passes on if they leave.
- **R21. Identity.** Guests only: display name + random session token in localStorage. Streaks and
  scores are per room session.
- **R22. Seating order.** The lobby list is the seating order, and it is also the dealing order and
  the turn order (down the list, wrapping from the bottom back to the top). The host always sits at
  the top; only the host can rearrange the other players, and only between games. New players join
  at the bottom. If the host leaves, the next player in the order becomes host and moves to the top.
  In the first game and after a draw (no Joker), the **host deals**: the player below the host gets
  the first card and any extra cards go to the players right below the host.

- **R23. Host controls.** The host can, at any time:
  - **Remove** a player (red ✕ in the lobby). It works like Leave Room: they are out of the running
    game at once (R16–R18), out of the room, and forgotten; they can join again as a new player.
  - **Change host** to any connected player, who moves to the top of the seating order.
- **R24. Chat.** Everyone in the room can chat during games (one room chat, up to 300 characters per
  message). The chat lasts as long as the room; the last 100 messages are kept and sent to anyone
  who joins or comes back.
- **R25. Avatars & crowns.** Each player customizes an avatar: one of 6 face colours, 4 glasses
  (small square, round, wide, none) and 3 mouths (teeth, O, straight); the eyes are always two
  dots. It starts random and is remembered on that browser. The **spiky crown** marks the host. The
  **dotted crown** marks the last game's loser — the Joker who receives the Aces (R2) — until
  someone else loses or a draw resets it (R12).

## Engine edge decisions

Cases the rules above don't cover, decided so the engine is total. Change them here first.

- **E1. Joker absent.** If the Joker is not seated in the next game, that game is dealt by the host
  (R22) with no Aces assigned. Their streak is kept and counts if they lose later.
- **E2. Removed player's card decides a round.** A removed player's card stays on the table but
  they can never pick up or lead. In a cut, the highest led-suit card among remaining players picks
  up; if none of them played the led suit, the table is discarded and the cutter leads. If the
  player who has to take the cards (R5a) is removed before taking them, the next-highest led-suit
  player still in takes over; if there is none, the table is discarded and the cutter leads.
- **E3. Removal completes a round.** If removing a player means every remaining active player has
  now played, the round resolves as a fold immediately.
- **E4. Dealer with no Joker.** Superseded by R22: the host deals. (The engine only picks a
  random starting seat if it is called without a dealer, e.g. in simulations.)
