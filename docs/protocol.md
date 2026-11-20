# Socket protocol

Transport: Socket.IO (websocket first). Every client → server event takes a payload and an
acknowledgement callback. Types and zod schemas live in `packages/shared/src/protocol.ts`.

## Client → server

All acks are `{ ok: true, ... }` or `{ ok: false, error: { code, message } }`.

| Event         | Payload              | Ack data on success               |
| ------------- | -------------------- | --------------------------------- |
| `room:create` | `{ name }`           | `{ roomCode, playerId, token }`   |
| `room:join`   | `{ code, name }`     | `{ roomCode, playerId, token }`   |
| `room:resume` | `{ token }`          | `{ roomCode, playerId, token }`   |
| `room:leave`  | `{}`                 | —                                 |
| `game:start`  | `{}` (host only)     | —                                 |
| `game:play`   | `{ card, actionId }` | —                                 |
| `game:giveUp` | `{ actionId }`       | —                                 |
| `state:sync`  | `{}`                 | — (server re-sends `room:update`) |

- `actionId` is a client-generated unique id. Re-sending the same id (e.g. after a timeout or a
  double-click) is acknowledged without being applied twice.
- Each socket is rate-limited (token bucket, default burst 20, 10/s): excess events get
  `RATE_LIMITED`.

## Server → client

| Event           | Payload                                            | When                                      |
| --------------- | -------------------------------------------------- | ----------------------------------------- |
| `room:update`   | `{ version, room, events }`                        | After every change in the room            |
| `session:ended` | `{ reason: 'left' \| 'replaced' \| 'roomClosed' }` | This socket no longer represents a player |

- `room` is a `RoomView` projected **for the receiving player**: their own hand, card counts for
  everyone else, table, scores, streaks, history. Other players' cards are never sent.
- `events` are the engine events that caused the update (`cardPlayed`, `roundCut`,
  `roundFolded`, `playersFinished`, `playerGaveUp`, `playerRemoved`, `gameOver`). They carry no
  private hand data.
- `version` increases on every update; clients keep the highest version they have seen.

## Session lifecycle

1. `room:create` / `room:join` returns a `token`. The client stores it (localStorage) and the
   server stores only its SHA-256 hash.
2. On reconnect the client sends `room:resume { token }`. If another socket held the session it
   receives `session:ended { reason: 'replaced' }`.
3. A disconnected player's seat is held for `DISCONNECT_GRACE_MS` (60 s). After that they are
   removed from the running game (R16–R18) but stay in the room and can resume for the next game.
4. `room:leave` removes the player from the game immediately and from the room.

## Error codes

Engine: `GAME_OVER`, `NOT_IN_GAME`, `NOT_ACTIVE`, `NOT_YOUR_TURN`, `INVALID_CARD`,
`CARD_NOT_IN_HAND`, `MUST_FOLLOW_SUIT`, `GIVE_UP_NOT_ALLOWED`.

Server: `BAD_REQUEST`, `RATE_LIMITED`, `ROOM_NOT_FOUND`, `ROOM_FULL`, `NAME_TAKEN`,
`SESSION_NOT_FOUND`, `NOT_IN_ROOM`, `ALREADY_IN_ROOM`, `NOT_HOST`, `NOT_ENOUGH_PLAYERS`,
`GAME_IN_PROGRESS`, `NO_GAME`.
