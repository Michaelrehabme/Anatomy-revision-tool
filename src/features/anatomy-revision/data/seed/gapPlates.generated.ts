import type { ViewType } from '../../types/image';
import type { Region, SubRegion } from '../../types/region';

/**
 * GENERATED — do not edit by hand.
 * Regenerate with: npx tsx src/scripts/publishGapPlates.ts --masks <renders>
 *
 * One row per file in public/anatomy/gaps/: a bones-only turntable on which
 * several structures are each located by the gap between two bones. See
 * publishGapPlates.ts and carpal-gaps.spec.json.
 */
export interface GapPlate {
  plateId: string;
  name: string;
  region: Region;
  subregion: SubRegion;
  view: ViewType;
  /** Camera angle around the vertical axis, degrees; 0 is anterior. */
  angle: number;
  width: number;
  height: number;
}

export const GAP_PLATES: GapPlate[] = [
  { plateId: 'carpal-gaps', name: 'Carpal bones', region: 'forearm-hand', subregion: 'wrist-hand', view: 'anterior', angle: 0, width: 900, height: 900 },
  { plateId: 'carpal-gaps', name: 'Carpal bones', region: 'forearm-hand', subregion: 'wrist-hand', view: 'anteromedial', angle: 30, width: 900, height: 900 },
  { plateId: 'carpal-gaps', name: 'Carpal bones', region: 'forearm-hand', subregion: 'wrist-hand', view: 'posteromedial', angle: 150, width: 900, height: 900 },
  { plateId: 'carpal-gaps', name: 'Carpal bones', region: 'forearm-hand', subregion: 'wrist-hand', view: 'posterior', angle: 180, width: 900, height: 900 },
  { plateId: 'carpal-gaps', name: 'Carpal bones', region: 'forearm-hand', subregion: 'wrist-hand', view: 'posterolateral', angle: 210, width: 900, height: 900 },
  { plateId: 'carpal-gaps', name: 'Carpal bones', region: 'forearm-hand', subregion: 'wrist-hand', view: 'anterolateral', angle: 330, width: 900, height: 900 },
];
