# Ace Donkey Card

A real-time multiplayer browser version of the "Donkey" card game for 3–7 players.

- Rules: [`docs/rules.md`](docs/rules.md) (rule IDs R1–R25 are referenced in code and tests)
- Socket protocol: [`docs/protocol.md`](docs/protocol.md)

## Repository layout

```
apps/home        Turn Tables home page: lists every game and joins any game by code
apps/client      React + TypeScript + Vite + Tailwind (wireframe UI, greyscale for now)
apps/server      Node + Express + Socket.IO (authoritative game server)
packages/shared  Pure game engine, socket protocol types and zod schemas
docs/            Rules and protocol
```

## Getting started

Requires Node 22+ (see `.nvmrc`).

```bash
npm install
npm run dev        # server on :3001, client on :5173, home page on :5174
```

The Turn Tables home page is at http://localhost:5174. Games are listed in `apps/home/src/games.ts`;
set `VITE_ACE_DONKEY_URL` (see `apps/home/.env.example`) to where the game is hosted.

Open http://localhost:5173 in 3+ browser tabs. During development each tab is a separate player
(`apps/client/.env.development` keeps the session token in `sessionStorage`); production builds use
`localStorage` so a player survives browser restarts. See `apps/client/.env.example` and
`apps/server/.env.example` for settings. `VITE_HOME_URL` is where the header's Turn Tables links
go (default http://localhost:5174).

## Status

| Area                             | State                                                                |
| -------------------------------- | -------------------------------------------------------------------- |
| Game engine (`packages/shared`)  | Done: rules R1–R18 + E1–E4, unit, fixture and property tests         |
| Real-time server (`apps/server`) | Done: rooms, reconnect/removal, rate limiting, audit log (to stdout) |
| Client (`apps/client`)           | Wireframe UI in greys: lobby, game table, chat, results, avatars     |
| Persistence (Supabase)           | Not started: the audit sink is the hook for it                       |
| Deployment (Render)              | Not started                                                          |

### Styling

Tailwind CSS v4 via `@tailwindcss/vite`, built from the 1920 px wide wireframes. Sizes are in
wireframe pixels: `--spacing` is one wireframe pixel (`--u`, scaled to the window), so `w-410` is
410 px on the wireframe; text sizes are `text-w14` … `text-w80`. The greys are named tokens in
`apps/client/src/index.css` (`bg-bar`, `bg-panel`, `bg-dialog`, `bg-button`, `text-mid`, `bg-shade`,
…) so colours can be added later by changing those values.

- `src/screens`: Home, Lobby, the modals (Rules, Change Avatar, Change Host) and `game/` (table,
  hand bar, scoreboard, chat, waiting list, results).
- `src/ui`: shared pieces (header, avatar, modal, room code, icons, button styles).
- Game logic lives in `src/state` and `src/lib` (table geometry, scoreboard stats, avatar storage);
  screens only render and call store actions.

The table has one side per player (triangle for 3, square for 4, … heptagon for 7), with you on
the flat bottom edge. The spiky crown is the host; the dotted crown is the last game's loser.

### Card art

Card faces are the CC0 **Classic 4-Color Poker Deck** by Heratexx (OpenGameArt), in
`apps/client/public/cards` — see the `LICENSE.md` there.

### Playing (client)

- Click/tap a card to highlight it; double-click/double-tap to play it.
- Drag a card to rearrange your hand, or drop it on the table to play it.
- **Sort by suit**, or keyboard: ←/→ move the highlight, Shift+←/→ move the card, Enter plays, S sorts.
- After a cut, the cards stay on the table until the player picking them up presses **Take Cards**.
- **Change Avatar** opens Customize: a face colour, then arrows for glasses and mouth.

## Scripts

| Command             | What it does                                               |
| ------------------- | ---------------------------------------------------------- |
| `npm run dev`       | Server and client in watch mode                            |
| `npm test`          | All unit, property and integration tests                   |
| `npm run typecheck` | TypeScript across every workspace                          |
| `npm run lint`      | ESLint                                                     |
| `npm run build`     | Production builds (`apps/server/dist`, `apps/client/dist`) |
| `npm run sim`       | Simulate random games and print outcome statistics         |

## Workflow

- Branch from `main` as `feat/…`, `fix/…` or `chore/…`; open a PR; one review; squash-merge.
- CI (`.github/workflows/ci.yml`) runs typecheck, lint, format check, tests and build.
- Rule changes start in `docs/rules.md`, then a failing test, then the engine.
