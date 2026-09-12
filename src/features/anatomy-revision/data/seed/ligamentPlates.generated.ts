import type { ViewType } from '../../types/image';
import type { Region, SubRegion } from '../../types/region';

/**
 * GENERATED — do not edit by hand.
 * Regenerate with: npx tsx src/scripts/publishLigamentPlates.ts
 *
 * One row per file in public/anatomy/ligaments/. A ligament has up to eight
 * angles and each angle two kinds: 'context' (every ligament at rest; the
 * locate picture, with hotspots) and 'highlight' (the target in cyan; the
 * identify picture, no hotspots). Only angles where the target traced are
 * here. Dimensions are measured from the files, because they become the
 * aspect ratio of the box the student clicks in.
 */
export interface LigamentPlate {
  structureId: string;
  name: string;
  region: Region;
  subregion: SubRegion;
  view: ViewType;
  /** Camera angle around the vertical axis, degrees; 0 is anterior. */
  angle: number;
  kind: 'context' | 'highlight';
  width: number;
  height: number;
  /** Every seeded ligament visible in the picture, the target first. */
  panelStructureNames: string[];
}

export const LIGAMENT_PLATES: LigamentPlate[] = [
  { structureId: 'anterior-tibiofibular-ligament', name: "Anterior tibiofibular ligament", region: 'lower-leg-foot', subregion: 'ankle-foot', view: 'anterior', angle: 0, kind: 'context', width: 1200, height: 1200, panelStructureNames: ["Anterior tibiofibular ligament","Interosseous membrane of leg"] },
  { structureId: 'anterior-tibiofibular-ligament', name: "Anterior tibiofibular ligament", region: 'lower-leg-foot', subregion: 'ankle-foot', view: 'anterior', angle: 0, kind: 'highlight', width: 1200, height: 1200, panelStructureNames: ["Anterior tibiofibular ligament"] },
  { structureId: 'anterior-tibiofibular-ligament', name: "Anterior tibiofibular ligament", region: 'lower-leg-foot', subregion: 'ankle-foot', view: 'anteromedial', angle: 45, kind: 'context', width: 1200, height: 1200, panelStructureNames: ["Anterior tibiofibular ligament"] },
  { structureId: 'anterior-tibiofibular-ligament', name: "Anterior tibiofibular ligament", region: 'lower-leg-foot', subregion: 'ankle-foot', view: 'anteromedial', angle: 45, kind: 'highlight', width: 1200, height: 1200, panelStructureNames: ["Anterior tibiofibular ligament"] },
  { structureId: 'interosseous-membrane-of-leg', name: "Interosseous membrane of leg", region: 'hip-thigh', subregion: 'knee', view: 'anterior', angle: 0, kind: 'context', width: 1200, height: 1200, panelStructureNames: ["Interosseous membrane of leg","Interosseous membrane of leg"] },
  { structureId: 'interosseous-membrane-of-leg', name: "Interosseous membrane of leg", region: 'hip-thigh', subregion: 'knee', view: 'anterior', angle: 0, kind: 'highlight', width: 1200, height: 1200, panelStructureNames: ["Interosseous membrane of leg"] },
];
