/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Socket server URL, e.g. https://ace-donkey-server.onrender.com */
  readonly VITE_SERVER_URL?: string;
  /** Where the session token lives: "local" (default, survives restarts) or "session" (per tab). */
  readonly VITE_TOKEN_STORAGE?: 'local' | 'session';
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
