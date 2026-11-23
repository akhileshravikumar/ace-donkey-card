import { useDndContext, useDroppable } from '@dnd-kit/core';
import { DEFAULT_AVATAR, cardName, type GameView, type PlayerId, type RoomView } from '@ace/shared';
import { offset, tableShape, toSvgPoints } from '../../lib/tableGeometry';
import { Avatar, type CrownKind } from '../../ui/Avatar';
import { CardImage } from '../../ui/CardImage';
import { Countdown } from '../../ui/Countdown';
import { cn } from '../../ui/cn';
import { CardOutlineIcon, TurnPin } from '../../ui/icons';

export const TABLE_DROP_ID = 'table';

// Stage size and table proportions in wireframe pixels (the 7-player wireframe's table is ~646 wide).
const W = 900;
const H = 590;
const CX = W / 2;
const CY = 300;
const RX = 330;
const RY = 262;
const EDGE = 34; // the darker "thickness" under the table top

/**
 * The table from the game wireframe: one side per player, you at the bottom edge, everyone else
 * clockwise in turn order. Each seat shows the avatar (crown for host / last loser), a card-count
 * badge and — for whoever's turn it is — a pin. Cards played this round sit in the middle, each
 * pushed toward the player who played it. The whole stage is the drop target for playing a card.
 * After a cut the cards stay put until the player picking up presses Take Cards (R5a), shown to
 * them beside the table.
 */
export function GameTable({
  room,
  game,
  onTake,
}: {
  room: RoomView;
  game: GameView;
  onTake(): void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: TABLE_DROP_ID });
  const { active } = useDndContext();
  const dragging = active !== null && !game.result && game.turn === game.you;

  // Players who left (R16) are gone from the table. Rotate so the viewer sits at the bottom.
  const present = game.players.filter((p) => p.status !== 'removed');
  const base = Math.max(
    0,
    present.findIndex((p) => p.id === (game.you ?? present[0]?.id)),
  );
  const seats = present.map((_, i) => present[(base + i) % present.length]!);
  const shape = tableShape(seats.length, CX, CY, RX, RY);
  const seatIndex = new Map(seats.map((p, i) => [p.id, i]));
  // You sit just inside the bottom edge, everyone else just outside theirs.
  const seatPos = seats.map((_, i) =>
    offset(shape.edgeMidpoints[i]!, shape.seatAngles[i]!, i === 0 ? -64 : 26),
  );
  // Played cards go 40% of the way toward their player, so small tables (triangle) don't cover the seats.
  const cardDistance = (i: number) =>
    Math.min(92, 0.4 * Math.hypot(seatPos[i]!.x - shape.center.x, seatPos[i]!.y - shape.center.y));
  const jokerId = game.jokerId;
  const tableRight = Math.max(...shape.vertices.map((v) => v.x));

  const crownFor = (id: PlayerId): CrownKind =>
    id === room.hostId ? 'host' : id === jokerId ? 'loser' : null;
  const nameOf = (id: PlayerId) => room.names[id] ?? 'Someone';

  return (
    <section
      aria-labelledby="table-heading"
      className="relative mx-auto"
      style={{ width: `calc(var(--u) * ${W})`, height: `calc(var(--u) * ${H})` }}
    >
      <h2 id="table-heading" className="sr-only">
        Table
      </h2>
      <div
        ref={setNodeRef}
        data-drop-target={isOver || undefined}
        className="absolute inset-0"
        aria-label={dragging ? 'Drop here to play' : undefined}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" aria-hidden>
          <polygon
            points={toSvgPoints(shape.vertices.map((v) => ({ x: v.x, y: v.y + EDGE })))}
            fill="var(--color-shade)"
          />
          <polygon
            points={toSvgPoints(shape.vertices)}
            fill="var(--color-bar)"
            stroke={isOver ? 'var(--color-button)' : dragging ? 'var(--color-mid)' : 'none'}
            strokeWidth={isOver ? 8 : 4}
            strokeLinejoin="round"
          />
        </svg>

        {/* Cards played this round, each nudged toward its player. */}
        <ol aria-label="Cards on the table" className="absolute inset-0">
          {game.table.map((t) => {
            const i = seatIndex.get(t.playerId) ?? 0;
            const angle = shape.seatAngles[i] ?? 90;
            const p = offset(shape.center, angle, cardDistance(i));
            return (
              <li
                key={t.card}
                className="absolute"
                style={{
                  left: `calc(var(--u) * ${p.x})`,
                  top: `calc(var(--u) * ${p.y})`,
                  transform: `translate(-50%, -50%) rotate(${angle - 90}deg)`,
                }}
              >
                <CardImage
                  card={t.card}
                  decorative
                  className="w-72 rounded-[calc(var(--u)*6)] shadow"
                />
                <span className="sr-only">
                  {nameOf(t.playerId)}: {cardName(t.card)}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {game.mustTake && (
        <button
          type="button"
          onClick={onTake}
          className="absolute h-56 -translate-y-1/2 rounded-pill bg-button px-28 text-w30 whitespace-nowrap text-white transition hover:brightness-125"
          style={{
            left: `calc(var(--u) * ${tableRight + 90})`,
            top: `calc(var(--u) * ${shape.center.y})`,
          }}
        >
          Take Cards
        </button>
      )}
      {game.pendingCut && !game.mustTake && (
        <p className="sr-only" role="status">
          Waiting for {nameOf(game.pendingCut.pickerId)} to take the cards.
        </p>
      )}

      <ol aria-label="Players" className="pointer-events-none absolute inset-0">
        {seats.map((player, i) => {
          const pos = seatPos[i]!;
          const roomPlayer = room.players.find((p) => p.id === player.id);
          const isTurn = game.turn === player.id;
          return (
            <li
              key={player.id}
              data-seat={nameOf(player.id)}
              aria-current={isTurn ? 'true' : undefined}
              title={nameOf(player.id)}
              className="pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ left: `calc(var(--u) * ${pos.x})`, top: `calc(var(--u) * ${pos.y})` }}
            >
              <span className="sr-only">
                {nameOf(player.id)}
                {player.id === game.you ? ' (you)' : ''}
                {isTurn ? ', their turn' : ''}
                {player.id === room.hostId ? ', host' : ''}
                {player.id === jokerId ? ', lost last game' : ''}, {player.cardCount} cards
                {player.status === 'finished' ? ', finished' : ''}
              </span>
              <TurnPin className={cn('mb-6 h-26 w-20 text-mid', !isTurn && 'invisible')} />
              <span
                aria-hidden
                className="mb-10 flex h-22 items-center gap-5 rounded-[calc(var(--u)*5)] bg-mid px-6 text-w14 text-white"
              >
                <CardOutlineIcon className="h-15 w-12" />
                {player.cardCount}
              </span>
              <Avatar
                avatar={roomPlayer?.avatar ?? DEFAULT_AVATAR}
                size={56}
                crown={crownFor(player.id)}
                className={cn(player.status === 'finished' && 'opacity-50')}
              />
              {roomPlayer && !roomPlayer.connected && roomPlayer.disconnectDeadline && (
                <span className="mt-6 rounded-pill bg-bar px-8 text-w14 text-shade">
                  away <Countdown deadline={roomPlayer.disconnectDeadline} />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
