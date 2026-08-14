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
