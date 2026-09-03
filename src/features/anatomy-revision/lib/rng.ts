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

/**
 * Fisher-Yates' weighted cousin: repeated weighted draw without replacement, so
 * heavier items tend towards the front but every item still appears exactly
 * once. Slicing the result gives a weighted sample.
 *
 * O(n²) by design — n here is one session's generated questions (hundreds), and
 * an exact walk keeps the output reproducible under a seed, which the
 * alternatives (reservoir/alias tricks) make fiddly to guarantee.
 *
 * Falls back to a uniform shuffle when no positive weight remains, so a caller
 * passing all-zero weights gets a sane set rather than an empty one.
 */
export function weightedShuffle<T>(items: T[], weightOf: (item: T) => number, rng: Rng): T[] {
  const remaining = [...items];
  const weights = remaining.map((item) => Math.max(0, weightOf(item)));
  const result: T[] = [];

  while (remaining.length > 0) {
    const total = weights.reduce((sum, w) => sum + w, 0);
    if (total <= 0) {
      result.push(...shuffle(remaining, rng));
      break;
    }

    let target = rng() * total;
    let picked = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      target -= weights[i];
      if (target <= 0) {
        picked = i;
        break;
      }
    }

    result.push(remaining[picked]);
    remaining.splice(picked, 1);
    weights.splice(picked, 1);
  }

  return result;
}
