import { useGame } from '../state/context';
import { PlayerBadges } from './PlayerBadges';
import { Avatar, Button, Panel } from './ui';

/** Waiting room: who's here, and the host's Start button. */
export function Lobby() {
  const room = useGame((s) => s.update!.room);
  const startGame = useGame((s) => s.startGame);
  const connectedCount = room.players.filter((p) => p.connected).length;
  const missing = Math.max(0, room.minPlayers - connectedCount);

  return (
    <section aria-labelledby="lobby-heading" className="mx-auto mt-6 max-w-xl">
      <Panel className="space-y-5 p-8">
        <div className="flex items-baseline justify-between">
          <h2 id="lobby-heading" className="text-2xl font-bold">
            Lobby
          </h2>
          <span className="text-sm text-muted">
            {connectedCount} / {room.maxPlayers} players
          </span>
        </div>

        <ul className="divide-y divide-line rounded-xl border border-line">
          {room.players.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={p.name} active={p.id === room.you} />
              <span className="font-medium">
                {p.name}
                {p.id === room.you && <span className="text-muted"> (you)</span>}
              </span>
              <span className="ml-auto flex flex-wrap justify-end gap-1">
                <PlayerBadges room={room} id={p.id} />
              </span>
            </li>
          ))}
          {Array.from({ length: Math.max(0, room.minPlayers - room.players.length) }, (_, i) => (
            <li key={`empty-${i}`} className="px-4 py-3 text-sm text-muted italic">
              Waiting for a player…
            </li>
          ))}
        </ul>

        {room.canStart ? (
          <Button
            variant="primary"
            className="w-full py-3 text-base"
            onClick={() => void startGame()}
          >
            Start game
          </Button>
        ) : (
          <p className="text-center text-sm text-muted">
            {missing > 0
              ? `Waiting for ${missing} more player${missing === 1 ? '' : 's'}.`
              : 'Waiting for the host to start the game.'}
          </p>
        )}
      </Panel>
    </section>
  );
}
