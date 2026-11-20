import { type PlayerId, type RoomView, cardLabel, jokerAcesForStreak } from '@ace/shared';
import { Countdown } from './Countdown';
import { Badge } from './ui';

/**
 * Room-level status chips for a player: host, Joker (streak + Aces, R2), connection.
 * During a game the Joker is whoever was dealt the Aces; between games it's the last loser,
 * who gets Aces in the next deal.
 */
export function PlayerBadges({ room, id }: { room: RoomView; id: PlayerId }) {
  const p = room.players.find((x) => x.id === id);
  if (!p) return <Badge>left</Badge>;
  const playing = room.phase === 'playing';
  const isJoker = playing ? room.game?.jokerId === id : p.isJoker;
  const aces = playing ? (room.game?.jokerAces ?? []) : jokerAcesForStreak(p.streak);

  return (
    <>
      {p.isHost && <Badge>host</Badge>}
      {isJoker && (
        <Badge tone="joker">
          Joker · {p.streak} loss{p.streak === 1 ? '' : 'es'} · {playing ? 'holds' : 'gets'}{' '}
          {aces.map(cardLabel).join(' ')}
        </Badge>
      )}
      {!p.connected &&
        (p.disconnectDeadline ? (
          <Badge tone="danger">
            reconnecting <Countdown deadline={p.disconnectDeadline} />
          </Badge>
        ) : (
          <Badge tone="danger">offline</Badge>
        ))}
    </>
  );
}
