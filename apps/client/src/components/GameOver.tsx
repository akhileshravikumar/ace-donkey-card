import type { GameView, RoomView } from '@ace/shared';
import { ordinal } from '../lib/describe';
import { useGame } from '../state/context';
import { Avatar, Button, Panel } from './ui';

/** Result of the game just played, plus the host's button for the next game. */
export function GameOver({ room, game }: { room: RoomView; game: GameView }) {
  const startGame = useGame((s) => s.startGame);
  const result = game.result!;
  const nameOf = (id: string) => room.names[id] ?? 'Someone';
  const removed = game.players.filter((p) => p.status === 'removed' && p.id !== game.loser);
  let position = 1;

  return (
    <Panel className="w-full max-w-md space-y-4">
      <div className="text-center">
        <p className="text-xs tracking-wider text-muted uppercase">Game over</p>
        <h2 id="result-heading" className="mt-1 text-2xl font-bold">
          {result.outcome === 'draw' ? 'Draw!' : `${nameOf(game.loser!)} is the Donkey`}
        </h2>
        {result.outcome === 'draw' && (
          <p className="text-sm text-muted">No loser this time — the Joker resets.</p>
        )}
      </div>
      <ol className="divide-y divide-line rounded-xl border border-line">
        {game.placings.map((group) => {
          const place = position;
          position += group.length;
          return (
            <li key={group.join()} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-10 text-sm font-semibold text-accent">
                {ordinal(place)}
                {group.length > 1 ? '=' : ''}
              </span>
              <span className="flex flex-1 flex-wrap items-center gap-2">
                {group.map((id) => (
                  <span key={id} className="inline-flex items-center gap-1.5">
                    <Avatar name={nameOf(id)} />
                    {nameOf(id)}
                  </span>
                ))}
              </span>
              <span className="text-sm font-semibold">
                {result.points[group[0]!]} {result.points[group[0]!] === 1 ? 'pt' : 'pts'}
              </span>
            </li>
          );
        })}
        {game.loser && (
          <li className="flex items-center gap-3 bg-danger/10 px-4 py-2.5">
            <span className="w-10 text-xs font-semibold text-danger uppercase">Last</span>
            <span className="flex flex-1 items-center gap-1.5">
              <Avatar name={nameOf(game.loser)} />
              {nameOf(game.loser)}
              {result.reason === 'giveUp' && <span className="text-xs text-muted">(gave up)</span>}
              {result.reason === 'removal' && <span className="text-xs text-muted">(left)</span>}
            </span>
            <span className="text-sm font-semibold">0 pts</span>
          </li>
        )}
      </ol>
      {removed.length > 0 && (
        <p className="text-sm text-muted">
          Removed (0 pts): {removed.map((p) => nameOf(p.id)).join(', ')}
        </p>
      )}
      {room.canStart ? (
        <Button
          variant="primary"
          className="w-full py-3 text-base"
          onClick={() => void startGame()}
        >
          Start next game
        </Button>
      ) : (
        <p className="text-center text-sm text-muted">
          Waiting for the host to start the next game.
        </p>
      )}
    </Panel>
  );
}
