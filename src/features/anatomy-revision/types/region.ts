/**
 * Region stays fixed to the 5 values already established by the muscles.json
 * pipeline (Downloads/muscles.json) — don't fragment the muscle dataset's own enum.
 * SubRegion is a new, optional, finer-grained field that fixes the granularity
 * gap in the old quiz.py's REGION_MAP (which collapsed e.g. Shoulder and Elbow
 * onto the same region for filtering purposes).
 */
export type Region = 'hip-thigh' | 'shoulder-arm' | 'forearm-hand' | 'lower-leg-foot' | 'back-core';

export const REGIONS: Region[] = ['hip-thigh', 'shoulder-arm', 'forearm-hand', 'lower-leg-foot', 'back-core'];

export const REGION_LABELS: Record<Region, string> = {
  'hip-thigh': 'Hip & Thigh',
  'shoulder-arm': 'Shoulder & Arm',
  'forearm-hand': 'Forearm & Hand',
  'lower-leg-foot': 'Lower Leg & Foot',
  'back-core': 'Back & Core',
};

export type SubRegion =
  | 'shoulder'
  | 'elbow'
  | 'wrist-hand'
  | 'hip'
  | 'knee'
  | 'ankle-foot'
  | 'spine'
  | 'torso'
  | 'neck';

export const SUBREGION_LABELS: Record<SubRegion, string> = {
  shoulder: 'Shoulder',
  elbow: 'Elbow',
  'wrist-hand': 'Wrist & Hand',
  hip: 'Hip',
  knee: 'Knee',
  'ankle-foot': 'Ankle & Foot',
  spine: 'Spine',
  torso: 'Torso',
  neck: 'Neck',
};

/**
 * The nine areas the app is studied by (CR-017, split further by CR-032) — the way
 * MSK anatomy is actually taught and examined, for every category of structure.
 *
 * This replaces Region as the study filter. Region survives in the data model and
 * still drives the Atlas, Progress and admin analytics, but it was too coarse to
 * revise by: 'forearm-hand' lumps elbow and wrist/hand structures together, the
 * knee straddles 'hip-thigh' and 'lower-leg-foot', and 'back-core' ran from the
 * atlas to the coccyx. Areas are derived from SubRegion (see AREAS_BY_SUBREGION),
 * with a per-structure `areas` override for the spine, where the subregion alone
 * cannot say which level a structure belongs to.
 */
export type Area =
  | 'shoulder'
  | 'elbow'
  | 'wrist-hand'
  | 'hip'
  | 'knee'
  | 'ankle-foot'
  | 'cervical-spine'
  | 'thoracic-spine'
  | 'lumbar-spine';

/** Proximal-to-distal down the upper limb, then the lower limb, then the spine top-down. */
export const AREAS: Area[] = [
  'shoulder',
  'elbow',
  'wrist-hand',
  'hip',
  'knee',
  'ankle-foot',
  'cervical-spine',
  'thoracic-spine',
  'lumbar-spine',
];

/** The three spine areas, top-down. A level-agnostic vertebral structure belongs to all of them. */
export const SPINE_AREAS: Area[] = ['cervical-spine', 'thoracic-spine', 'lumbar-spine'];

/**
 * Default areas for each SubRegion. The six limb subregions map one-to-one. The
 * trunk's three carry no vertebral level, so: neck -> cervical, torso (the thoracic
 * cage) -> thoracic, and 'spine' -> every spine area, which is right for a pedicle
 * or the erector spinae and is overridden in the seeds (`areas`) for anything that
 * does have a level (sacrum -> lumbar only). SubRegion itself keeps its own split
 * because distractors.ts uses it to pick plausible wrong answers.
 */
export const AREAS_BY_SUBREGION: Record<SubRegion, Area[]> = {
  shoulder: ['shoulder'],
  elbow: ['elbow'],
  'wrist-hand': ['wrist-hand'],
  hip: ['hip'],
  knee: ['knee'],
  'ankle-foot': ['ankle-foot'],
  spine: SPINE_AREAS,
  torso: ['thoracic-spine'],
  neck: ['cervical-spine'],
};

export const AREA_LABELS: Record<Area, string> = {
  shoulder: 'Shoulder',
  elbow: 'Elbow',
  'wrist-hand': 'Wrist & Hand',
  hip: 'Hip',
  knee: 'Knee',
  'ankle-foot': 'Ankle & Foot',
  'cervical-spine': 'Cervical Spine',
  'thoracic-spine': 'Thoracic Spine',
  'lumbar-spine': 'Lumbar Spine',
};

/** Maps a structure's subregion to its default areas. Central so nothing re-derives it ad hoc. */
export function areasForSubRegion(subregion: SubRegion | undefined): Area[] {
  return subregion ? AREAS_BY_SUBREGION[subregion] : [];
}

/**
 * Area values that were persisted (localStorage preferences, Firestore assignment
 * scopes) before they stopped existing. 'back-core' was split three ways by CR-032;
 * a student who had chosen it keeps the whole spine rather than silently getting
 * "every area" (which is what an empty selection means).
 */
export const LEGACY_AREA_EXPANSIONS: Record<string, Area[]> = {
  'back-core': SPINE_AREAS,
};

/**
 * Turns anything that claims to be a list of areas into a real one: junk is
 * dropped, legacy values are expanded, and the result is in canonical order
 * without duplicates. Safe on any input, so callers can pass parsed JSON as is.
 */
export function normaliseAreas(raw: unknown): Area[] {
  if (!Array.isArray(raw)) return [];
  const wanted = new Set<string>();
  for (const value of raw) {
    if (typeof value !== 'string') continue;
    for (const area of LEGACY_AREA_EXPANSIONS[value] ?? [value]) wanted.add(area);
  }
  return AREAS.filter((area) => wanted.has(area));
}

/**
 * The location label a session header shows. Areas are what the user filtered by,
 * so they are what the header must name — labelling a knee question "Lower Leg &
 * Foot" contradicts the chip they just picked. Falls back to the region only for
 * a structure with no subregion, which validateContent treats as an error.
 */
export function questionLocationLabel(q: { region: Region; area?: Area }): string {
  return q.area ? AREA_LABELS[q.area] : REGION_LABELS[q.region];
}

/**
 * Which subregions can plausibly appear within a given region. Used to power
 * UI filtering; a structure's own `subregion` field is optional and doesn't
 * have to be validated against this map at runtime (v1 keeps this soft).
 */
export const REGION_SUBREGIONS: Record<Region, SubRegion[]> = {
  'shoulder-arm': ['shoulder', 'elbow'],
  'forearm-hand': ['elbow', 'wrist-hand'],
  'hip-thigh': ['hip', 'knee'],
  'lower-leg-foot': ['knee', 'ankle-foot'],
  'back-core': ['spine', 'torso', 'neck'],
};
