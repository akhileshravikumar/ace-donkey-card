import { TOKEN_STORAGE } from '../config';

export interface StoredSession {
  roomCode: string;
  playerId: string;
  token: string;
}

const KEY = 'ace-donkey.session';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function defaultStore(): KeyValueStore | null {
  try {
    return TOKEN_STORAGE === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null; // storage blocked (private mode / embedded) — sessions just won't survive reloads
  }
}

export function loadSession(store: KeyValueStore | null): StoredSession | null {
  try {
    const raw = store?.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    return parsed.roomCode && parsed.playerId && parsed.token ? (parsed as StoredSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(store: KeyValueStore | null, session: StoredSession | null): void {
  try {
    if (session) store?.setItem(KEY, JSON.stringify(session));
    else store?.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
