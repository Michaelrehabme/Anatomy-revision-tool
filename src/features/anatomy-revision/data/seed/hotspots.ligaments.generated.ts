/**
 * GENERATED FILE — do not edit by hand.
 *
 * Regenerate with:
 *   blender atlas/Z-Anatomy/Startup.blend --background \
 *     --python src/scripts/blender/renderLigamentPlates.py -- \
 *     --spec ligament-tranche1.spec.json --out renders/ligaments-tranche1
 *   npx tsx src/scripts/publishLigamentPlates.ts --renders renders/ligaments-tranche1
 *
 * One entry per published context image. The first hotspot is the target
 * ligament, traced from its own mask with the bones and every other strap
 * held out; the rest are the other seeded ligaments in view, traced from the
 * ID pass, so a click on the wrong ligament can be named. Straps that are
 * not seeded ligaments are drawn but carry no hotspot.
 */
import type { HotspotPolygon } from '../../types/image';

export const LIGAMENT_HOTSPOTS: Record<string, HotspotPolygon[]> = {
  'ligament-anterior-tibiofibular-ligament-a000-context': [
    { structureId: 'anterior-tibiofibular-ligament', polygons: [[[0.44583,0.51333],[0.46083,0.48],[0.47583,0.42833],[0.45833,0.3675],[0.48417,0.37167],[0.535,0.38833],[0.54083,0.45167],[0.55417,0.54667],[0.52917,0.615],[0.48667,0.5725],[0.44583,0.5175]]], area: 0.0167411083, centroid: [0.5045668156925829,0.4873192527793198] },
    { structureId: 'interosseous-membrane-of-leg', polygons: [[[0.40917,0.1275],[0.415,0.11917],[0.42667,0.0925],[0.43083,0.07417],[0.4325,0.02583],[0.43,0],[0.47083,0],[0.47083,0.01667],[0.4675,0.04333],[0.46917,0.17083],[0.46583,0.22083],[0.465,0.32],[0.4625,0.32833],[0.45583,0.32917],[0.4525,0.33583],[0.45,0.33583],[0.44333,0.325],[0.43333,0.2875],[0.43,0.28333],[0.42917,0.265],[0.42,0.22083],[0.41667,0.18833],[0.4125,0.17083],[0.41333,0.16083]]], area: 0.01396161944999999, centroid: [0.44534772136427714,0.1588079131212937] },
  ],
  'ligament-anterior-tibiofibular-ligament-a045-context': [
    { structureId: 'anterior-tibiofibular-ligament', polygons: [[[0.49417,0.52],[0.5025,0.51333],[0.51667,0.47167],[0.51667,0.41917],[0.50417,0.39167],[0.50417,0.3875],[0.51,0.38667],[0.49583,0.36917],[0.4975,0.3675],[0.515,0.37167],[0.54917,0.41167],[0.54917,0.415],[0.5375,0.48833],[0.5225,0.54167],[0.52167,0.59167],[0.5025,0.58917],[0.50333,0.54667]]], area: 0.005615998600000047, centroid: [0.5214745121793347,0.47500446161898957] },
  ],
  'ligament-interosseous-membrane-of-leg-a000-context': [
    { structureId: 'interosseous-membrane-of-leg', polygons: [[[0.4875,0.54583],[0.49417,0.36],[0.49917,0.32167],[0.50417,0.31083],[0.50667,0.31],[0.51,0.32917],[0.50333,0.3375],[0.5025,0.34667],[0.505,0.35],[0.50833,0.34833],[0.50917,0.35333],[0.50917,0.395],[0.51333,0.4325],[0.51417,0.47167],[0.51167,0.48333],[0.5125,0.50167],[0.50917,0.51583],[0.50917,0.53083],[0.49917,0.60083],[0.49833,0.69],[0.49583,0.68917],[0.49417,0.68417],[0.49167,0.66583],[0.495,0.6575],[0.495,0.64833],[0.49,0.63583],[0.48917,0.62583]]], area: 0.005671322200000065, centroid: [0.49965984194931734,0.4845774487155721] },
    { structureId: 'interosseous-membrane-of-leg', polygons: [[[0.22417,0.45583],[0.22917,0.395],[0.22917,0.35333],[0.23,0.34833],[0.23333,0.35],[0.23583,0.34667],[0.235,0.3375],[0.22833,0.32917],[0.23167,0.31],[0.23417,0.31083],[0.23917,0.32083],[0.245,0.37],[0.25083,0.59],[0.24833,0.635],[0.24333,0.64917],[0.24333,0.65667],[0.24667,0.66667],[0.24167,0.69],[0.24,0.69],[0.23917,0.6725],[0.23917,0.60083],[0.22917,0.53083],[0.22917,0.51583],[0.22583,0.50167],[0.22667,0.48333],[0.22417,0.47167]]], area: 0.005599368000000021, centroid: [0.23860562598534893,0.4849809790992182] },
  ],
};
