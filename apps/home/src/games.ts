/**
 * Every game on Turn Tables. To add a game, add an entry here: it gets a card on the home page,
 * and the Join Game popup sends it any code that `ownsCode` accepts.
 */
export interface Game {
  id: string;
  name: string;
  /** Where the game is hosted. Games without one show as "Coming soon". */
  url?: string;
  /** True when a room code belongs to this game. */
  ownsCode?: (code: string) => boolean;
}

/** Longest room code any game uses (the Join Game input's limit). */
export const CODE_MAX_LENGTH = 6;

// Same rules as ROOM_CODE_LENGTH / ROOM_CODE_ALPHABET in @ace/shared (test/games.test.ts checks).
const ACE_DONKEY_CODE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

export const GAMES: Game[] = [
  {
    id: 'ace-donkey',
    name: 'Ace / Donkey',
    url: import.meta.env.VITE_ACE_DONKEY_URL ?? 'http://localhost:5173',
    ownsCode: (code) => ACE_DONKEY_CODE.test(code),
  },
  { id: 'coming-soon', name: 'Coming soon' },
];

/** Uppercase and drop anything that can't be part of a code. */
export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, CODE_MAX_LENGTH);
}

export function gameForCode(code: string): Game | undefined {
  return GAMES.find((game) => game.url && game.ownsCode?.(code));
}

/** The URL that opens a game straight into the room for `code`. */
export function joinUrl(game: Game, code: string): string {
  const url = new URL(game.url!);
  url.searchParams.set('room', code);
  return url.toString();
}
