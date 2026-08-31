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
 * The seven major areas the app is studied by (CR-017) — the way MSK anatomy is
 * actually taught and examined, for every category of structure, not just joints.
 *
 * This replaces Region as the study filter. Region survives in the data model and
 * still drives the Atlas, Progress and admin analytics, but it was too coarse to
 * revise by: 'forearm-hand' lumps elbow and wrist/hand structures together, and
 * the knee straddles 'hip-thigh' and 'lower-leg-foot'. Area is derived from
 * SubRegion (see AREA_BY_SUBREGION), which every structure already carries, so
 * this needed no new content authoring.
 */
export type Area =
  | 'shoulder'
  | 'elbow'
  | 'wrist-hand'
  | 'hip'
  | 'knee'
  | 'ankle-foot'
  | 'back-core';

/** Proximal-to-distal down the upper limb, then the lower limb, then the trunk. */
export const AREAS: Area[] = [
  'shoulder',
  'elbow',
  'wrist-hand',
  'hip',
  'knee',
  'ankle-foot',
  'back-core',
];

/**
 * Every SubRegion maps to exactly one Area. Six map straight across; the trunk's
 * three (spine/torso/neck) collapse into 'back-core'. SubRegion itself keeps the
 * finer split because distractors.ts uses it to pick plausible wrong answers —
 * a cervical vertebra is a better distractor for another cervical vertebra than
 * for a rib.
 */
export const AREA_BY_SUBREGION: Record<SubRegion, Area> = {
  shoulder: 'shoulder',
  elbow: 'elbow',
  'wrist-hand': 'wrist-hand',
  hip: 'hip',
  knee: 'knee',
  'ankle-foot': 'ankle-foot',
  spine: 'back-core',
  torso: 'back-core',
  neck: 'back-core',
};

export const AREA_LABELS: Record<Area, string> = {
  shoulder: 'Shoulder',
  elbow: 'Elbow',
  'wrist-hand': 'Wrist & Hand',
  hip: 'Hip',
  knee: 'Knee',
  'ankle-foot': 'Ankle & Foot',
  'back-core': 'Back & Core',
};

/** Maps a structure's subregion to its area. Central so nothing re-derives it ad hoc. */
export function areaForSubRegion(subregion: SubRegion | undefined): Area | undefined {
  return subregion ? AREA_BY_SUBREGION[subregion] : undefined;
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
