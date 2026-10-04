import { describe, expect, it } from 'vitest';
import { countSet, depthGate, dilateBy, seamBand } from '../lib/seamBand';

const W = 40;
const H = 20;
/** A filled rectangle, x0..x1 and y0..y1 inclusive. */
function rect(x0: number, x1: number, y0: number, y1: number): Uint8Array {
  const m = new Uint8Array(W * H);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m[y * W + x] = 1;
  return m;
}
const columns = (mask: Uint8Array) => {
  const xs = new Set<number>();
  for (let i = 0; i < mask.length; i++) if (mask[i]) xs.add(i % W);
  return [...xs].sort((a, b) => a - b);
};

describe('the seam between two bones', () => {
  // Two bones side by side with a two-pixel gap at x = 19..20.
  const a = rect(5, 18, 2, 17);
  const b = rect(21, 34, 2, 17);
  const contact = rect(18, 21, 6, 13);

  it('is the strip where the two silhouettes meet, not either bone', () => {
    const band = seamBand(a, b, contact, W, H, 3, 4);
    expect(countSet(band)).toBeGreaterThan(0);
    // A reach of 3 from each side of the gap: columns 18..21 and no further.
    expect(columns(band)).toEqual([18, 19, 20, 21]);
  });

  it('is kept only near the contact surface', () => {
    const band = seamBand(a, b, rect(18, 21, 9, 10), W, H, 3, 1);
    const rows = new Set<number>();
    for (let i = 0; i < band.length; i++) if (band[i]) rows.add(Math.floor(i / W));
    expect(Math.min(...rows)).toBeGreaterThanOrEqual(5);
    expect(Math.max(...rows)).toBeLessThanOrEqual(14);
  });

  it('grows by the number of pixels asked', () => {
    expect(columns(dilateBy(rect(10, 10, 5, 5), W, H, 2))).toEqual([8, 9, 10, 11, 12]);
  });
});

describe('the depth gate', () => {
  const a = rect(5, 18, 2, 17);
  const b = rect(21, 34, 2, 17);
  const band = seamBand(a, b, rect(18, 21, 2, 17), W, H, 3, 4);
  const flat = (value: number) => new Float32Array(W * H).fill(value);

  it('keeps a seam whose two bones are level', () => {
    const kept = depthGate(band, a, b, flat(0.1), flat(0.101), W, H, 5, 0.003);
    expect(countSet(kept)).toBe(countSet(band));
  });

  it('drops a seam where one bone stands well behind the other', () => {
    const kept = depthGate(band, a, b, flat(0.1), flat(0.11), W, H, 5, 0.003);
    expect(countSet(kept)).toBe(0);
  });

  it('cuts only the stretch that steps back', () => {
    // The lower half of bone b is 10 mm behind; the upper half is level.
    const depthB = flat(0.1);
    for (let y = 10; y < H; y++) for (let x = 0; x < W; x++) depthB[y * W + x] = 0.11;
    const kept = depthGate(band, a, b, flat(0.1), depthB, W, H, 5, 0.003);
    const rows = new Set<number>();
    for (let i = 0; i < kept.length; i++) if (kept[i]) rows.add(Math.floor(i / W));
    expect(countSet(kept)).toBeGreaterThan(0);
    expect(Math.max(...rows)).toBeLessThan(10);
  });
});
