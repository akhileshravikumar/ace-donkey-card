import { useState } from 'react';
import { useGame } from '../state/context';
import { GameScreen } from './GameScreen';
import { Lobby } from './Lobby';
import { Button } from './ui';

export function RoomScreen() {
  const room = useGame((s) => s.update!.room);
  const leaveRoom = useGame((s) => s.leaveRoom);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${window.location.pathname}?room=${room.code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <section aria-labelledby="room-heading" className="mb-5 flex flex-wrap items-center gap-3">
        <h2 id="room-heading" className="flex items-baseline gap-2 text-sm text-muted">
          Room{' '}
          <span className="font-mono text-lg font-bold tracking-[0.25em] text-fg">{room.code}</span>
        </h2>
        <Button variant="ghost" onClick={() => void copy()} title={link}>
          {copied ? 'Copied!' : 'Copy invite link'}
        </Button>
        <a href={link} className="sr-only">
          Invite link: {link}
        </a>
        <div className="ml-auto flex items-center gap-2 text-sm">
          {confirmLeave ? (
            <>
              <span className="text-muted">
                {room.phase === 'playing'
                  ? 'Leaving removes you from this game. Leave?'
                  : 'Leave the room?'}
              </span>
              <Button variant="danger" onClick={() => void leaveRoom()}>
                Leave
              </Button>
              <Button variant="ghost" onClick={() => setConfirmLeave(false)}>
                Stay
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmLeave(true)}>
              Leave room
            </Button>
          )}
        </div>
      </section>

      {room.phase === 'lobby' ? <Lobby /> : <GameScreen />}
    </>
  );
}
