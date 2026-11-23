import { describe, expect, it } from 'vitest';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@ace/shared';
import { CODE_MAX_LENGTH, GAMES, gameForCode, joinUrl, normalizeCode } from '../src/games';

const aceDonkey = GAMES.find((g) => g.id === 'ace-donkey')!;

describe('Join Game codes', () => {
  it('sends every valid Ace / Donkey room code to Ace / Donkey', () => {
    const code = ROOM_CODE_ALPHABET.slice(0, ROOM_CODE_LENGTH);
    expect(gameForCode(code)).toBe(aceDonkey);
    for (const ch of ROOM_CODE_ALPHABET) {
      expect(gameForCode(ch.repeat(ROOM_CODE_LENGTH))).toBe(aceDonkey);
    }
  });

  it('rejects codes Ace / Donkey can never issue', () => {
    expect(gameForCode('ABC12')).toBeUndefined(); // too short
    expect(gameForCode('ABCDE0')).toBeUndefined(); // 0 is not in the alphabet
    expect(gameForCode('ABCDEO')).toBeUndefined(); // nor is O
  });

  it('accepts codes up to the longest any game uses', () => {
    expect(CODE_MAX_LENGTH).toBeGreaterThanOrEqual(ROOM_CODE_LENGTH);
  });

  it('cleans up typed input', () => {
    expect(normalizeCode(' ab-c 23x9 ')).toBe('ABC23X');
  });

  it('opens the game straight into the room', () => {
    expect(joinUrl(aceDonkey, 'ABC234')).toBe('http://localhost:5173/?room=ABC234');
  });
});
