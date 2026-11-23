import { useEffect, useRef, useState } from 'react';
import type { RoomView } from '@ace/shared';
import { Avatar } from '../../ui/Avatar';
import { cn } from '../../ui/cn';
import { CloseIcon, WaitingIcon } from '../../ui/icons';

/** The people button on the game screen: who's waiting to be dealt in next game (R19). */
export function WaitingButton({ room }: { room: RoomView }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const waiting = room.players.filter((p) => !p.inGame);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`Waiting players (${waiting.length})`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative grid size-38 place-items-center rounded-full bg-button text-bar"
      >
        <WaitingIcon className="size-24" />
        {waiting.length > 0 && (
          <span
            aria-hidden
            className="absolute -top-6 -right-6 grid size-18 place-items-center rounded-full bg-mid text-w14 text-white"
          >
            {waiting.length}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Waiting"
          className="absolute top-58 -right-110 z-40 w-288 rounded-panel bg-button px-22 pt-16 pb-20 text-white shadow-xl"
        >
          <span
            aria-hidden
            className="absolute -top-12 right-122 size-0 border-x-12 border-b-14 border-x-transparent border-b-button"
          />
          <div className="flex items-center justify-between">
            <h2 className="text-w26 font-medium">Waiting</h2>
            <button type="button" aria-label="Close" onClick={() => setOpen(false)}>
              <CloseIcon className="size-16" />
            </button>
          </div>
          {waiting.length === 0 ? (
            <p className="mt-12 text-w20 text-bar">No one is waiting.</p>
          ) : (
            <ol className="mt-12 space-y-20">
              {waiting.map((p, i) => (
                <li
                  key={p.id}
                  className={cn(
                    'relative flex h-38 items-center rounded-pill bg-panel pl-16 text-w20 text-black',
                    !p.connected && 'opacity-60',
                  )}
                >
                  <span className="w-28 font-light">{i + 1}.</span>
                  <span className="truncate font-semibold">{p.name}</span>
                  <Avatar
                    avatar={p.avatar}
                    size={44}
                    className="absolute top-1/2 right-14 -translate-y-1/2"
                  />
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
