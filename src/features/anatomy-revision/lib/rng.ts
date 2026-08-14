/**
 * Tiny seeded PRNG (mulberry32) so question generation is deterministic and
 * unit-testable. Runtime call sites default to a Date.now()-seeded instance;
 * tests pass a fixed seed for reproducible output.
 */
export type Rng = () => number;

export function createRng(seed: number = Date.now()): Rng {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle using the given rng, non-mutating. */
export function shuffle<T>(items: T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Sample `count` unique items from `items` without replacement. */
export function sample<T>(items: T[], count: number, rng: Rng): T[] {
  return shuffle(items, rng).slice(0, Math.min(count, items.length));
}
