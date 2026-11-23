/**
 * One game room: its players, the room session (scores/streaks/Joker) and the current game.
 * The Room is the only place that mutates game state; every change goes through the pure engine.
 */
import {
  type AckError,
  type Avatar,
  type CardId,
  type ChatMessage,
  type GameAction,
  type GameEvent,
  type GameState,
  type PlayerId,
  type RoomPhase,
  type RoomView,
  type Rng,
  type SessionState,
  CHAT_HISTORY,
  DEFAULT_AVATAR,
  MAX_PLAYERS,
  MIN_PLAYERS,
  applyAction,
  createSession,
  forgetPlayer,
  projectGame,
  recordGame,
  startSessionGame,
} from '@ace/shared';
import type { AuditSink } from '../audit';

export interface RoomPlayer {
  id: PlayerId;
  name: string;
  tokenHash: string;
  socketId: string | null;
  connected: boolean;
  disconnectDeadline: number | null;
  disconnectTimer: ReturnType<typeof setTimeout> | null;
  /** Recent actionIds, for idempotent retries. */
  recentActions: string[];
  avatar: Avatar;
}

export type RoomResult = { ok: true; duplicate?: boolean } | { ok: false; error: AckError };

export interface RoomDeps {
  rng: Rng;
  audit: AuditSink;
  graceMs: number;
  now?: () => number;
  /** Called after any change so the transport can broadcast fresh views. */
  onChange: (room: Room, events: GameEvent[]) => void;
  /** Called when a player is gone for good (grace period over), so their token can be forgotten. */
  onPlayerGone?: (room: Room, player: RoomPlayer) => void;
}

const err = (code: AckError['code'], message: string): RoomResult => ({
  ok: false,
  error: { code, message },
});

const RECENT_ACTIONS = 50;

export class Room {
  readonly players: RoomPlayer[] = [];
  /** Every name ever seated here, so past results can still name players who left. */
  readonly names: Record<PlayerId, string> = {};
  hostId: PlayerId | null = null;
  session: SessionState = createSession();
  game: GameState | null = null;
  version = 0;
  /** Recent chat (R24), oldest first. */
  readonly chat: ChatMessage[] = [];
  private nextChatId = 1;
  lastActivity: number;
  private readonly now: () => number;

  constructor(
    readonly code: string,
    private readonly deps: RoomDeps,
  ) {
    this.now = deps.now ?? Date.now;
    this.lastActivity = this.now();
  }

  // -------------------------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------------------------

  get phase(): RoomPhase {
    if (!this.game) return 'lobby';
    return this.game.result ? 'gameOver' : 'playing';
  }

  getPlayer(id: PlayerId): RoomPlayer | undefined {
    return this.players.find((p) => p.id === id);
  }

  get connectedPlayers(): RoomPlayer[] {
    return this.players.filter((p) => p.connected);
  }

  isFull(): boolean {
    return this.players.length >= MAX_PLAYERS;
  }

  findByName(name: string): RoomPlayer | undefined {
    return this.players.find((p) => p.name.toLowerCase() === name.toLowerCase());
  }

  /** R15: a disconnected player still inside the grace period can take their seat back by name. */
  canReclaim(p: RoomPlayer): boolean {
    return !p.connected && p.disconnectTimer !== null;
  }

  view(viewer: PlayerId): RoomView {
    const joker = this.session.joker?.playerId ?? null;
    return {
      code: this.code,
      you: viewer,
      hostId: this.hostId ?? '',
      phase: this.phase,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        isHost: p.id === this.hostId,
        connected: p.connected,
        disconnectDeadline: p.disconnectDeadline,
        inGame: this.game?.seats.includes(p.id) ?? false,
        score: this.session.scores[p.id] ?? 0,
        streak: this.session.streaks[p.id] ?? 0,
        isJoker: p.id === joker,
        avatar: p.avatar,
      })),
      names: { ...this.names },
      game: this.game ? projectGame(this.game, viewer) : null,
      history: this.session.history,
      canStart: viewer === this.hostId && this.startBlocker() === null,
      minPlayers: MIN_PLAYERS,
      maxPlayers: MAX_PLAYERS,
    };
  }

  /** Why the host can't start right now, or null if they can. */
  private startBlocker(): RoomResult | null {
    if (this.phase === 'playing') return err('GAME_IN_PROGRESS', 'A game is already in progress');
    const ready = this.connectedPlayers.length;
    if (ready < MIN_PLAYERS) {
      return err('NOT_ENOUGH_PLAYERS', `Need at least ${MIN_PLAYERS} connected players`);
    }
    return null;
  }

  // -------------------------------------------------------------------------------------------
  // Membership
  // -------------------------------------------------------------------------------------------

  addPlayer(player: {
    id: PlayerId;
    name: string;
    tokenHash: string;
    socketId: string;
    avatar?: Avatar;
  }): void {
    this.players.push({
      ...player,
      avatar: player.avatar ?? DEFAULT_AVATAR,
      connected: true,
      disconnectDeadline: null,
      disconnectTimer: null,
      recentActions: [],
    });
    this.names[player.id] = player.name;
    this.hostId ??= player.id;
    this.touch();
    this.deps.onChange(this, []);
  }

  private isActiveInGame(id: PlayerId): boolean {
    return this.phase === 'playing' && this.game!.status[id] === 'active';
  }

  /** A socket (re)attached to this player. */
  attach(id: PlayerId, socketId: string): void {
    const p = this.getPlayer(id);
    if (!p) return;
    if (p.disconnectTimer) clearTimeout(p.disconnectTimer);
    p.disconnectTimer = null;
    p.disconnectDeadline = null;
    p.connected = true;
    p.socketId = socketId;
    this.hostId ??= id;
    this.touch();
    this.deps.onChange(this, []);
  }

  /** R15: rejoining by name within the grace period — same seat and hand, new session token. */
  reclaim(id: PlayerId, tokenHash: string, socketId: string): void {
    const p = this.getPlayer(id);
    if (!p) return;
    p.tokenHash = tokenHash;
    p.recentActions = [];
    this.attach(id, socketId);
  }

  /**
   * R15: hold the seat for the grace period. After that the player is removed from the game
   * (R16–R18) and from the room, and everything about them is forgotten (R17).
   */
  detach(id: PlayerId, socketId: string): void {
    const p = this.getPlayer(id);
    if (!p || p.socketId !== socketId) return;
    p.connected = false;
    p.socketId = null;
    p.disconnectDeadline = this.now() + this.deps.graceMs;
    p.disconnectTimer = setTimeout(() => this.graceExpired(id), this.deps.graceMs);
    this.touch();
    this.deps.onChange(this, []);
  }

  private graceExpired(id: PlayerId): void {
    const p = this.getPlayer(id);
    if (!p || p.connected) return;
    p.disconnectTimer = null;
    const events: GameEvent[] = [];
    if (this.isActiveInGame(id))
      events.push(...this.applyGameAction({ type: 'remove', playerId: id }, 'timeout'));
    this.dropFromRoom(p);
    this.deps.onPlayerGone?.(this, p);
    this.deps.onChange(this, events);
  }

  /** Voluntary leave: removed from the game immediately (R16) and from the room. */
  leave(id: PlayerId): RoomResult {
    const p = this.getPlayer(id);
    if (!p) return err('NOT_IN_ROOM', 'You are not in this room');
    const events: GameEvent[] = [];
    if (this.isActiveInGame(id))
      events.push(...this.applyGameAction({ type: 'remove', playerId: id }, 'leave'));
    this.dropFromRoom(p);
    this.touch();
    this.deps.onChange(this, events);
    return { ok: true };
  }

  /** Remove a player from the room and forget their score, streak and Joker status (R17). */
  private dropFromRoom(p: RoomPlayer): void {
    if (p.disconnectTimer) clearTimeout(p.disconnectTimer);
    this.players.splice(this.players.indexOf(p), 1);
    this.session = forgetPlayer(this.session, p.id);
    if (this.hostId === p.id) this.migrateHost();
  }

  /**
   * R20 + R22: host passes to the next connected player in seating order (or anyone, if none
   * connected) and moves to the top of the order.
   */
  private migrateHost(): void {
    const next =
      this.connectedPlayers.find((p) => p.id !== this.hostId) ??
      this.players.find((p) => p.id !== this.hostId);
    this.hostId = next?.id ?? null;
    if (next) {
      this.players.splice(this.players.indexOf(next), 1);
      this.players.unshift(next);
    }
  }

  /** R22: the host arranges the seating (= dealing and turn) order between games; host stays first. */
  reorder(by: PlayerId, order: PlayerId[]): RoomResult {
    if (by !== this.hostId) return err('NOT_HOST', 'Only the host can change the order');
    if (this.phase === 'playing')
      return err('GAME_IN_PROGRESS', 'The order can only change between games');
    const ids = this.players.map((p) => p.id);
    const valid =
      order.length === ids.length &&
      new Set(order).size === order.length &&
      order.every((id) => ids.includes(id));
    if (!valid) return err('INVALID_ORDER', 'The order must list every player in the room once');
    if (order[0] !== this.hostId) return err('INVALID_ORDER', 'The host always sits at the top');
    const byId = new Map(this.players.map((p) => [p.id, p]));
    this.players.splice(0, this.players.length, ...order.map((id) => byId.get(id)!));
    this.deps.audit.action({
      room: this.code,
      gameNo: this.gameNo,
      actor: by,
      action: 'reorder',
      detail: { order },
    });
    this.touch();
    this.deps.onChange(this, []);
    return { ok: true };
  }

  /** R23: host removes a player (like a Leave). Returns the removed player so their session can end. */
  kick(
    by: PlayerId,
    target: PlayerId,
  ): { ok: true; player: RoomPlayer } | { ok: false; error: AckError } {
    if (by !== this.hostId)
      return {
        ok: false,
        error: { code: 'NOT_HOST', message: 'Only the host can remove players' },
      };
    if (target === by)
      return { ok: false, error: { code: 'BAD_REQUEST', message: 'Use Leave Room to leave' } };
    const p = this.getPlayer(target);
    if (!p)
      return { ok: false, error: { code: 'NOT_FOUND', message: 'That player is not in the room' } };
    this.deps.audit.action({
      room: this.code,
      gameNo: this.gameNo,
      actor: by,
      action: 'kick',
      detail: { target },
    });
    this.leave(target);
    return { ok: true, player: p };
  }

  /** R23: host hands the host role to another connected player, who moves to the top (R22). */
  setHost(by: PlayerId, target: PlayerId): RoomResult {
    if (by !== this.hostId) return err('NOT_HOST', 'Only the host can change the host');
    const next = this.getPlayer(target);
    if (!next || target === by) return err('NOT_FOUND', 'Pick another player in the room');
    if (!next.connected) return err('BAD_REQUEST', 'That player is not connected');
    this.hostId = target;
    this.players.splice(this.players.indexOf(next), 1);
    this.players.unshift(next);
    this.deps.audit.action({
      room: this.code,
      gameNo: this.gameNo,
      actor: by,
      action: 'setHost',
      detail: { target },
    });
    this.touch();
    this.deps.onChange(this, []);
    return { ok: true };
  }

  /** R25: players can change their avatar at any time. */
  setAvatar(by: PlayerId, avatar: Avatar): RoomResult {
    const p = this.getPlayer(by);
    if (!p) return err('NOT_IN_ROOM', 'You are not in this room');
    p.avatar = { ...avatar };
    this.touch();
    this.deps.onChange(this, []);
    return { ok: true };
  }

  /** R24: add a chat message (text already validated). Returns it for broadcasting. */
  addChat(by: PlayerId, text: string): ChatMessage | null {
    const p = this.getPlayer(by);
    if (!p) return null;
    const message: ChatMessage = {
      id: this.nextChatId++,
      playerId: by,
      name: p.name,
      text,
      at: this.now(),
    };
    this.chat.push(message);
    if (this.chat.length > CHAT_HISTORY) this.chat.shift();
    this.touch();
    return message;
  }

  // -------------------------------------------------------------------------------------------
  // Game actions
  // -------------------------------------------------------------------------------------------

  startGame(by: PlayerId): RoomResult {
    if (by !== this.hostId) return err('NOT_HOST', 'Only the host can start the game');
    const blocker = this.startBlocker();
    if (blocker) return blocker;
    const seats = this.connectedPlayers.map((p) => p.id).slice(0, MAX_PLAYERS);
    // R22: seats follow the lobby order; the host deals when there's no Joker.
    this.game = startSessionGame(this.session, seats, this.deps.rng, this.hostId);
    this.deps.audit.action({
      room: this.code,
      gameNo: this.gameNo,
      actor: by,
      action: 'start',
      detail: { seats, jokerId: this.game.jokerId, jokerAces: this.game.jokerAces },
    });
    this.touch();
    this.deps.onChange(this, []);
    return { ok: true };
  }

  play(by: PlayerId, card: CardId, actionId: string): RoomResult {
    return this.playerAction(by, actionId, { type: 'play', playerId: by, card });
  }

  giveUp(by: PlayerId, actionId: string): RoomResult {
    return this.playerAction(by, actionId, { type: 'giveUp', playerId: by });
  }

  take(by: PlayerId, actionId: string): RoomResult {
    return this.playerAction(by, actionId, { type: 'take', playerId: by });
  }

  private playerAction(by: PlayerId, actionId: string, action: GameAction): RoomResult {
    const p = this.getPlayer(by);
    if (!p) return err('NOT_IN_ROOM', 'You are not in this room');
    if (p.recentActions.includes(actionId)) return { ok: true, duplicate: true };
    if (this.phase !== 'playing') return err('NO_GAME', 'No game is in progress');

    const result = applyAction(this.game!, action);
    if (!result.ok) return { ok: false, error: result.error };

    p.recentActions.push(actionId);
    if (p.recentActions.length > RECENT_ACTIONS) p.recentActions.shift();
    this.commit(result.state, result.events, by, action.type);
    this.touch();
    this.deps.onChange(this, result.events);
    return { ok: true };
  }

  /** For server-initiated actions (removal). Returns the events produced. */
  private applyGameAction(action: GameAction, cause: string): GameEvent[] {
    const result = applyAction(this.game!, action);
    if (!result.ok) return [];
    this.commit(result.state, result.events, action.playerId, `${action.type}:${cause}`);
    return result.events;
  }

  private commit(state: GameState, events: GameEvent[], actor: PlayerId, action: string): void {
    const gameNo = this.gameNo;
    this.game = state;
    this.deps.audit.action({ room: this.code, gameNo, actor, action });
    this.deps.audit.events({ room: this.code, gameNo, events });
    if (state.result) {
      this.session = recordGame(this.session, state);
      this.deps.audit.gameResult({ room: this.code, record: this.session.history.at(-1)! });
    }
  }

  /** Number of the current game (1-based). */
  get gameNo(): number {
    return this.session.history.length + (this.phase === 'playing' ? 1 : 0);
  }

  bumpVersion(): number {
    this.version += 1;
    return this.version;
  }

  private touch(): void {
    this.lastActivity = this.now();
  }

  /** Stop all timers (room deleted / server shutdown). */
  dispose(): void {
    for (const p of this.players) if (p.disconnectTimer) clearTimeout(p.disconnectTimer);
  }
}
