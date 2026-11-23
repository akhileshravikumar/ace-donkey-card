# Socket protocol

Transport: Socket.IO (websocket first). Every client → server event takes a payload and an
acknowledgement callback. Types and zod schemas live in `packages/shared/src/protocol.ts`.

## Client → server

All acks are `{ ok: true, ... }` or `{ ok: false, error: { code, message } }`.

| Event           | Payload                    | Ack data on success               |
| --------------- | -------------------------- | --------------------------------- |
| `room:create`   | `{ name, avatar? }`        | `{ roomCode, playerId, token }`   |
| `room:join`     | `{ code, name, avatar? }`  | `{ roomCode, playerId, token }`   |
| `room:resume`   | `{ token }`                | `{ roomCode, playerId, token }`   |
| `room:leave`    | `{}`                       | —                                 |
| `room:reorder`  | `{ order }` (host only)    | —                                 |
| `room:kick`     | `{ playerId }` (host only) | —                                 |
| `room:setHost`  | `{ playerId }` (host only) | —                                 |
| `player:avatar` | `{ avatar }`               | —                                 |
| `chat:send`     | `{ text }`                 | —                                 |
| `game:start`    | `{}` (host only)           | —                                 |
| `game:play`     | `{ card, actionId }`       | —                                 |
| `game:giveUp`   | `{ actionId }`             | —                                 |
| `game:take`     | `{ actionId }`             | —                                 |
| `state:sync`    | `{}`                       | — (server re-sends `room:update`) |

- `actionId` is a client-generated unique id. Re-sending the same id (e.g. after a timeout or a
  double-click) is acknowledged without being applied twice.
- `room:reorder` sets the seating order (R22): `order` lists every player id in the room once,
  host first, and is only accepted between games.
- `avatar` is `{ face, glasses, mouth }` (R25): `face` 0–5, `glasses` 0–3 (small square, round,
  wide, none), `mouth` 0–2 (teeth, O, straight). Without one, a default is used.
- `game:take` (R5a) is only accepted from the player who has to pick up a cut.
- `room:kick` (R23) removes the player like `room:leave` and ends their session with
  `session:ended { reason: 'kicked' }`. The host can't kick themselves. `room:setHost` needs a
  connected player.
- `chat:send` text is trimmed, 1–300 characters (R24).
- Each socket is rate-limited (token bucket, default burst 20, 10/s): excess events get
  `RATE_LIMITED`.

## Server → client

| Event           | Payload                                                        | When                                      |
| --------------- | -------------------------------------------------------------- | ----------------------------------------- |
| `room:update`   | `{ version, room, events }`                                    | After every change in the room            |
| `session:ended` | `{ reason: 'left' \| 'replaced' \| 'roomClosed' \| 'kicked' }` | This socket no longer represents a player |
| `chat:message`  | `{ id, playerId, name, text, at }`                             | Someone in the room sent a message        |
| `chat:history`  | `ChatMessage[]` (last 100)                                     | After join, resume and `state:sync`       |

- `room.players` is in seating order (each with their `avatar`) (host first), which is also the dealing and turn order.
- `room` is a `RoomView` projected **for the receiving player**: their own hand, card counts for
  everyone else, table, scores, streaks, history. Other players' cards are never sent.
- `events` are the engine events that caused the update (`cardPlayed`, `cutPending`, `roundCut`,
  `roundFolded`, `playersFinished`, `playerGaveUp`, `playerRemoved`, `gameOver`). They carry no
  private hand data.
- While a cut waits to be taken (R5a), `room.game.pendingCut` is `{ cutBy, pickerId }`, `turn` is
  the picker, and `mustTake` is true only in the picker's own view.
- `version` increases on every update; clients keep the highest version they have seen.

## Session lifecycle

1. `room:create` / `room:join` returns a `token`. The client stores it (localStorage) and the
   server stores only its SHA-256 hash.
2. On reconnect the client sends `room:resume { token }`. If another socket held the session it
   receives `session:ended { reason: 'replaced' }`.
3. A disconnected player's seat is held for `DISCONNECT_GRACE_MS` (60 s). During that time they
   can come back with `room:resume`, or with `room:join` using the **same name** (e.g. from a new
   browser via the invite link) — the server gives them a new token for the same seat. After the
   grace period they are removed from the running game (R16–R18) and from the room; their token
   stops working, their score and streak are forgotten, and joining again makes a new player.
4. `room:leave` removes the player from the game immediately and from the room.

## Error codes

Engine: `GAME_OVER`, `NOT_IN_GAME`, `NOT_ACTIVE`, `NOT_YOUR_TURN`, `INVALID_CARD`,
`CARD_NOT_IN_HAND`, `MUST_FOLLOW_SUIT`, `GIVE_UP_NOT_ALLOWED`, `TAKE_CARDS_FIRST`,
`NOTHING_TO_TAKE`.

Server: `BAD_REQUEST`, `RATE_LIMITED`, `ROOM_NOT_FOUND`, `ROOM_FULL`, `NAME_TAKEN`,
`SESSION_NOT_FOUND`, `NOT_IN_ROOM`, `ALREADY_IN_ROOM`, `NOT_HOST`, `NOT_ENOUGH_PLAYERS`,
`GAME_IN_PROGRESS`, `NO_GAME`, `INVALID_ORDER`, `NOT_FOUND`.
