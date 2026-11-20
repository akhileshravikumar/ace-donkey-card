/**
 * Client state. All game state comes from the server (`room:update`); the only local state is UI
 * state: the player's own card arrangement, the highlighted card and messages.
 */
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { CardId, PlayerId, RoomUpdate, RoomView, SessionEndReason } from '@ace/shared';
import { describeEvent } from '../lib/describe';
import { mergeHandOrder, moveCard, sortBySuit } from '../lib/hand';
import { type KeyValueStore, type StoredSession, loadSession, saveSession } from '../lib/storage';
import type { ClientAck, Transport } from '../net/transport';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting';

export interface GameStore {
  connection: ConnectionState;
  session: StoredSession | null;
  /** True while resuming a stored session after (re)connecting. */
  resuming: boolean;
  update: RoomUpdate | null;
  handOrder: CardId[];
  selected: CardId | null;
  /** Latest human-readable messages, newest last. */
  log: string[];
  error: string | null;
  notice: string | null;
  busy: boolean;

  // actions
  createRoom(name: string): Promise<boolean>;
  joinRoom(code: string, name: string): Promise<boolean>;
  leaveRoom(): Promise<void>;
  startGame(): Promise<void>;
  playCard(card: CardId): Promise<boolean>;
  playSelected(): Promise<boolean>;
  giveUp(): Promise<void>;
  select(card: CardId | null): void;
  moveSelection(delta: number): void;
  moveCard(card: CardId, toIndex: number): void;
  sortHand(): void;
  clearError(): void;
}

const LOG_LIMIT = 30;

const END_NOTICE: Record<SessionEndReason, string> = {
  left: 'You left the room.',
  replaced: 'This game was opened in another tab or window.',
  roomClosed: 'The room was closed.',
};

let actionCounter = 0;
const newActionId = () =>
  `${Date.now().toString(36)}-${(actionCounter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Identifies which game a view belongs to (games started so far in this room). */
function gameKey(room: RoomView): string {
  return `${room.code}:${room.history.length + (room.phase === 'playing' ? 1 : 0)}`;
}

export function nameLookup(room: RoomView | undefined) {
  return (id: PlayerId) => room?.names[id] ?? 'Someone';
}

export function createGameStore(
  transport: Transport,
  storage: KeyValueStore | null,
): StoreApi<GameStore> {
  const store = createStore<GameStore>()((set, get) => {
    const fail = (ack: ClientAck<object>): false => {
      if (!ack.ok) set({ error: ack.error.message });
      return false;
    };

    const setSession = (session: StoredSession | null) => {
      saveSession(storage, session);
      set({ session });
    };

    const endSession = (notice: string | null) => {
      setSession(null);
      set({ update: null, handOrder: [], selected: null, log: [], notice });
    };

    const enter = async (
      event: 'room:create' | 'room:join',
      payload: { name: string; code?: string },
    ): Promise<boolean> => {
      set({ busy: true, error: null, notice: null });
      const ack =
        event === 'room:create'
          ? await transport.send('room:create', { name: payload.name })
          : await transport.send('room:join', { code: payload.code!, name: payload.name });
      set({ busy: false });
      if (!ack.ok) return fail(ack);
      setSession({ roomCode: ack.roomCode, playerId: ack.playerId, token: ack.token });
      return true;
    };

    const gameAction = async (send: () => Promise<ClientAck<object>>): Promise<boolean> => {
      set({ error: null });
      const ack = await send();
      return ack.ok ? true : fail(ack);
    };

    return {
      connection: 'connecting',
      session: loadSession(storage),
      resuming: false,
      update: null,
      handOrder: [],
      selected: null,
      log: [],
      error: null,
      notice: null,
      busy: false,

      createRoom: (name) => enter('room:create', { name }),
      joinRoom: (code, name) => enter('room:join', { code, name }),

      async leaveRoom() {
        await transport.send('room:leave', {});
        endSession(END_NOTICE.left);
      },

      async startGame() {
        await gameAction(() => transport.send('game:start', {}));
      },

      async playCard(card) {
        const game = get().update?.room.game;
        if (!game || game.you === null) return false;
        if (game.turn !== game.you) {
          set({ error: 'It is not your turn yet.' });
          return false;
        }
        if (!game.playable.includes(card)) {
          set({ error: 'You must follow the suit that was led.' });
          return false;
        }
        const ok = await gameAction(() =>
          transport.send('game:play', { card, actionId: newActionId() }),
        );
        if (ok && get().selected === card) set({ selected: null });
        return ok;
      },

      async playSelected() {
        const card = get().selected;
        if (!card) {
          set({ error: 'Select a card first.' });
          return false;
        }
        return get().playCard(card);
      },

      async giveUp() {
        await gameAction(() => transport.send('game:giveUp', { actionId: newActionId() }));
      },

      select(card) {
        set({ selected: get().selected === card ? null : card, error: null });
      },

      moveSelection(delta) {
        const { handOrder, selected } = get();
        if (handOrder.length === 0) return;
        const index = selected ? handOrder.indexOf(selected) : delta > 0 ? -1 : handOrder.length;
        const next = Math.max(0, Math.min(handOrder.length - 1, index + delta));
        set({ selected: handOrder[next]! });
      },

      moveCard(card, toIndex) {
        set({ handOrder: moveCard(get().handOrder, card, toIndex) });
      },

      sortHand() {
        set({ handOrder: sortBySuit(get().handOrder) });
      },

      clearError() {
        set({ error: null });
      },
    };
  });

  const resume = async () => {
    const session = store.getState().session;
    if (!session) return;
    store.setState({ resuming: true });
    const ack = await transport.send('room:resume', { token: session.token });
    store.setState({ resuming: false });
    if (!ack.ok) {
      saveSession(storage, null);
      store.setState({
        session: null,
        update: null,
        notice: ack.error.code === 'TIMEOUT' ? null : 'Your previous game has ended.',
      });
    }
  };

  transport.connect({
    onConnect() {
      store.setState({ connection: 'connected' });
      void resume();
    },
    onDisconnect() {
      store.setState({ connection: 'reconnecting' });
    },
    onUpdate(update) {
      const state = store.getState();
      if (
        state.update &&
        update.version < state.update.version &&
        update.room.code === state.update.room.code
      )
        return;
      const hand = update.room.game?.hand ?? [];
      // A new deal starts from the server's order; within a game the player's arrangement is kept.
      const sameGame = state.update !== null && gameKey(state.update.room) === gameKey(update.room);
      const handOrder = mergeHandOrder(sameGame ? state.handOrder : [], hand);
      const nameOf = nameLookup(update.room);
      const messages = update.events.map((e) => describeEvent(e, nameOf));
      store.setState({
        update,
        handOrder,
        selected: state.selected && hand.includes(state.selected) ? state.selected : null,
        log: [...state.log, ...messages].slice(-LOG_LIMIT),
      });
    },
    onSessionEnded(reason) {
      saveSession(storage, null);
      store.setState({
        session: null,
        update: null,
        handOrder: [],
        selected: null,
        log: [],
        notice: END_NOTICE[reason],
      });
    },
  });

  return store;
}
