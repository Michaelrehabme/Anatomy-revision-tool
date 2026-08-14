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
  | 'inferior';

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
