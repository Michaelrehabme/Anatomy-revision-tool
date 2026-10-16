import type { HotspotPolygon } from '../../types/image';

/**
 * A compact form for the hotspot sets, decoded once as each set loads.
 *
 * WHY. The outlines are most of what a phone stores to work offline. Written
 * as `[.4494,.5119],` a vertex costs about fourteen bytes, and every hotspot
 * repeats its keys and its structure's full name, often thirty times over in
 * one turntable. Gzip hides that on the wire, but Cache Storage keeps the body
 * as it arrived, uncompressed, so the precache held it all at full size.
 *
 * THE SOURCE FILES DO NOT CHANGE. The publishers still write plain
 * `hotspots.*.generated.ts`, which every script reads as it always has;
 * compactHotspotsPlugin (vite.config.ts) rewrites each one into this form at
 * build time only, and the module decodes itself as it loads. Nothing past
 * `attachHotspots` ever sees the packed form.
 *
 * LOSSLESS. A ring is written as integers at the fewest decimal places (four,
 * five or six) that give every coordinate in it back exactly; a ring that none
 * of them can is left as numbers, and the decoder takes either. Every other
 * field is carried as it was.
 *
 * Rings use the Google polyline algorithm (zig-zag deltas in five-bit groups,
 * each group a printable character), prefixed with the digit of decimal places,
 * and with one change: the group that would be a backslash is written as '!',
 * so the packed set needs no escaping.
 */

const OFFSET = 63;
const BACKSLASH = 92;
const STAND_IN = 33; // '!', below the scheme's range (it starts at 63)
const PLACES = [4, 5, 6];

type Ring = number[][];

/** A ring as text, or null when it is not exactly representable at six places or fewer. */
export function encodeRing(ring: Ring): string | null {
  for (const places of PLACES) {
    const text = encodeAt(ring, 10 ** places);
    if (text !== null) return String(places) + text;
  }
  return null;
}

function encodeAt(ring: Ring, scale: number): string | null {
  let out = '';
  let prevX = 0;
  let prevY = 0;
  for (const point of ring) {
    if (point.length !== 2) return null;
    const x = Math.round(point[0] * scale);
    const y = Math.round(point[1] * scale);
    if (x / scale !== point[0] || y / scale !== point[1]) return null;
    out += encodeValue(x - prevX) + encodeValue(y - prevY);
    prevX = x;
    prevY = y;
  }
  return out;
}

function encodeValue(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let out = '';
  while (v >= 0x20) {
    out += char((0x20 | (v & 0x1f)) + OFFSET);
    v >>= 5;
  }
  return out + char(v + OFFSET);
}

const char = (code: number) => String.fromCharCode(code === BACKSLASH ? STAND_IN : code);

export function decodeRing(text: string): Ring {
  const scale = 10 ** (text.charCodeAt(0) - 48);
  const ring: Ring = [];
  let i = 1;
  let x = 0;
  let y = 0;
  const next = () => {
    let shift = 0;
    let result = 0;
    let b: number;
    do {
      b = text.charCodeAt(i++);
      if (b === STAND_IN) b = BACKSLASH;
      b -= OFFSET;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < text.length) {
    x += next();
    y += next();
    ring.push([x / scale, y / scale]);
  }
  return ring;
}

/** A ring in the packed form: text when it encoded, the numbers when it did not. */
type StoredRing = string | Ring;

const encodeOrKeep = (ring: Ring): StoredRing => encodeRing(ring) ?? ring;
const decodeIfText = (ring: StoredRing): Ring => (typeof ring === 'string' ? decodeRing(ring) : ring);

/** Optional fields that hold a list of rings, and the one that holds a single ring. */
const RING_LISTS = ['targetCore', 'targetTwins'] as const;
const SINGLE_RING = 'targetAxis';

/**
 * One hotspot: [index into `ids`, polygons, area, centroid, rest?], where
 * `rest` holds whichever optional fields the hotspot has, rings encoded.
 */
type PackedHotspot = [number, StoredRing[], number, [number, number], Record<string, unknown>?];

export interface PackedHotspotSet {
  /** Every structure id the set mentions, once. */
  ids: string[];
  /** Image id -> its hotspots, in their original order. */
  images: Record<string, PackedHotspot[]>;
}

/** Build side: a whole set, packed. */
export function encodeHotspotMap(map: Record<string, HotspotPolygon[]>): PackedHotspotSet {
  const ids: string[] = [];
  const index = new Map<string, number>();
  const images: Record<string, PackedHotspot[]> = {};
  for (const [imageId, hotspots] of Object.entries(map)) {
    images[imageId] = hotspots.map((hotspot) => {
      const { structureId, polygons, area, centroid, ...optional } = hotspot;
      let at = index.get(structureId);
      if (at === undefined) {
        at = ids.push(structureId) - 1;
        index.set(structureId, at);
      }
      const rest: Record<string, unknown> = { ...optional };
      for (const key of RING_LISTS) {
        const rings = hotspot[key];
        if (rings) rest[key] = rings.map(encodeOrKeep);
      }
      const axis = hotspot[SINGLE_RING];
      if (axis) rest[SINGLE_RING] = encodeOrKeep(axis);
      const packed: PackedHotspot = [at, polygons.map(encodeOrKeep), area, centroid];
      if (Object.keys(rest).length > 0) packed.push(rest);
      return packed;
    });
  }
  return { ids, images };
}

/** App side: the set as the rest of the app expects it. */
export function decodeHotspotMap({ ids, images }: PackedHotspotSet): Record<string, HotspotPolygon[]> {
  const map: Record<string, HotspotPolygon[]> = {};
  for (const [imageId, packed] of Object.entries(images)) {
    map[imageId] = packed.map(([at, polygons, area, centroid, rest]) => {
      const hotspot = { structureId: ids[at], polygons: polygons.map(decodeIfText), area, centroid } as HotspotPolygon;
      if (rest) {
        Object.assign(hotspot, rest);
        for (const key of RING_LISTS) {
          const rings = rest[key] as StoredRing[] | undefined;
          if (rings) hotspot[key] = rings.map(decodeIfText);
        }
        const axis = rest[SINGLE_RING] as StoredRing | undefined;
        if (axis) hotspot[SINGLE_RING] = decodeIfText(axis);
      }
      return hotspot;
    });
  }
  return map;
}
