/** Random source: returns an integer in [0, maxExclusive). Injected so the engine stays pure. */
export type Rng = (maxExclusive: number) => number;

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Deterministic RNG for tests and simulations (mulberry32). Never use for real games. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return (maxExclusive: number) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return Math.floor(r * maxExclusive);
  };
}
