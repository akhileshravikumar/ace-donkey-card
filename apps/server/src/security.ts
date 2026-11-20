import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, type Rng } from '@ace/shared';

/** Cryptographically secure RNG for shuffling (fairness). */
export const secureRng: Rng = (maxExclusive) => randomInt(maxExclusive);

export const newPlayerId = (): string => randomUUID();

/** 128-bit session token; only its hash is stored. */
export const newToken = (): string => randomBytes(16).toString('base64url');

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export function newRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++)
    code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  return code;
}

/** Simple token bucket per socket to stop event flooding. */
export class RateLimiter {
  private tokens: number;
  private last: number;
  constructor(
    private readonly capacity = 20,
    private readonly refillPerSecond = 10,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = capacity;
    this.last = now();
  }
  take(): boolean {
    const t = this.now();
    this.tokens = Math.min(
      this.capacity,
      this.tokens + ((t - this.last) / 1000) * this.refillPerSecond,
    );
    this.last = t;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}
