import { useRef } from 'react';
import { GAMES, type Game } from '../games';
import { JoinGameDialog } from '../JoinGameDialog';

export function AllGames() {
  const joinRef = useRef<HTMLDialogElement>(null);

  return (
    <main className="px-120 pt-54 pb-54 max-md:px-[24px]">
      <div className="flex min-h-68 items-center justify-between gap-[16px]">
        <h1 className="text-title leading-none font-medium">All Games</h1>
        <button
          type="button"
          onClick={() => joinRef.current?.showModal()}
          className="h-68 w-277 rounded-pill bg-bar text-join"
        >
          Join Game
        </button>
      </div>

      <ul className="mt-54 flex flex-wrap gap-51">
        {GAMES.map((game) => (
          <li key={game.id}>
            <GameCard game={game} />
          </li>
        ))}
      </ul>

      <JoinGameDialog dialogRef={joinRef} />
    </main>
  );
}

function GameCard({ game }: { game: Game }) {
  const body = (
    <>
      <div className="h-221 rounded-bar bg-thumb" />
      <div className="flex h-79 items-center justify-between px-36 text-card font-medium">
        <span>{game.name}</span>
        <svg viewBox="0 0 16 28" className="h-28 w-16" aria-hidden="true">
          <path
            d="M2.5 2.5L13.5 14L2.5 25.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </>
  );
  const card = 'block w-310 rounded-bar bg-bar';

  return game.url ? (
    <a href={game.url} className={card}>
      {body}
    </a>
  ) : (
    <div className={card} aria-disabled="true">
      {body}
    </div>
  );
}
