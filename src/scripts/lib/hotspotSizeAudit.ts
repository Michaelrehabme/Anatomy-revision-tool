import type { AnatomyImageAsset, HotspotPolygon } from '../../features/anatomy-revision/types/image';
import { polygonsArea } from '../../features/anatomy-revision/lib/hotspot/polygonGeometry';

/**
 * Finds hitboxes that are too BIG.
 *
 * Every publisher enforces a floor — MIN_TAPPABLE_WIDTH, MIN_ZONE_PX,
 * MIN_REGION_SHARE, MIN_TARGET_AREA — because the bug that hurts first is a
 * target too thin to tap. Nothing enforced a ceiling, and two mechanisms
 * inflate targets with nothing watching: landmark regions are grown by 6mm
 * (at least 16px) and floored at 55px, and a landmark circle is 2.5x the
 * landmark's own radius. Measured on 20 Sep 2026, 38 of 188 landmark hitboxes
 * covered more than a tenth of their frame, the largest 27%, and the
 * hit-test's smallest-wins rule means a bloated hitbox never loses a tap to
 * a neighbour — it just makes its own question trivially easy.
 *
 * The thresholds are per family, set from that measured distribution so the
 * list is one a person can act on: a whole tibia legitimately covers 8% of a
 * bone plate, a latissimus 10% of a region plate, so those pass; a landmark
 * point whose pass zone is a fifth of the frame does not.
 */
export type HotspotFamily = 'landmark' | 'sub' | 'region' | 'bone' | 'deep' | 'ligament' | 'joint' | 'other';

export function familyOf(imageId: string): HotspotFamily {
  const prefix = imageId.split('-')[0];
  return (['landmark', 'sub', 'region', 'bone', 'deep', 'ligament', 'joint'] as const).find((f) => f === prefix) ?? 'other';
}

export interface FamilyThresholds {
  /** Fraction of the frame a hitbox may cover. */
  maxArea: number;
  /**
   * Point landmarks only: the whole target's radius as a fraction of the frame
   * width. The 10/10 zone is 40% of it (PASS_FRACTION). Matches
   * MAX_TARGET_FRAC in publishLandmarks.ts, which enforces it at publish time.
   */
  maxTargetRadius?: number;
  /**
   * Surface landmarks only: the core (the anatomy, full marks) must be at
   * least this share of its hitbox — checked only on hitboxes larger than
   * `coreCheckAbove`. A thin ridge grown by 6mm is ALWAYS a small share of its
   * hitbox, and that is the perfect-versus-good design working; it only
   * matters when the margin has made a hitbox big.
   */
  minCoreShare?: number;
  coreCheckAbove?: number;
}

export const THRESHOLDS: Record<HotspotFamily, FamilyThresholds> = {
  // A point target: its whole circle is 2.5x the landmark, so a radius over a
  // tenth of the frame means the landmark itself is 4% of the frame across.
  landmark: { maxArea: 0.15, maxTargetRadius: 0.12, minCoreShare: 0.35, coreCheckAbove: 0.08 },
  sub: { maxArea: 0.15 },
  bone: { maxArea: 0.15 },
  region: { maxArea: 0.12 },
  deep: { maxArea: 0.06 },
  ligament: { maxArea: 0.06 },
  joint: { maxArea: 0.06 },
  other: { maxArea: 0.15 },
};


/**
 * Hitboxes that are big because the ANATOMY is big, checked by eye and
 * accepted, each with a ceiling at its measured size so that growth is still
 * caught. Shrinking these would redraw the anatomy wrong: a tap on the real
 * ilium must count as the ilium. Measured 21 Sep 2026 after large regions
 * were given the minimum margin (publishLandmarks.ts, LARGE_REGION_SHARE).
 */
export const ACCEPTED_LARGE: Record<string, { maxArea: number; why: string }> = {
  'landmark-infraspinous-fossa-posterior': { maxArea: 0.225, why: 'the fossa is most of the posterior scapula; outline reviewed in three passes' },
  'landmark-ilium-lateral': { maxArea: 0.185, why: 'the ilium is the blade of the hip bone, framed on the hip bone' },
  'landmark-pubis-anterior': { maxArea: 0.18, why: 'outline reviewed in a second pass; the anatomy alone is 13.6% of the plate' },
  'sub-sacrum-a000-plate': { maxArea: 0.185, why: 'a whole-bone outline on the plate framed for the sacral landmarks' },
};

export interface HotspotOffender {
  imageId: string;
  structureId: string;
  family: HotspotFamily;
  area: number;
  targetRadius?: number;
  coreShare?: number;
  reason: string;
}

export interface FamilyStats {
  count: number;
  median: number;
  p90: number;
  max: number;
  offenders: number;
}

export interface HotspotAudit {
  families: Partial<Record<HotspotFamily, FamilyStats>>;
  offenders: HotspotOffender[];
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))];
}

/** Why one hotspot is over the line, or null when it is fine. */
export function judgeHotspot(imageId: string, hotspot: HotspotPolygon, thresholds = THRESHOLDS): HotspotOffender | null {
  const family = familyOf(imageId);
  const accepted = ACCEPTED_LARGE[imageId];
  const t = accepted ? { ...thresholds[family], maxArea: Math.max(thresholds[family].maxArea, accepted.maxArea) } : thresholds[family];
  const isPoint = family === 'landmark' && hotspot.targetRadius !== undefined && !hotspot.targetCore;
  const coreShare = hotspot.targetCore && hotspot.area > 0 ? polygonsArea(hotspot.targetCore) / hotspot.area : undefined;
  const reasons: string[] = [];

  if (isPoint) {
    // A small tolerance: radii are written to five decimals.
    if (t.maxTargetRadius !== undefined && (hotspot.targetRadius ?? 0) > t.maxTargetRadius + 1e-4) {
      reasons.push(`target radius ${(hotspot.targetRadius! * 100).toFixed(1)}% of the frame (limit ${t.maxTargetRadius * 100}%)`);
    }
  } else {
    if (hotspot.area > t.maxArea) {
      reasons.push(`covers ${(hotspot.area * 100).toFixed(1)}% of the frame (limit ${t.maxArea * 100}%)`);
    }
    if (coreShare !== undefined && t.minCoreShare !== undefined && hotspot.area > (t.coreCheckAbove ?? 0) && coreShare < t.minCoreShare) {
      reasons.push(`the anatomy is only ${(coreShare * 100).toFixed(0)}% of its hitbox (at least ${t.minCoreShare * 100}% expected)`);
    }
  }

  if (reasons.length === 0) return null;
  return {
    imageId,
    structureId: hotspot.structureId,
    family,
    area: hotspot.area,
    targetRadius: hotspot.targetRadius,
    coreShare,
    reason: reasons.join('; '),
  };
}

export function auditHotspotSizes(images: readonly AnatomyImageAsset[], thresholds = THRESHOLDS): HotspotAudit {
  const areas = new Map<HotspotFamily, number[]>();
  const offenders: HotspotOffender[] = [];
  for (const image of images) {
    for (const hotspot of image.hotspots ?? []) {
      const family = familyOf(image.id);
      const list = areas.get(family) ?? [];
      list.push(hotspot.area);
      areas.set(family, list);
      const verdict = judgeHotspot(image.id, hotspot, thresholds);
      if (verdict) offenders.push(verdict);
    }
  }
  const families: Partial<Record<HotspotFamily, FamilyStats>> = {};
  for (const [family, list] of areas) {
    const sorted = [...list].sort((a, b) => a - b);
    families[family] = {
      count: sorted.length,
      median: quantile(sorted, 0.5),
      p90: quantile(sorted, 0.9),
      max: sorted[sorted.length - 1],
      offenders: offenders.filter((o) => o.family === family).length,
    };
  }
  offenders.sort((a, b) => b.area - a.area);
  return { families, offenders };
}
