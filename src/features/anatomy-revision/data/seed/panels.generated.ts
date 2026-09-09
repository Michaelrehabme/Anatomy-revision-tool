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
  { structureId: 'abductor-hallucis', region: 'lower-leg-foot', subregion: 'ankle-foot', layer: 'deep-muscle', width: 2078, height: 506 },
  { structureId: 'adductor-brevis', region: 'hip-thigh', subregion: 'hip', layer: 'deep-muscle', width: 2184, height: 900 },
  { structureId: 'adductor-hallucis', region: 'lower-leg-foot', subregion: 'ankle-foot', layer: 'deep-muscle', width: 2078, height: 506 },
  { structureId: 'adductor-magnus', region: 'hip-thigh', subregion: 'hip', layer: 'deep-muscle', width: 1660, height: 900 },
  { structureId: 'biceps-brachii', region: 'shoulder-arm', subregion: 'elbow', layer: 'superficial-muscle', width: 1339, height: 835 },
  { structureId: 'biceps-femoris', region: 'hip-thigh', subregion: 'knee', layer: 'superficial-muscle', width: 1452, height: 900 },
  { structureId: 'brachialis', region: 'shoulder-arm', subregion: 'elbow', layer: 'deep-muscle', width: 1311, height: 874 },
  { structureId: 'brachioradialis', region: 'forearm-hand', subregion: 'elbow', layer: 'superficial-muscle', width: 1566, height: 893 },
  { structureId: 'coracobrachialis', region: 'shoulder-arm', subregion: 'shoulder', layer: 'deep-muscle', width: 1412, height: 836 },
  { structureId: 'deltoid', region: 'shoulder-arm', subregion: 'shoulder', layer: 'superficial-muscle', width: 1349, height: 753 },
  { structureId: 'diaphragm', region: 'back-core', subregion: 'spine', layer: 'deep-muscle', width: 2125, height: 900 },
  { structureId: 'dorsal-interossei-foot', region: 'lower-leg-foot', subregion: 'ankle-foot', layer: 'deep-muscle', width: 1255, height: 499 },
  { structureId: 'extensor-indicis', region: 'forearm-hand', subregion: 'wrist-hand', layer: 'deep-muscle', width: 1494, height: 900 },
  { structureId: 'flexor-digiti-minimi-brevis-foot', region: 'lower-leg-foot', subregion: 'ankle-foot', layer: 'deep-muscle', width: 1156, height: 472 },
  { structureId: 'flexor-digiti-minimi-brevis-hand', region: 'forearm-hand', subregion: 'wrist-hand', layer: 'deep-muscle', width: 1791, height: 900 },
  { structureId: 'flexor-digitorum-brevis', region: 'lower-leg-foot', subregion: 'ankle-foot', layer: 'deep-muscle', width: 1117, height: 472 },
  { structureId: 'flexor-digitorum-profundus', region: 'forearm-hand', subregion: 'wrist-hand', layer: 'deep-muscle', width: 1468, height: 900 },
  { structureId: 'flexor-hallucis-brevis', region: 'lower-leg-foot', subregion: 'ankle-foot', layer: 'deep-muscle', width: 1941, height: 508 },
  { structureId: 'gastrocnemius', region: 'lower-leg-foot', subregion: 'ankle-foot', layer: 'superficial-muscle', width: 2017, height: 894 },
  { structureId: 'gemelli', region: 'hip-thigh', subregion: 'hip', layer: 'deep-muscle', width: 2115, height: 900 },
  { structureId: 'gluteus-maximus', region: 'hip-thigh', subregion: 'hip', layer: 'superficial-muscle', width: 2097, height: 900 },
  { structureId: 'gluteus-medius', region: 'hip-thigh', subregion: 'hip', layer: 'deep-muscle', width: 2060, height: 900 },
  { structureId: 'gluteus-minimus', region: 'hip-thigh', subregion: 'hip', layer: 'deep-muscle', width: 2046, height: 900 },
  { structureId: 'infraspinatus', region: 'shoulder-arm', subregion: 'shoulder', layer: 'deep-muscle', width: 1425, height: 807 },
  { structureId: 'internal-oblique', region: 'back-core', subregion: 'torso', layer: 'deep-muscle', width: 1559, height: 900 },
  { structureId: 'interspinales', region: 'back-core', subregion: 'spine', layer: 'deep-muscle', width: 1548, height: 760 },
  { structureId: 'intertransversarii', region: 'back-core', subregion: 'spine', layer: 'deep-muscle', width: 2341, height: 900 },
  { structureId: 'latissimus-dorsi', region: 'shoulder-arm', subregion: 'shoulder', layer: 'superficial-muscle', width: 1542, height: 900 },
  { structureId: 'levator-scapulae', region: 'shoulder-arm', subregion: 'shoulder', layer: 'deep-muscle', width: 2313, height: 900 },
  { structureId: 'longus-capitis', region: 'back-core', subregion: 'spine', layer: 'deep-muscle', width: 2565, height: 900 },
  { structureId: 'longus-colli', region: 'back-core', subregion: 'spine', layer: 'deep-muscle', width: 2363, height: 900 },
  { structureId: 'lumbricals-foot', region: 'lower-leg-foot', subregion: 'ankle-foot', layer: 'deep-muscle', width: 1156, height: 472 },
  { structureId: 'lumbricals-hand', region: 'forearm-hand', subregion: 'wrist-hand', layer: 'deep-muscle', width: 1593, height: 900 },
  { structureId: 'multifidus', region: 'back-core', subregion: 'spine', layer: 'deep-muscle', width: 1553, height: 761 },
  { structureId: 'obturator-externus', region: 'hip-thigh', subregion: 'hip', layer: 'deep-muscle', width: 2109, height: 900 },
  { structureId: 'obturator-internus', region: 'hip-thigh', subregion: 'hip', layer: 'deep-muscle', width: 2122, height: 900 },
  { structureId: 'opponens-digiti-minimi-foot', region: 'lower-leg-foot', subregion: 'ankle-foot', layer: 'deep-muscle', width: 2330, height: 565 },
  { structureId: 'opponens-digiti-minimi-hand', region: 'forearm-hand', subregion: 'wrist-hand', layer: 'deep-muscle', width: 1906, height: 900 },
  { structureId: 'opponens-pollicis', region: 'forearm-hand', subregion: 'wrist-hand', layer: 'deep-muscle', width: 2390, height: 900 },
  { structureId: 'palmar-interossei', region: 'forearm-hand', subregion: 'wrist-hand', layer: 'deep-muscle', width: 2072, height: 900 },
  { structureId: 'pectoralis-minor', region: 'shoulder-arm', subregion: 'shoulder', layer: 'deep-muscle', width: 1811, height: 900 },
  { structureId: 'piriformis', region: 'hip-thigh', subregion: 'hip', layer: 'deep-muscle', width: 2107, height: 900 },
  { structureId: 'plantar-interossei', region: 'lower-leg-foot', subregion: 'ankle-foot', layer: 'deep-muscle', width: 1988, height: 561 },
  { structureId: 'popliteus', region: 'lower-leg-foot', subregion: 'knee', layer: 'deep-muscle', width: 985, height: 900 },
  { structureId: 'quadratus-femoris', region: 'hip-thigh', subregion: 'hip', layer: 'deep-muscle', width: 2112, height: 900 },
  { structureId: 'quadratus-lumborum', region: 'back-core', subregion: 'torso', layer: 'deep-muscle', width: 2228, height: 900 },
  { structureId: 'quadratus-plantae', region: 'lower-leg-foot', subregion: 'ankle-foot', layer: 'deep-muscle', width: 1556, height: 490 },
  { structureId: 'rhomboid-major', region: 'shoulder-arm', subregion: 'shoulder', layer: 'deep-muscle', width: 2291, height: 900 },
  { structureId: 'rhomboid-minor', region: 'shoulder-arm', subregion: 'shoulder', layer: 'deep-muscle', width: 2340, height: 900 },
  { structureId: 'rotatores', region: 'back-core', subregion: 'spine', layer: 'deep-muscle', width: 1467, height: 756 },
  { structureId: 'scalene-anterior', region: 'back-core', subregion: 'neck', layer: 'deep-muscle', width: 2585, height: 900 },
  { structureId: 'scalene-posterior', region: 'back-core', subregion: 'neck', layer: 'deep-muscle', width: 2432, height: 900 },
  { structureId: 'semitendinosus', region: 'hip-thigh', subregion: 'knee', layer: 'superficial-muscle', width: 1351, height: 900 },
  { structureId: 'soleus', region: 'lower-leg-foot', subregion: 'ankle-foot', layer: 'deep-muscle', width: 1210, height: 816 },
  { structureId: 'subscapularis', region: 'shoulder-arm', subregion: 'shoulder', layer: 'deep-muscle', width: 1554, height: 868 },
  { structureId: 'supinator', region: 'forearm-hand', subregion: 'wrist-hand', layer: 'deep-muscle', width: 1578, height: 900 },
  { structureId: 'supraspinatus', region: 'shoulder-arm', subregion: 'shoulder', layer: 'deep-muscle', width: 1370, height: 758 },
  { structureId: 'tensor-fasciae-latae', region: 'hip-thigh', subregion: 'hip', layer: 'superficial-muscle', width: 2017, height: 900 },
  { structureId: 'teres-minor', region: 'shoulder-arm', subregion: 'shoulder', layer: 'deep-muscle', width: 1416, height: 807 },
  { structureId: 'tibialis-anterior', region: 'lower-leg-foot', subregion: 'ankle-foot', layer: 'superficial-muscle', width: 931, height: 680 },
  { structureId: 'tibialis-posterior', region: 'lower-leg-foot', subregion: 'ankle-foot', layer: 'deep-muscle', width: 992, height: 679 },
  { structureId: 'transversus-abdominis', region: 'back-core', subregion: 'torso', layer: 'deep-muscle', width: 1450, height: 900 },
  { structureId: 'trapezius', region: 'shoulder-arm', subregion: 'shoulder', layer: 'superficial-muscle', width: 1377, height: 755 },
  { structureId: 'triceps-brachii', region: 'shoulder-arm', subregion: 'elbow', layer: 'superficial-muscle', width: 1348, height: 839 },
  { structureId: 'vastus-intermedius', region: 'hip-thigh', subregion: 'knee', layer: 'deep-muscle', width: 1458, height: 900 },
];
