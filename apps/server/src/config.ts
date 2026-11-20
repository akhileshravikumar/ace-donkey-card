import { DEFAULT_DISCONNECT_GRACE_MS } from '@ace/shared';

export interface ServerConfig {
  port: number;
  /** Allowed browser origins for CORS (comma-separated in CLIENT_ORIGIN). */
  clientOrigins: string[];
  /** R15: how long a disconnected player's seat is held. */
  disconnectGraceMs: number;
  /** Rooms with nobody connected are deleted after this long. */
  roomIdleMs: number;
  logLevel: string;
  /** Per-socket token bucket: burst size and sustained events per second. */
  rateLimit: { burst: number; perSecond: number };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: Number(env.PORT ?? 3001),
    clientOrigins: (env.CLIENT_ORIGIN ?? 'http://localhost:5173')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    disconnectGraceMs: Number(env.DISCONNECT_GRACE_MS ?? DEFAULT_DISCONNECT_GRACE_MS),
    roomIdleMs: Number(env.ROOM_IDLE_MS ?? 30 * 60_000),
    logLevel: env.LOG_LEVEL ?? 'info',
    rateLimit: {
      burst: Number(env.RATE_LIMIT_BURST ?? 20),
      perSecond: Number(env.RATE_LIMIT_PER_SECOND ?? 10),
    },
  };
}
