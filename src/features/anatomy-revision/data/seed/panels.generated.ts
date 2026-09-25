import type { LayerType } from '../../types/image';
import type { Region, SubRegion } from '../../types/region';

/**
 * GENERATED — do not edit by hand.
 * Regenerate with: npx tsx src/scripts/generateMusclePanels.ts
 *
 * One row per file in public/anatomy/panels/. Dimensions are measured from
 * the images themselves, so the aspect ratio the app reserves always matches
 * what it is about to load. See that script for why layer is the only field
 * a human still chooses.
 */
export interface MusclePanel {
  structureId: string;
  region: Region;
  subregion: SubRegion;
  layer: LayerType;
  width: number;
  height: number;
}

export const MUSCLE_PANELS: MusclePanel[] = [
  { structureId: 'acromioclavicular-joint', region: 'shoulder-arm', subregion: 'shoulder', layer: 'skeletal', width: 2627, height: 900 },
  { structureId: 'atlas-c1', region: 'back-core', subregion: 'neck', layer: 'skeletal', width: 2148, height: 900 },
  { structureId: 'axis-c2', region: 'back-core', subregion: 'neck', layer: 'skeletal', width: 2700, height: 900 },
  { structureId: 'c7-vertebra', region: 'back-core', subregion: 'neck', layer: 'skeletal', width: 2575, height: 900 },
  { structureId: 'calcaneus', region: 'lower-leg-foot', subregion: 'ankle-foot', layer: 'landmark', width: 1081, height: 1386 },
  { structureId: 'capitate', region: 'forearm-hand', subregion: 'wrist-hand', layer: 'landmark', width: 1490, height: 1437 },
  { structureId: 'carpals', region: 'forearm-hand', subregion: 'wrist-hand', layer: 'skeletal', width: 1490, height: 1437 },
  { structureId: 'cervical-vertebrae', region: 'back-core', subregion: 'neck', layer: 'skeletal', width: 2572, height: 900 },
  { structureId: 'clavicle', region: 'shoulder-arm', subregion: 'shoulder', layer: 'skeletal', width: 1564, height: 822 },
  { structureId: 'coccyx', region: 'back-core', subregion: 'spine', layer: 'skeletal', width: 2423, height: 900 },
  { structureId: 'costovertebral-joint', region: 'back-core', subregion: 'spine', layer: 'skeletal', width: 1666, height: 900 },
  { structureId: 'cuboid', region: 'lower-leg-foot', subregion: 'ankle-foot', layer: 'landmark', width: 1081, height: 1386 },
  { structureId: 'femur', region: 'hip-thigh', subregion: 'hip', layer: 'skeletal', width: 1328, height: 900 },
  { structureId: 'fibula', region: 'lower-leg-foot', subregion: 'knee', layer: 'skeletal', width: 899, height: 694 },
  { structureId: 'first-rib', region: 'back-core', subregion: 'torso', layer: 'landmark', width: 2420, height: 900 },
  { structureId: 'glenohumeral-joint', region: 'shoulder-arm', subregion: 'shoulder', layer: 'skeletal', width: 2340, height: 900 },
  { structureId: 'hamate', region: 'forearm-hand', subregion: 'wrist-hand', layer: 'landmark', width: 1490, height: 1437 },
  { structureId: 'humerus', region: 'shoulder-arm', subregion: 'shoulder', layer: 'skeletal', width: 1235, height: 806 },
  { structureId: 'intermediate-cuneiform', region: 'lower-leg-foot', subregion: 'ankle-foot', layer: 'landmark', width: 1081, height: 1386 },
  { structureId: 'intervertebral-disc', region: 'back-core', subregion: 'spine', layer: 'landmark', width: 1446, height: 751 },
  { structureId: 'l4-vertebra', region: 'back-core', subregion: 'spine', layer: 'landmark', width: 2552, height: 900 },
  { structureId: 'l5-vertebra', region: 'back-core', subregion: 'spine', layer: 'landmark', width: 2480, height: 900 },
  { structureId: 'lateral-cuneiform', region: 'lower-leg-foot', subregion: 'ankle-foot', layer: 'landmark', width: 1081, height: 1386 },
  { structureId: 'lateral-malleolus', region: 'lower-leg-foot', subregion: 'ankle-foot', layer: 'landmark', width: 2163, height: 900 },
  { structureId: 'lumbar-vertebrae', region: 'back-core', subregion: 'spine', layer: 'skeletal', width: 2283, height: 900 },
  { structureId: 'lunate', region: 'forearm-hand', subregion: 'wrist-hand', layer: 'landmark', width: 1490, height: 1437 },
  { structureId: 'medial-cuneiform', region: 'lower-leg-foot', subregion: 'ankle-foot', layer: 'landmark', width: 1081, height: 1386 },
  { structureId: 'medial-malleolus', region: 'lower-leg-foot', subregion: 'ankle-foot', layer: 'landmark', width: 2449, height: 719 },
  { structureId: 'metacarpals', region: 'forearm-hand', subregion: 'wrist-hand', layer: 'skeletal', width: 1490, height: 1437 },
  { structureId: 'metacarpophalangeal-joint', region: 'forearm-hand', subregion: 'wrist-hand', layer: 'skeletal', width: 1583, height: 900 },
  { structureId: 'metatarsals', region: 'lower-leg-foot', subregion: 'ankle-foot', layer: 'skeletal', width: 1081, height: 1386 },
  { structureId: 'navicular', region: 'lower-leg-foot', subregion: 'ankle-foot', layer: 'landmark', width: 1081, height: 1386 },
  { structureId: 'patella', region: 'hip-thigh', subregion: 'knee', layer: 'skeletal', width: 2178, height: 900 },
  { structureId: 'pelvis', region: 'hip-thigh', subregion: 'hip', layer: 'skeletal', width: 2111, height: 900 },
  { structureId: 'phalanges-distal-foot', region: 'lower-leg-foot', subregion: 'ankle-foot', layer: 'skeletal', width: 1081, height: 1386 },
  { structureId: 'phalanges-distal-hand', region: 'forearm-hand', subregion: 'wrist-hand', layer: 'skeletal', width: 1490, height: 1437 },
  { structureId: 'phalanges-middle-foot', region: 'lower-leg-foot', subregion: 'ankle-foot', layer: 'skeletal', width: 1081, height: 1386 },
  { structureId: 'phalanges-middle-hand', region: 'forearm-hand', subregion: 'wrist-hand', layer: 'skeletal', width: 1490, height: 1437 },
  { structureId: 'phalanges-proximal-foot', region: 'lower-leg-foot', subregion: 'ankle-foot', layer: 'skeletal', width: 1081, height: 1386 },
  { structureId: 'phalanges-proximal-hand', region: 'forearm-hand', subregion: 'wrist-hand', layer: 'skeletal', width: 1490, height: 1437 },
  { structureId: 'pisiform', region: 'forearm-hand', subregion: 'wrist-hand', layer: 'landmark', width: 1490, height: 1437 },
  { structureId: 'pubic-symphysis', region: 'hip-thigh', subregion: 'hip', layer: 'skeletal', width: 2405, height: 900 },
  { structureId: 'radius', region: 'forearm-hand', subregion: 'elbow', layer: 'skeletal', width: 898, height: 1387 },
  { structureId: 'ribs', region: 'back-core', subregion: 'torso', layer: 'skeletal', width: 1542, height: 896 },
  { structureId: 'sacrum', region: 'back-core', subregion: 'spine', layer: 'skeletal', width: 2331, height: 900 },
  { structureId: 'scaphoid', region: 'forearm-hand', subregion: 'wrist-hand', layer: 'landmark', width: 1490, height: 1437 },
  { structureId: 'scapula', region: 'shoulder-arm', subregion: 'shoulder', layer: 'skeletal', width: 1481, height: 858 },
  { structureId: 'sternal-body', region: 'back-core', subregion: 'torso', layer: 'landmark', width: 2300, height: 900 },
  { structureId: 'sternoclavicular-joint', region: 'shoulder-arm', subregion: 'shoulder', layer: 'skeletal', width: 2572, height: 900 },
  { structureId: 'subtalar-joint', region: 'lower-leg-foot', subregion: 'ankle-foot', layer: 'skeletal', width: 2284, height: 856 },
  { structureId: 'talus', region: 'lower-leg-foot', subregion: 'ankle-foot', layer: 'landmark', width: 1081, height: 1386 },
  { structureId: 'tarsals', region: 'lower-leg-foot', subregion: 'ankle-foot', layer: 'skeletal', width: 1081, height: 1386 },
  { structureId: 'thoracic-vertebrae', region: 'back-core', subregion: 'spine', layer: 'skeletal', width: 1566, height: 900 },
  { structureId: 'tibia', region: 'lower-leg-foot', subregion: 'knee', layer: 'skeletal', width: 908, height: 716 },
  { structureId: 'transverse-tarsal-joint', region: 'lower-leg-foot', subregion: 'ankle-foot', layer: 'skeletal', width: 1379, height: 523 },
  { structureId: 'trapezium', region: 'forearm-hand', subregion: 'wrist-hand', layer: 'landmark', width: 1490, height: 1437 },
  { structureId: 'trapezoid', region: 'forearm-hand', subregion: 'wrist-hand', layer: 'landmark', width: 1490, height: 1437 },
  { structureId: 'triquetrum', region: 'forearm-hand', subregion: 'wrist-hand', layer: 'landmark', width: 1490, height: 1437 },
  { structureId: 'twelfth-rib', region: 'back-core', subregion: 'torso', layer: 'landmark', width: 2314, height: 900 },
  { structureId: 'ulna', region: 'forearm-hand', subregion: 'elbow', layer: 'skeletal', width: 898, height: 1387 },
  { structureId: 'xiphoid-process', region: 'back-core', subregion: 'torso', layer: 'landmark', width: 2413, height: 900 },
];
