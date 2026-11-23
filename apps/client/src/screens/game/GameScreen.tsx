import { useState } from 'react';
import { DndContext, PointerSensor, type DragEndEvent, useSensor, useSensors } from '@dnd-kit/core';
import type { CardId } from '@ace/shared';
import { useGame } from '../../state/context';
import { ConfirmModal } from '../../ui/Modal';
import { RoomCode } from '../../ui/RoomCode';
import { darkSmallPill, smallPill } from '../../ui/buttons';
import { RulesModal } from '../RulesModal';
import { ChatRoom } from './ChatRoom';
import { GameTable, TABLE_DROP_ID } from './GameTable';
import { HandBar } from './HandBar';
import { Results } from './Results';
import { Scoreboard } from './Scoreboard';
import { WaitingButton } from './WaitingPopup';

/**
 * Game screen (wireframe): title + Rules on the left, room code + waiting list + Leave Room on the
 * right, the table and your hand filling the screen, then the scoreboard and chat below the fold.
 * When the game ends the Results overlay sits on top until "Back to Lobby".
 */
export function GameScreen({ showResults }: { showResults: boolean }) {
  const room = useGame((s) => s.update!.room);
  const avatar = useGame((s) => s.avatar);
  const handOrder = useGame((s) => s.handOrder);
  const selected = useGame((s) => s.selected);
  const select = useGame((s) => s.select);
  const playCard = useGame((s) => s.playCard);
  const playSelected = useGame((s) => s.playSelected);
  const moveSelection = useGame((s) => s.moveSelection);
  const moveCard = useGame((s) => s.moveCard);
  const sortHand = useGame((s) => s.sortHand);
  const giveUp = useGame((s) => s.giveUp);
  const takeCards = useGame((s) => s.takeCards);
  const leaveRoom = useGame((s) => s.leaveRoom);
  const [dialog, setDialog] = useState<'rules' | 'leave' | 'giveUp' | null>(null);

  // A small movement threshold keeps clicks and taps from turning into drags.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const game = room.game!;
  const me = room.players.find((p) => p.id === room.you);
  const myStatus = game.players.find((p) => p.id === game.you)?.status;
  const isMyTurn = !game.result && game.you !== null && game.turn === game.you;
  const myCrown = room.you === room.hostId ? 'host' : room.you === game.jokerId ? 'loser' : null;

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const card = active.id as CardId;
    if (over.id === TABLE_DROP_ID) void playCard(card);
    else if (over.id !== card) moveCard(card, handOrder.indexOf(over.id as CardId));
  };

  const message =
    game.you === null
      ? 'You’ll be dealt in when the next game starts.'
      : myStatus === 'finished'
        ? 'You’re safe — watch the others finish.'
        : myStatus === 'removed'
          ? 'You were removed from this game.'
          : undefined;

  return (
    <main className="mx-auto w-full max-w-1920 px-65 max-md:px-16">
      {/* Fills the screen: no scrolling needed to play. */}
      <div className="flex min-h-[calc(100dvh-var(--u)*188)] flex-col pb-24">
        {/* Above the table, which is pulled up under this row: only the two button groups take
            clicks, so the table stays reachable in between. */}
        <div className="pointer-events-none relative z-10 mt-24 flex flex-wrap items-start justify-between gap-16">
          <div className="pointer-events-auto">
            <h1 className="text-w40 leading-tight font-semibold">Ace / Donkey</h1>
            <button
              type="button"
              className={`${darkSmallPill} mt-8`}
              onClick={() => setDialog('rules')}
            >
              Rules
            </button>
          </div>
          <div className="pointer-events-auto flex flex-col items-end">
            <p className="flex items-center gap-14 text-w40 font-semibold">
              Room Code{' '}
              <RoomCode code={room.code} className="font-normal" iconClassName="h-34 w-26" />
            </p>
            <div className="mt-8 flex items-center gap-20">
              <WaitingButton room={room} />
              <button
                type="button"
                className={`${darkSmallPill} w-155`}
                onClick={() => setDialog('leave')}
              >
                Leave Room
              </button>
            </div>
          </div>
        </div>

        {/* Autoscroll off: the hand sits at the bottom edge and the page would slide to the scoreboard. */}
        <DndContext sensors={sensors} onDragEnd={onDragEnd} autoScroll={false}>
          <div className="-mt-60 flex flex-1 flex-col justify-end">
            <GameTable room={room} game={game} onTake={() => void takeCards()} />
            <div className="mt-24">
              <HandBar
                name={me?.name ?? ''}
                avatar={me?.avatar ?? avatar}
                crown={myCrown}
                cards={handOrder}
                playable={game.playable}
                selected={selected}
                isMyTurn={isMyTurn}
                onSelect={select}
                onPlay={(card) => void playCard(card)}
                onPlaySelected={() => void playSelected()}
                onMoveSelection={moveSelection}
                onMoveCard={moveCard}
                onSort={sortHand}
                message={message}
              />
            </div>
          </div>
        </DndContext>

        {!message && (
          <div className="mx-auto mt-12 flex w-1174 max-w-full justify-between px-226">
            <button
              type="button"
              className={smallPill}
              disabled={!isMyTurn || !selected}
              onClick={() => void playSelected()}
            >
              Play Selected Card
            </button>
            {game.canGiveUp && (
              <button type="button" className={smallPill} onClick={() => setDialog('giveUp')}>
                Give Up
              </button>
            )}
            <button type="button" className={smallPill} onClick={sortHand}>
              Sort By Suits
            </button>
          </div>
        )}
      </div>

      {/* Below the fold */}
      <div className="flex flex-wrap items-start justify-between gap-48 pt-40 pb-60">
        <Scoreboard room={room} className="mt-20" />
        <ChatRoom />
      </div>

      {showResults && game.result && <Results room={room} game={game} />}
      {dialog === 'rules' && <RulesModal onClose={() => setDialog(null)} />}
      {dialog === 'leave' && (
        <ConfirmModal
          title="Leave Room"
          message={
            myStatus === 'active'
              ? 'Leave now? Your cards will be dealt to the others and you’ll leave the room.'
              : 'Leave this room? You can come back with the room code as a new player.'
          }
          confirmLabel="Leave"
          onConfirm={() => void leaveRoom()}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'giveUp' && (
        <ConfirmModal
          title="Give Up"
          message="Give up and take the loss?"
          confirmLabel="Give Up"
          onConfirm={() => void giveUp()}
          onClose={() => setDialog(null)}
        />
      )}
    </main>
  );
}
