# Ace Donkey Card

A real-time multiplayer browser version of the "Donkey" card game for 3–7 players.

- Rules: [`docs/rules.md`](docs/rules.md) (rule IDs R1–R21 are referenced in code and tests)
- Socket protocol: [`docs/protocol.md`](docs/protocol.md)

## Repository layout

```
apps/client      React + TypeScript + Vite (functional components, no styling yet)
apps/server      Node + Express + Socket.IO (authoritative game server)
packages/shared  Pure game engine, socket protocol types and zod schemas
docs/            Rules and protocol
```

## Getting started

Requires Node 22+ (see `.nvmrc`).

```bash
npm install
npm run dev        # server on :3001, client on :5173
```

Open http://localhost:5173 in 3+ browser tabs. During development each tab is a separate player
(`apps/client/.env.development` keeps the session token in `sessionStorage`); production builds use
`localStorage` so a player survives browser restarts. See `apps/client/.env.example` and
`apps/server/.env.example` for settings.

## Status

| Area                             | State                                                                |
| -------------------------------- | -------------------------------------------------------------------- |
| Game engine (`packages/shared`)  | Done: rules R1–R18 + E1–E4, unit, fixture and property tests         |
| Real-time server (`apps/server`) | Done: rooms, reconnect/removal, rate limiting, audit log (to stdout) |
| Client (`apps/client`)           | Functional components only: **no styling or layout yet**             |
| Persistence (Supabase)           | Not started: the audit sink is the hook for it                       |
| Deployment (Render)              | Not started                                                          |

### Styling

Tailwind CSS v4 via `@tailwindcss/vite`. All colours and the font are semantic tokens in
`apps/client/src/index.css` (`bg-surface`, `text-muted`, `bg-felt`, `text-accent`, …), so a new
design can start by changing those values. Game logic lives in `src/state` and `src/lib`;
components in `src/components` only render and call store actions, so they can be replaced
freely.

### Card art

Card faces are the CC0 **Classic 4-Color Poker Deck** by Heratexx (OpenGameArt), in
`apps/client/public/cards` — see the `LICENSE.md` there.

### Playing (client)

- Click/tap a card to highlight it; double-click/double-tap to play it.
- Drag a card to rearrange your hand, or drop it on the table to play it.
- **Sort by suit**, or keyboard: ←/→ move the highlight, Shift+←/→ move the card, Enter plays, S sorts.

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
