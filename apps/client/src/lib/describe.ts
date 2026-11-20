import { type GameEvent, type PlayerId, cardLabel } from '@ace/shared';

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** Plain-language description of a game event, used for the event log and screen readers. */
export function describeEvent(event: GameEvent, nameOf: (id: PlayerId) => string): string {
  switch (event.type) {
    case 'cardPlayed':
      return `${nameOf(event.playerId)} played ${cardLabel(event.card)}`;
    case 'roundCut': {
      const who = event.pickedUpBy
        ? `${nameOf(event.pickedUpBy)} picks up ${event.cards.length} cards`
        : 'the cards are discarded';
      return `${nameOf(event.cutBy)} cut the suit — ${who}`;
    }
    case 'roundFolded':
      return `Everyone followed suit — cards folded${event.nextLeader ? `; ${nameOf(event.nextLeader)} leads` : ''}`;
    case 'playersFinished': {
      const names = event.playerIds.map(nameOf).join(' and ');
      const tie = event.playerIds.length > 1 ? ' (tied)' : '';
      return `${names} finished ${ordinal(event.place)}${tie}`;
    }
    case 'playerGaveUp':
      return `${nameOf(event.playerId)} gave up`;
    case 'playerRemoved': {
      const n = Object.values(event.cardsReceived).reduce((a, b) => a + b, 0);
      return `${nameOf(event.playerId)} left the game${n ? ` — their ${n} cards were dealt to the others` : ''}`;
    }
    case 'gameOver':
      return event.outcome === 'draw'
        ? 'Game over — it’s a draw, no Donkey this time'
        : `Game over — ${nameOf(event.loser!)} is the Donkey`;
  }
}
