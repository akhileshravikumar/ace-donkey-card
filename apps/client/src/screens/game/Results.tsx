import { useState } from 'react';
import type { GameView, PlayerId, RoomView } from '@ace/shared';
import { useGame } from '../../state/context';
import { Avatar } from '../../ui/Avatar';
import { ConfirmModal } from '../../ui/Modal';
import { resultsDarkButton, resultsLightButton } from '../../ui/buttons';
import { cn } from '../../ui/cn';
import { TrophyIcon } from '../../ui/icons';
import { Scoreboard } from './Scoreboard';

const STEPS = [
  { place: 2, height: 'h-178' },
  { place: 1, height: 'h-251' },
  { place: 3, height: 'h-122' },
] as const;

/**
 * Results (wireframe): shown over the faded table when a game ends — a top-3 podium (tied players
 * share a step), the overall scoreboard, and Back to lobby / Leave Room.
 */
export function Results({ room, game }: { room: RoomView; game: GameView }) {
  const backToLobby = useGame((s) => s.backToLobby);
  const leaveRoom = useGame((s) => s.leaveRoom);
  const [confirm, setConfirm] = useState<'leave' | null>(null);
  const nameOf = (id: PlayerId) => room.names[id] ?? 'Someone';
  const avatarOf = (id: PlayerId) => room.players.find((p) => p.id === id)?.avatar;

  const byPlace = new Map<number, PlayerId[]>();
  let position = 1;
  for (const group of game.placings) {
    if (position <= 3) byPlace.set(position, group);
    position += group.length;
  }
  const draw = game.result?.outcome === 'draw';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="results-heading"
      className="fixed inset-0 z-40 overflow-y-auto bg-white/80 backdrop-blur-[2px]"
    >
      <div className="mx-auto flex min-h-full w-full max-w-1920 flex-wrap items-start justify-between gap-60 px-120 pt-110 pb-60 max-md:px-24">
        <section className="flex w-640 flex-col items-center">
          <h2 id="results-heading" className="text-w80 font-semibold">
            Results
          </h2>
          {draw && <p className="mt-8 text-w30 text-shade">Draw — no loser this time</p>}

          <ol aria-label="Podium" className="mt-40 flex items-end gap-4">
            {STEPS.map((step) => {
              const players = byPlace.get(step.place) ?? [];
              return (
                <li
                  key={step.place}
                  aria-label={`Place ${step.place}`}
                  className="flex w-180 flex-col items-center"
                >
                  <div className="mb-8 flex flex-col items-center gap-6">
                    {players.map((id) => (
                      <span key={id} className="flex flex-col items-center">
                        <span className="max-w-180 truncate text-w26 font-semibold">
                          {nameOf(id)}
                        </span>
                        {avatarOf(id) && <Avatar avatar={avatarOf(id)!} size={68} />}
                      </span>
                    ))}
                  </div>
                  <div
                    className={cn(
                      'flex w-full flex-col items-center justify-start rounded-[calc(var(--u)*18)] pt-20 text-w80 leading-none font-semibold text-white',
                      step.height,
                      players.length ? 'bg-shade' : 'bg-bar',
                    )}
                  >
                    {step.place}
                    {step.place === 1 && <TrophyIcon className="mt-24 size-80" />}
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-56 flex flex-col items-center gap-18">
            <button type="button" className={resultsLightButton} onClick={backToLobby}>
              Back to Lobby
            </button>
            <button type="button" className={resultsDarkButton} onClick={() => setConfirm('leave')}>
              Leave Room
            </button>
          </div>
        </section>

        <Scoreboard room={room} className="mt-40" />
      </div>

      {confirm === 'leave' && (
        <ConfirmModal
          title="Leave Room"
          message="Leave this room? You can come back with the room code as a new player."
          confirmLabel="Leave"
          onConfirm={() => void leaveRoom()}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
