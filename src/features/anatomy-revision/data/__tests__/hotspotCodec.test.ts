import { describe, expect, it } from 'vitest';
import type { HotspotPolygon } from '../../types/image';
import { decodeHotspotMap, decodeRing, encodeHotspotMap, encodeRing } from '../seed/hotspotCodec';

const SETS = import.meta.glob<Record<string, unknown>>('../seed/hotspots.*.generated.ts', {
  eager: true,
  import: '*',
});

/** What the built app would hold: encoded, through the JSON text the plugin writes, and decoded. */
const throughBundle = (set: Record<string, HotspotPolygon[]>) =>
  decodeHotspotMap(JSON.parse(JSON.stringify(encodeHotspotMap(set))));

describe('hotspotCodec', () => {
  it('round-trips a ring exactly, negatives and large jumps included', () => {
    const ring = [
      [0, 0],
      [0.4494, 0.5119],
      [-0.0001, 1],
      [0.9999, -0.5],
      [0.0029, 0.0029],
    ];
    const text = encodeRing(ring)!;
    expect(text).not.toContain('\\');
    expect(decodeRing(text)).toEqual(ring);
  });

  it('uses the places a ring needs, and leaves it alone past six', () => {
    expect(encodeRing([[0.4494, 0.5]])![0]).toBe('4');
    expect(decodeRing(encodeRing([[0.46063, 0.205]])!)).toEqual([[0.46063, 0.205]]);
    expect(encodeRing([[0.1234567, 0.5]])).toBeNull();
    const set = { img: [{ structureId: 's', polygons: [[[0.1234567, 0.5]]], area: 0, centroid: [0, 0] }] } as Record<
      string,
      HotspotPolygon[]
    >;
    expect(throughBundle(structuredClone(set))).toEqual(set);
  });

  it('gives back every published set exactly, and much smaller', () => {
    const names = Object.keys(SETS);
    expect(names.length).toBeGreaterThan(20);
    let before = 0;
    let after = 0;
    for (const name of names) {
      for (const [exportName, value] of Object.entries(SETS[name])) {
        if (typeof value !== 'object' || value === null) continue;
        if (!Object.values(value).every(Array.isArray)) continue;
        const set = value as Record<string, HotspotPolygon[]>;
        before += JSON.stringify(set).length;
        after += JSON.stringify(encodeHotspotMap(set)).length;
        expect(throughBundle(structuredClone(set)), `${name} ${exportName}`).toEqual(set);
      }
    }
    expect(after).toBeLessThan(before / 2);
  });
});
