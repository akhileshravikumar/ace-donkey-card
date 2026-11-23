import {
  AVATAR_FACE_COUNT,
  AVATAR_GLASSES,
  AVATAR_MOUTHS,
  type Avatar,
  avatarSchema,
} from '@ace/shared';
import type { KeyValueStore } from './storage';

const KEY = 'ace-donkey.avatar';

/** A random face colour, glasses and mouth, so new players don't all look the same. */
export function randomAvatar(random: () => number = Math.random): Avatar {
  const pick = (n: number) => Math.floor(random() * n);
  return {
    face: pick(AVATAR_FACE_COUNT),
    glasses: pick(AVATAR_GLASSES.length),
    mouth: pick(AVATAR_MOUTHS.length),
  };
}

/** Step an option index forward or back, wrapping around (the Customize arrows). */
export function cycle(index: number, step: 1 | -1, count: number): number {
  return (index + step + count) % count;
}

/**
 * The player's avatar lives in localStorage so it follows them between rooms and tabs. A saved
 * avatar from an older version (different parts) fails validation and is replaced by a new one.
 */
export function loadAvatar(store: KeyValueStore | null): Avatar {
  try {
    const parsed = avatarSchema.safeParse(JSON.parse(store?.getItem(KEY) ?? 'null'));
    if (parsed.success) return parsed.data;
  } catch {
    /* fall through */
  }
  const avatar = randomAvatar();
  saveAvatar(store, avatar);
  return avatar;
}

export function saveAvatar(store: KeyValueStore | null, avatar: Avatar): void {
  try {
    store?.setItem(KEY, JSON.stringify(avatar));
  } catch {
    /* ignore */
  }
}
