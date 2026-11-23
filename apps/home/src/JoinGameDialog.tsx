import { type FormEvent, type RefObject, useState } from 'react';
import { gameForCode, joinUrl, normalizeCode } from './games';

/** "Join Game" popup: type a room code, Join opens the game that owns it. */
export function JoinGameDialog({ dialogRef }: { dialogRef: RefObject<HTMLDialogElement | null> }) {
  const [code, setCode] = useState('');
  const game = gameForCode(code);

  const onJoin = (e: FormEvent) => {
    e.preventDefault();
    if (game) window.location.assign(joinUrl(game, code));
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label="Join Game"
      onClose={() => setCode('')}
      className="m-auto w-374 rounded-dialog bg-dialog px-44 pt-31 pb-30 backdrop:bg-bar/90"
    >
      <form onSubmit={onJoin}>
        <input
          aria-label="Code"
          placeholder="CODE"
          value={code}
          onChange={(e) => setCode(normalizeCode(e.target.value))}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="block h-45 w-full rounded-full bg-white px-22 text-code font-light outline-none placeholder:text-bar focus-visible:ring-2 focus-visible:ring-button"
        />
        <div className="mt-27 flex gap-20">
          <button
            type="submit"
            disabled={!game}
            className="h-45 flex-1 rounded-full bg-button text-popup text-white disabled:opacity-60"
          >
            Join
          </button>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="h-45 flex-1 rounded-full bg-button text-popup text-white"
          >
            Exit
          </button>
        </div>
      </form>
    </dialog>
  );
}
