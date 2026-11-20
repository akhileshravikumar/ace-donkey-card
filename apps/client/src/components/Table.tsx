import type { ReactNode } from 'react';
import { useDndContext, useDroppable } from '@dnd-kit/core';
import { type GameView, type PlayerId, type RoomView, SUIT_NAME, SUIT_SYMBOL } from '@ace/shared';
import { ordinal } from '../lib/describe';
import { CardImage } from './CardImage';
import { PlayerBadges } from './PlayerBadges';
import { Avatar, Badge, CardBack, cn } from './ui';

export const TABLE_DROP_ID = 'table';

/**
 * The card table: players seated around an oval (you at the bottom, then clockwise in play
 * order), the current round's cards in the middle. The felt is the drop target for playing a
 * dragged card. On small screens the seats collapse into a list above the felt.
 */
export function Table({
  room,
  game,
  overlay,
}: {
  room: RoomView;
  game: GameView;
  overlay?: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: TABLE_DROP_ID });
  const { active } = useDndContext();
  const dragging = active !== null && !game.result && game.turn === game.you;
  const nameOf = (id: PlayerId) => room.names[id] ?? 'Someone';

  // Rotate seats so the viewer sits at the bottom.
  const base = Math.max(
    0,
    game.players.findIndex((p) => p.id === (game.you ?? game.players[0]?.id)),
  );
  const seats = game.players.map((_, i) => game.players[(base + i) % game.players.length]!);

  return (
    <section aria-labelledby="table-heading" className="relative">
      <h2 id="seats-heading" className="sr-only">
        Players
      </h2>

      {/* Small screens: seats as a list */}
      <ol
        aria-labelledby="seats-heading"
        className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:hidden"
      >
        {seats.map((p) => (
          <li key={p.id}>
            <Seat room={room} game={game} id={p.id} />
          </li>
        ))}
      </ol>

      <div className="relative md:aspect-[16/9] md:min-h-[26rem]">
        {/* The felt */}
        <div
          ref={setNodeRef}
          data-drop-target={isOver || undefined}
          className={cn(
            'relative flex min-h-56 flex-col items-center justify-center gap-3 rounded-[3rem] border-[10px] border-felt-edge bg-felt p-6 shadow-[inset_0_0_60px_rgba(0,0,0,0.55)] transition',
            'md:absolute md:inset-x-[9%] md:inset-y-[13%] md:rounded-[50%]',
            dragging && 'ring-4 ring-accent/40',
            isOver && 'ring-accent ring-4',
          )}
        >
          <h2
            id="table-heading"
            className="text-center text-xs font-semibold tracking-wider text-white/70 uppercase"
          >
            Table — round {game.roundNo}
            {game.ledSuit && ` — ${SUIT_SYMBOL[game.ledSuit]} ${SUIT_NAME[game.ledSuit]} led`}
          </h2>

          {game.table.length === 0 ? (
            <p className="text-center text-sm text-white/70">
              {game.result
                ? 'Game over'
                : game.turn === game.you
                  ? 'Your lead — play any card'
                  : `Waiting for ${nameOf(game.turn ?? '')} to lead`}
            </p>
          ) : (
            <ol className="flex flex-wrap items-end justify-center gap-3">
              {game.table.map((t, i) => (
                <li key={t.card} className="flex flex-col items-center gap-1">
                  <CardImage
                    card={t.card}
                    className={cn(
                      'w-16 lg:w-20',
                      i === game.table.length - 1 && 'ring-2 ring-accent',
                    )}
                  />
                  <span className="max-w-20 truncate text-xs text-white/80">
                    {nameOf(t.playerId)}
                  </span>
                </li>
              ))}
            </ol>
          )}

          <p className="text-xs text-white/50">
            {dragging
              ? 'Drop here to play'
              : `${game.discardedCount} card${game.discardedCount === 1 ? '' : 's'} folded`}
          </p>
        </div>

        {/* Desktop: seats around the oval */}
        <ol aria-labelledby="seats-heading" className="hidden md:block">
          {seats.map((p, i) => {
            const angle = ((90 + (i * 360) / seats.length) * Math.PI) / 180;
            const left = 50 + 44 * Math.cos(angle);
            const top = 50 + 43 * Math.sin(angle);
            return (
              <li
                key={p.id}
                className="absolute w-44 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${left}%`, top: `${top}%` }}
              >
                <Seat room={room} game={game} id={p.id} />
              </li>
            );
          })}
        </ol>

        {overlay && (
          <div className="z-10 mt-4 grid place-items-center md:absolute md:inset-0 md:mt-0 md:rounded-3xl md:bg-black/55 md:p-4 md:backdrop-blur-sm">
            {overlay}
          </div>
        )}
      </div>
    </section>
  );
}

function Seat({ room, game, id }: { room: RoomView; game: GameView; id: PlayerId }) {
  const player = game.players.find((p) => p.id === id)!;
  const name = room.names[id] ?? 'Someone';
  const isTurn = game.turn === id;
  const place = placeOf(game, id);
  const starting =
    game.starter === id && game.roundNo === 1 && game.table.length === 0 && !game.result;

  return (
    <div
      aria-current={isTurn ? 'true' : undefined}
      className={cn(
        'rounded-xl border bg-surface/95 px-3 py-2 shadow-lg transition',
        isTurn ? 'border-accent shadow-accent/20 ring-2 ring-accent' : 'border-line',
        player.status === 'removed' && 'opacity-50',
      )}
    >
      <div className="flex items-center gap-2">
        <Avatar name={name} active={isTurn} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {isTurn && <span className="sr-only">Current turn: </span>}
            {name}
            {id === game.you && <span className="font-normal text-muted"> (you)</span>}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <CardBack /> {player.cardCount} card{player.cardCount === 1 ? '' : 's'}
          </p>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1 empty:hidden">
        <PlayerBadges room={room} id={id} />
        {starting && <Badge tone="accent">starts · A♠</Badge>}
        {player.status === 'finished' && place !== null && (
          <Badge tone="ok">finished {ordinal(place)}</Badge>
        )}
        {player.status === 'removed' && game.loser !== id && <Badge tone="danger">removed</Badge>}
        {game.loser === id && <Badge tone="danger">Donkey</Badge>}
      </div>
    </div>
  );
}

function placeOf(game: GameView, id: PlayerId): number | null {
  let position = 1;
  for (const group of game.placings) {
    if (group.includes(id)) return position;
    position += group.length;
  }
  return null;
}
