export const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';
export const TOKEN_STORAGE: 'local' | 'session' = import.meta.env.VITE_TOKEN_STORAGE ?? 'local';
/** How long a player has between two taps/clicks for it to count as a double-click (play). */
export const DOUBLE_TAP_MS = 350;
export const ACK_TIMEOUT_MS = 8000;
export const HOME_URL = (import.meta.env.VITE_HOME_URL ?? 'http://localhost:5174').replace(
  /\/$/,
  '',
);
