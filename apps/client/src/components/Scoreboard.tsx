import type { RoomView } from '@ace/shared';
import { Panel, cn } from './ui';

/** Rankings, totals, streaks and per-game points for the whole room session. */
export function Scoreboard({ room }: { room: RoomView }) {
  const ids = Object.keys(room.names);
  const total = (id: string) => room.history.reduce((sum, g) => sum + (g.points[id] ?? 0), 0);
  const streak = (id: string) =>
    room.players.find((p) => p.id === id)?.streak ?? room.history.at(-1)?.streaksAfter[id] ?? 0;
  const ranked = [...ids].sort((a, b) => total(b) - total(a));
  const recent = room.history.slice(-5); // keep the table narrow; totals cover every game

  const cell = (gameNo: number, id: string) => {
    const g = room.history[gameNo - 1]!;
    if (!g.seats.includes(id)) return { text: '—', tone: 'text-muted' };
    const pts = String(g.points[id] ?? 0);
    if (g.loser === id) return { text: `${pts}·L`, tone: 'text-danger' };
    if (g.removed.includes(id)) return { text: `${pts}·left`, tone: 'text-muted' };
    if (g.outcome === 'draw' && g.placings.at(-1)?.includes(id))
      return { text: `${pts}·D`, tone: 'text-joker' };
    return { text: pts, tone: '' };
  };

  return (
    <section aria-labelledby="scoreboard-heading">
      <Panel className="p-4">
        <h2
          id="scoreboard-heading"
          className="mb-3 flex items-baseline justify-between text-sm font-semibold"
        >
          Scoreboard
          <span className="text-xs font-normal text-muted">
            {room.history.length} game{room.history.length === 1 ? '' : 's'}
          </span>
        </h2>
        <div className="overflow-x-auto">
          <table aria-labelledby="scoreboard-heading" className="w-full text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                <th scope="col" className="py-1.5 pr-2 text-left font-medium">
                  #
                </th>
                <th scope="col" className="py-1.5 pr-2 text-left font-medium">
                  Player
                </th>
                <th scope="col" className="py-1.5 pr-2 text-right font-medium">
                  Pts
                </th>
                <th
                  scope="col"
                  className="py-1.5 pr-2 text-right font-medium"
                  title="Losing streak"
                >
                  Streak
                </th>
                {recent.map((g) => (
                  <th scope="col" key={g.gameNo} className="py-1.5 pl-2 text-right font-medium">
                    G{g.gameNo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranked.map((id, i) => (
                <tr
                  key={id}
                  className={cn(
                    'border-b border-line/50 last:border-0',
                    id === room.you && 'bg-accent/5',
                  )}
                >
                  <td className="py-1.5 pr-2 text-muted">
                    {i > 0 && total(ranked[i - 1]!) === total(id) ? '=' : i + 1}
                  </td>
                  <th scope="row" className="max-w-28 truncate py-1.5 pr-2 text-left font-medium">
                    {room.names[id]}
                  </th>
                  <td className="py-1.5 pr-2 text-right font-semibold">{total(id)}</td>
                  <td className={cn('py-1.5 pr-2 text-right', streak(id) > 0 && 'text-joker')}>
                    {streak(id)}
                  </td>
                  {recent.map((g) => {
                    const c = cell(g.gameNo, id);
                    return (
                      <td
                        key={g.gameNo}
                        className={cn('py-1.5 pl-2 text-right tabular-nums', c.tone)}
                      >
                        {c.text}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {room.history.length > 0 && (
          <p className="mt-2 text-xs text-muted">L = Donkey · D = draw</p>
        )}
      </Panel>
    </section>
  );
}
