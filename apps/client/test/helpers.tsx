import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import type { GameRecord, GameView, RoomPlayerView, RoomUpdate, RoomView } from '@ace/shared';
import type { ClientAck, Transport, TransportListeners } from '../src/net/transport';
import type { KeyValueStore } from '../src/lib/storage';
import { createGameStore } from '../src/state/store';
import { StoreProvider } from '../src/state/context';

export class FakeTransport implements Transport {
  listeners!: TransportListeners;
  sent: { event: string; payload: unknown }[] = [];
  replies: Record<string, ClientAck<Record<string, unknown>>> = {};
  connected = false;
  connect(listeners: TransportListeners) {
    this.listeners = listeners;
  }
  async send(event: string, payload: unknown) {
    this.sent.push({ event, payload });
    return (this.replies[event] ?? { ok: true }) as never;
  }
  sentEvents(event: string) {
    return this.sent.filter((s) => s.event === event).map((s) => s.payload);
  }
}

export function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

export function player(id: string, extra: Partial<RoomPlayerView> = {}): RoomPlayerView {
  return {
    id,
    name: id[0]!.toUpperCase() + id.slice(1),
    isHost: false,
    connected: true,
    disconnectDeadline: null,
    inGame: false,
    score: 0,
    streak: 0,
    isJoker: false,
    avatar: { face: 2, glasses: 3, mouth: 0 },
    ...extra,
  };
}

export function gameView(game: Partial<GameView> = {}): GameView {
  return {
    you: 'me',
    hand: [],
    playable: [],
    canGiveUp: false,
    mustTake: false,
    players: [],
    table: [],
    ledSuit: null,
    turn: 'me',
    leader: 'me',
    roundNo: 1,
    discardedCount: 0,
    placings: [],
    loser: null,
    result: null,
    starter: 'me',
    jokerId: null,
    jokerAces: [],
    pendingCut: null,
    ...game,
  };
}

export function record(extra: Partial<GameRecord> & Pick<GameRecord, 'seats'>): GameRecord {
  return {
    gameNo: 1,
    outcome: 'loser',
    reason: 'normal',
    placings: [],
    loser: null,
    points: {},
    removed: [],
    jokerId: null,
    jokerAces: [],
    streaksAfter: {},
    ...extra,
  } as GameRecord;
}

/** Three players by default: me (host), bob, cleo. */
export function roomView(extra: Partial<RoomView> = {}): RoomView {
  const players = extra.players ?? [
    player('me', { isHost: true, name: 'Me' }),
    player('bob'),
    player('cleo'),
  ];
  return {
    code: 'ABCDEF',
    you: 'me',
    hostId: 'me',
    phase: 'lobby',
    names: Object.fromEntries(players.map((p) => [p.id, p.name])),
    game: null,
    history: [],
    canStart: true,
    minPlayers: 3,
    maxPlayers: 7,
    ...extra,
    players,
  };
}

export function update(version: number, room: RoomView): RoomUpdate {
  return { version, events: [], room };
}

/** A store with a room already received, plus a render helper wrapped in its provider. */
export function setup(room?: RoomView) {
  const transport = new FakeTransport();
  const storage = memoryStore();
  const store = createGameStore(transport, storage);
  if (room) transport.listeners.onUpdate(update(1, room));
  const renderUi = (ui: ReactNode) => render(<StoreProvider store={store}>{ui}</StoreProvider>);
  return { transport, storage, store, renderUi };
}
