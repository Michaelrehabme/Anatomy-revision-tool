import type { Region, SubRegion } from './region';

export type ImageMode = 'single-structure' | 'atlas-slide';

export type ViewType =
  | 'anterior'
  | 'posterior'
  | 'lateral'
  | 'medial'
  | 'palmar'
  | 'dorsal'
  | 'plantar'
  | 'superior'
  | 'inferior'
  // The four obliques, for rotation sets rendered every 45 degrees. The
  // ligament plates are the first family to ship them; nothing filters on
  // view, so an oblique is a label and a slide title, not a new code path.
  | 'anterolateral'
  | 'posterolateral'
  | 'posteromedial'
  | 'anteromedial';

export type LayerType =
  | 'superficial-muscle'
  | 'deep-muscle'
  | 'skeletal'
  | 'landmark'
  | 'ligament'
  | 'other';

/**
 * A hotspot for one structure within one image. Coordinates are normalized
 * 0-1 against the image's own natural width/height, so one polygon set works
 * at every screen size — see AnatomyImageAsset.width/height and
 * lib/hotspot/normalizeCoordinates.ts for why that pairing matters.
 *
 * `polygons` supports multiple parts per structure (e.g. two visible muscle
 * heads, or a structure split by an overlapping one in front of it).
 */
export interface HotspotPolygon {
  structureId: string;
  /** The atlas slide's own numbered callout (e.g. "5"), kept for QA cross-check. */
  panelLabel?: string;
  polygons: number[][][];
  /** Normalized 0-1 area. Used to resolve overlapping hits: smallest wins. */
  area: number;
  centroid: [number, number];
  /**
   * Normalized radius of the scoring target, for hotspots that are a POINT
   * rather than a shape — a bony landmark, whose circle is sized from its real
   * dimensions. Its presence is what makes a hotspot scorable for accuracy:
   * see lib/hotspot/accuracy.ts. A muscle or bone outline has none, because
   * "how close to the middle of it" is not a question about a shape.
   */
  targetRadius?: number;
  /**
   * The target's SPINE, for a landmark that is a line rather than a point — a
   * crest, a ridge, the linea aspera. A polyline in the same normalized space
   * as `polygons`; scoring measures to the nearest point ON it, so the rings
   * are nested capsules rather than circles and `targetRadius` becomes the
   * ridge's half-width instead of its whole size.
   *
   * A polyline and not two endpoints, because these features curve: the chord
   * from the ASIS to the PSIS passes medial to the iliac crest's apex, so a
   * straight capsule would sit off the bone across the middle of its span.
   *
   * Absent, or a single point, means the landmark is a point and `centroid` is
   * the whole of it.
   */
  targetAxis?: number[][];
  /**
   * The same landmark on the OTHER side of the body, when the picture shows
   * both: one more spine per twin, in the same normalized space and scored
   * with the same `targetRadius`. A tap is measured to whichever is nearer,
   * because the left pedicle is as right an answer as the right one.
   */
  targetTwins?: number[][][];
  /**
   * The landmark ITSELF, inside the tappable outline in `polygons` — full marks
   * here, a pass in the margin around it.
   *
   * A traced region has to be grown a little to be hittable: a crest a few
   * pixels wide is not a fair target on a phone. But a hitbox generous enough
   * to tap is no longer able to say whether the tap was ON the crest or merely
   * near it, which is exactly what the rings tell a point target. This is the
   * same distinction for a shape. Absent when the outline needed no growing.
   */
  targetCore?: number[][][];
}

export interface AnatomyImageAsset {
  id: string;
  /** Path under /public, e.g. "/anatomy/hip-thigh/sartorius-isolated-anterior.png". */
  filePath: string;
  slideTitle?: string;
  mode: ImageMode;
  /** Set when mode === 'single-structure'. */
  structureId?: string;
  /** Set when mode === 'atlas-slide' — the structures visible across its panels. */
  panelStructureNames?: string[];
  region: Region;
  subregion?: SubRegion;
  view: ViewType;
  layer: LayerType;
  /** Absent/empty = usable for flashcard/MCQ image prompts, but no locate questions. */
  hotspots?: HotspotPolygon[];
  /** Never hardcode a licence string in the UI — always render this field. */
  credit: string;
  licence: string;
  /** Natural pixel dimensions. Required for correct hotspot normalization (see HotspotImage.tsx). */
  width?: number;
  height?: number;
}
