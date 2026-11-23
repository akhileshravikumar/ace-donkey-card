import { type CardId, type PlayerId, type RoomView, jokerAcesForStreak } from '@ace/shared';

export interface PlayerStats {
  points: number;
  /** Games finished without being the loser (R10: everyone but the loser wins). */
  wins: number;
  /** Games lost. */
  losses: number;
  /** Aces their current losing streak gives them next game (R2). */
  aces: CardId[];
}

/** Scoreboard numbers for a player still in the room, from the room's game history. */
export function playerStats(room: RoomView, id: PlayerId): PlayerStats {
  let points = 0;
  let wins = 0;
  let losses = 0;
  for (const g of room.history) {
    if (!g.seats.includes(id)) continue;
    points += g.points[id] ?? 0;
    if (g.loser === id) losses++;
    else if (!g.removed.includes(id)) wins++;
  }
  const streak = room.players.find((p) => p.id === id)?.streak ?? 0;
  return { points, wins, losses, aces: jokerAcesForStreak(streak) };
}
