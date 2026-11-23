import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { PlayerId, RoomPlayerView, RoomView } from '@ace/shared';
import { useGame } from '../state/context';
import { Avatar } from '../ui/Avatar';
import { ConfirmModal } from '../ui/Modal';
import { RoomCode } from '../ui/RoomCode';
import { darkButton, lightButton } from '../ui/buttons';
import { cn } from '../ui/cn';
import { CrownIcon, DragHandleIcon, RemoveIcon } from '../ui/icons';
import { Countdown } from '../ui/Countdown';
import { CustomizeModal } from './CustomizeModal';
import { ChangeHostModal } from './ChangeHostModal';
import { RulesModal } from './RulesModal';

type Dialog = 'rules' | 'avatar' | 'host' | 'leave' | { kick: RoomPlayerView } | null;

/**
 * Lobby (wireframe: host and player POV). Left: the seating order — host on top with the crown;
 * the host can drag players (R22) and remove them (R23). Right: room code and actions.
 */
export function Lobby() {
  const room = useGame((s) => s.update!.room);
  const startGame = useGame((s) => s.startGame);
  const reorderPlayers = useGame((s) => s.reorderPlayers);
  const leaveRoom = useGame((s) => s.leaveRoom);
  const kickPlayer = useGame((s) => s.kickPlayer);
  const [dialog, setDialog] = useState<Dialog>(null);
  const isHost = room.you === room.hostId;

  // Local order while a drag waits for the server; reset when the server's order changes.
  const serverOrder = useMemo(() => room.players.map((p) => p.id), [room.players]);
  const [pending, setPending] = useState<PlayerId[] | null>(null);
  useEffect(() => setPending(null), [serverOrder]);
  const order = pending ?? serverOrder;
  const players = order
    .map((id) => room.players.find((p) => p.id === id))
    .filter((p) => p !== undefined);
  const [host, ...others] = players;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = order.indexOf(active.id as PlayerId);
    const to = order.indexOf(over.id as PlayerId);
    if (from <= 0 || to <= 0) return; // the host stays on top
    const next = arrayMove(order, from, to);
    setPending(next);
    void reorderPlayers(next).then((ok) => {
      if (!ok) setPending(null);
    });
  };

  const connected = room.players.filter((p) => p.connected).length;
  const status = room.canStart
    ? null
    : connected < room.minPlayers
      ? `Waiting for ${room.minPlayers - connected} more player${room.minPlayers - connected === 1 ? '' : 's'}`
      : isHost
        ? null
        : `Waiting for ${room.names[room.hostId] ?? 'the host'} to start`;

  return (
    <main className="mx-auto w-full max-w-1920 px-120 pb-60 max-md:px-24">
      <h1 className="mt-48 text-center text-w80 leading-tight font-semibold">Ace / Donkey</h1>

      <div className="-mt-6 flex flex-wrap justify-between gap-x-60 gap-y-48">
        <section aria-labelledby="lobby-heading" className="w-560">
          <h2 id="lobby-heading" className="text-w48 font-medium">
            Lobby
          </h2>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <ol aria-label="Seating order" className="mt-30 space-y-42">
              {host && <LobbyRow room={room} player={host} index={0} />}
              <SortableContext
                items={others.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                {others.map((p, i) => (
                  <LobbyRow
                    key={p.id}
                    room={room}
                    player={p}
                    index={i + 1}
                    hostControls={isHost}
                    onRemove={() => setDialog({ kick: p })}
                  />
                ))}
              </SortableContext>
            </ol>
          </DndContext>
        </section>

        <section
          aria-label="Room"
          className="mt-98 mr-176 flex w-580 flex-col items-center max-lg:mr-0"
        >
          <h2 className="text-w80 leading-tight font-semibold">Room Code</h2>
          <RoomCode code={room.code} className="mt-20 text-w80" iconClassName="h-60 w-46" />

          <div
            className={cn('mt-60 grid gap-x-28 gap-y-16', isHost ? 'grid-cols-2' : 'grid-cols-1')}
          >
            {isHost ? (
              <>
                {/* Start Game spans both columns; the other four sit below it in two rows. */}
                <button
                  type="button"
                  className={cn(lightButton, 'col-span-2 w-auto')}
                  disabled={!room.canStart}
                  onClick={() => void startGame()}
                >
                  Start Game
                </button>
                <button type="button" className={lightButton} onClick={() => setDialog('rules')}>
                  Rules
                </button>
                <button type="button" className={lightButton} onClick={() => setDialog('host')}>
                  Change Host
                </button>
                <button type="button" className={lightButton} onClick={() => setDialog('avatar')}>
                  Change Avatar
                </button>
                <button type="button" className={darkButton} onClick={() => setDialog('leave')}>
                  Leave Room
                </button>
              </>
            ) : (
              <>
                <button type="button" className={lightButton} onClick={() => setDialog('avatar')}>
                  Change Avatar
                </button>
                <button type="button" className={lightButton} onClick={() => setDialog('rules')}>
                  Rules
                </button>
                <button type="button" className={darkButton} onClick={() => setDialog('leave')}>
                  Leave Room
                </button>
              </>
            )}
          </div>
          {status && <p className="mt-24 text-w24 text-shade">{status}</p>}
        </section>
      </div>

      {dialog === 'rules' && <RulesModal onClose={() => setDialog(null)} />}
      {dialog === 'avatar' && <CustomizeModal onClose={() => setDialog(null)} />}
      {dialog === 'host' && <ChangeHostModal onClose={() => setDialog(null)} />}
      {dialog === 'leave' && (
        <ConfirmModal
          title="Leave Room"
          message="Leave this room? You can come back with the room code as a new player."
          confirmLabel="Leave"
          onConfirm={() => void leaveRoom()}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog && typeof dialog === 'object' && (
        <ConfirmModal
          title="Remove Player"
          message={`Remove ${dialog.kick.name} from the room? They can join again as a new player.`}
          confirmLabel="Remove"
          onConfirm={() => void kickPlayer(dialog.kick.id)}
          onClose={() => setDialog(null)}
        />
      )}
    </main>
  );
}

function LobbyRow({
  room,
  player,
  index,
  hostControls = false,
  onRemove,
}: {
  room: RoomView;
  player: RoomPlayerView;
  index: number;
  hostControls?: boolean;
  onRemove?(): void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: player.id,
    disabled: !hostControls,
  });

  return (
    <li
      ref={hostControls ? setNodeRef : undefined}
      style={
        hostControls ? { transform: CSS.Transform.toString(transform), transition } : undefined
      }
      data-player={player.name}
      className={cn('flex items-center', isDragging && 'relative z-10')}
    >
      <div
        className={cn(
          'relative flex h-48 w-410 shrink-0 items-center rounded-pill bg-bar pl-24',
          isDragging && 'shadow-lg',
          !player.connected && 'opacity-60',
        )}
      >
        <span className="w-42 text-w30 font-light">{index + 1}.</span>
        <span className="min-w-0 truncate text-w30 font-semibold">
          {player.name}
          {player.id === room.you && <span className="sr-only"> (you)</span>}
        </span>
        {player.isHost && (
          <>
            <CrownIcon className="ml-10 h-18 w-26 shrink-0" />
            <span className="sr-only">, host</span>
          </>
        )}
        {player.isJoker && <span className="sr-only">, lost last game</span>}
        {!player.connected && player.disconnectDeadline && (
          <span className="ml-10 text-w18 whitespace-nowrap text-shade">
            away <Countdown deadline={player.disconnectDeadline} />
          </span>
        )}
        <Avatar
          avatar={player.avatar}
          size={68}
          crown={player.isJoker ? 'loser' : null}
          className="absolute top-1/2 left-274 -translate-y-1/2"
        />
      </div>
      {hostControls && (
        <>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${player.name}`}
            className="ml-30 p-6 text-remove"
          >
            <RemoveIcon className="size-18" />
          </button>
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Move ${player.name}`}
            className="ml-20 cursor-grab touch-none p-6 active:cursor-grabbing"
          >
            <DragHandleIcon className="h-24 w-14" />
          </button>
        </>
      )}
    </li>
  );
}
