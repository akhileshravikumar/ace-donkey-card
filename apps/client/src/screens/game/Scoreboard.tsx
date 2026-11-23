import type { RoomView } from '@ace/shared';
import { playerStats } from '../../lib/stats';
import { Avatar } from '../../ui/Avatar';
import { cn } from '../../ui/cn';
import { CrownIcon, SuitIcon } from '../../ui/icons';

const ACE_SUITS = ['S', 'C', 'D', 'H'] as const;

// Column centres from the wireframe (relative to the row's left edge).
const COL = 'w-82 shrink-0 text-center';

/**
 * Scoreboard from the wireframe, in seating order: points, W (games not lost), L (games lost) and
 * the Aces the current losing streak gives (filled = earned). Last game's loser has a striped row
 * and the dotted crown; your own row is dark; the host has the crown.
 */
export function Scoreboard({ room, className }: { room: RoomView; className?: string }) {
  const lastLoser = room.history.at(-1)?.loser ?? null;

  return (
    <section aria-labelledby="scoreboard-heading" className={cn('w-822 max-w-full', className)}>
      <div className="flex items-end text-w40">
        <h2 id="scoreboard-heading" className="flex-1 pl-5 font-semibold">
          Scoreboard
        </h2>
        <span aria-hidden className="flex font-light">
          <span className={COL}>Pts</span>
          <span className={COL}>W</span>
          <span className={COL}>L</span>
          <span className="w-158 shrink-0 pl-28">Aces</span>
        </span>
      </div>

      <ol className="mt-30 space-y-50">
        {room.players.map((p, i) => {
          const stats = playerStats(room, p.id);
          const you = p.id === room.you;
          const loser = p.id === lastLoser && p.isJoker;
          return (
            <li
              key={p.id}
              data-player={p.name}
              className={cn(
                'relative flex h-48 items-center rounded-pill pl-24',
                you ? 'bg-shade text-white' : 'bg-bar',
                loser &&
                  (you
                    ? 'bg-[repeating-linear-gradient(115deg,var(--color-shade)_0_calc(var(--u)*30),#555_calc(var(--u)*30)_calc(var(--u)*48))]'
                    : 'bg-[repeating-linear-gradient(115deg,#f4f4f4_0_calc(var(--u)*30),var(--color-bar)_calc(var(--u)*30)_calc(var(--u)*56))]'),
              )}
            >
              <span className="w-44 shrink-0 text-w30 font-light">{i + 1}.</span>
              <span className="min-w-0 flex-1 truncate text-w30 font-semibold">
                {p.name}
                {p.isHost && <CrownIcon className="ml-10 inline h-18 w-26 align-baseline" />}
                {p.isHost && <span className="sr-only">, host</span>}
                {loser && <span className="sr-only">, lost last game</span>}
                {you && <span className="sr-only"> (you)</span>}
              </span>
              <Avatar
                avatar={p.avatar}
                size={68}
                crown={p.isHost ? 'host' : p.isJoker ? 'loser' : null}
                className="absolute top-1/2 left-270 -translate-y-1/2"
              />
              <span className="flex text-w40 font-light">
                <span className={COL}>
                  <span className="sr-only">Points </span>
                  {stats.points}
                </span>
                <span className={COL}>
                  <span className="sr-only">Wins </span>
                  {stats.wins}
                </span>
                <span className={COL}>
                  <span className="sr-only">Losses </span>
                  {stats.losses}
                </span>
                <span className="flex w-158 shrink-0 items-center gap-4 pl-28">
                  <span className="sr-only">{stats.aces.length} Aces</span>
                  {ACE_SUITS.map((suit, k) => (
                    <SuitIcon
                      key={suit}
                      suit={suit}
                      className={cn(
                        'size-24',
                        k < stats.aces.length
                          ? you
                            ? 'text-white'
                            : 'text-black'
                          : you
                            ? 'text-white/40'
                            : 'text-mid/60',
                      )}
                    />
                  ))}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
