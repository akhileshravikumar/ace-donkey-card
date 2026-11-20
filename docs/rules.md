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

- **R3. Starter.** The A♠ holder starts and may lead any card. After a loss that's always the Joker.

## Playing a round

- **R4. Follow suit.** Players must follow the led suit if they can; otherwise they may play any card.
- **R5. Cut.** An off-suit card ends the round immediately. The player with the highest card **of
  the led suit** picks up every table card and leads the next round.
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
  play waits.
- **R16. Removal.** After 60 s (or if the player leaves voluntarily) the player is removed and their
  hand is dealt round-robin to the remaining active players, starting with the next seat. A card
  they already played stays on the table. If it was their turn, the turn passes to the next seat.
- **R17. Removed with 3+ players remaining.** 0 points for this game, streak resets to 0, earlier
  games' points still count. They can rejoin for the next game.
- **R18. Removal leaves only one player.** The **removed player is the loser** (streak +1, Joker
  next game if they rejoin). The remaining player takes the last winning place.

## Room & identity

- **R19. Room size.** 3–7 players. Late joiners wait for the next game.
- **R20. Joining.** 6-character room code + shareable link. The creator is host and starts games;
  host passes on if they leave.
- **R21. Identity.** Guests only: display name + random session token in localStorage. Streaks and
  scores are per room session.

## Engine edge decisions

Cases the rules above don't cover, decided so the engine is total. Change them here first.

- **E1. Joker absent.** If the Joker is not seated in the next game, that game is dealt normally
  (no Aces assigned). Their streak is kept and counts if they lose later.
- **E2. Removed player's card decides a round.** A removed player's card stays on the table but
  they can never pick up or lead. In a cut, the highest led-suit card among remaining players picks
  up; if none of them played the led suit, the table is discarded and the cutter leads.
- **E3. Removal completes a round.** If removing a player means every remaining active player has
  now played, the round resolves as a fold immediately.
- **E4. Extra cards (R1).** When 52 doesn't divide evenly, which players receive the extra card is
  chosen at random by the server.
