import { useState } from 'react';
import { DndContext, PointerSensor, type DragEndEvent, useSensor, useSensors } from '@dnd-kit/core';
import { type CardId, SUIT_NAME, SUIT_SYMBOL } from '@ace/shared';
import { useGame } from '../state/context';
import { EventLog } from './EventLog';
import { GameOver } from './GameOver';
import { Hand } from './Hand';
import { Scoreboard } from './Scoreboard';
import { TABLE_DROP_ID, Table } from './Table';
import { Button, Panel } from './ui';

export function GameScreen() {
  const room = useGame((s) => s.update!.room);
  const handOrder = useGame((s) => s.handOrder);
  const selected = useGame((s) => s.selected);
  const select = useGame((s) => s.select);
  const playCard = useGame((s) => s.playCard);
  const playSelected = useGame((s) => s.playSelected);
  const moveSelection = useGame((s) => s.moveSelection);
  const moveCard = useGame((s) => s.moveCard);
  const sortHand = useGame((s) => s.sortHand);
  const giveUp = useGame((s) => s.giveUp);
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);

  // A small movement threshold keeps clicks and taps from turning into drags.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const game = room.game!;
  const isMyTurn = !game.result && game.you !== null && game.turn === game.you;
  const myStatus = game.players.find((p) => p.id === game.you)?.status;
  const nameOf = (id: string | null) => (id ? (room.names[id] ?? 'Someone') : '');

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const card = active.id as CardId;
    if (over.id === TABLE_DROP_ID) void playCard(card);
    else if (over.id !== card) moveCard(card, handOrder.indexOf(over.id as CardId));
  };

  const status = isMyTurn
    ? game.ledSuit
      ? game.playable.some((c) => c[1] === game.ledSuit)
        ? `Follow suit: play a ${SUIT_SYMBOL[game.ledSuit]} ${SUIT_NAME[game.ledSuit].slice(0, -1)}`
        : `No ${SUIT_NAME[game.ledSuit].toLowerCase()} — you can cut with any card`
      : 'You lead — play any card'
    : `Waiting for ${nameOf(game.turn)}…`;

  const giveUpControl =
    game.canGiveUp &&
    (confirmGiveUp ? (
      <span className="flex items-center gap-2 text-sm">
        Take the loss?
        <Button variant="danger" onClick={() => void giveUp().then(() => setConfirmGiveUp(false))}>
          Yes, give up
        </Button>
        <Button variant="ghost" onClick={() => setConfirmGiveUp(false)}>
          Keep playing
        </Button>
      </span>
    ) : (
      <Button variant="danger" onClick={() => setConfirmGiveUp(true)}>
        Give up
      </Button>
    ));

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <Table
            room={room}
            game={game}
            overlay={game.result ? <GameOver room={room} game={game} /> : undefined}
          />
          {game.you === null ? (
            <Panel className="text-center text-muted">
              You’ll be dealt in when the next game starts.
            </Panel>
          ) : !game.result && myStatus === 'active' ? (
            <Hand
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
              status={status}
              actions={giveUpControl}
            />
          ) : (
            !game.result && (
              <Panel className="text-center text-muted">
                {myStatus === 'finished'
                  ? 'You’re out — nice! Watch the others finish.'
                  : 'You were removed from this game.'}
              </Panel>
            )
          )}
        </div>
        <aside className="space-y-4">
          <Scoreboard room={room} />
          <EventLog />
        </aside>
      </div>
    </DndContext>
  );
}
