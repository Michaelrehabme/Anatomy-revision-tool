import type { ViewType } from '../../types/image';
import type { Region, SubRegion } from '../../types/region';

/**
 * GENERATED — do not edit by hand.
 * Regenerate with: npx tsx src/scripts/platesToHotspots.ts --family sub
 *
 * One row per file in public/anatomy/subregions/. Dimensions are measured from the
 * images, because they become the aspect-ratio of the box a student clicks in
 * and a box that does not match the image normalises every click wrongly.
 */
export interface SubRegionPlate {
  slug: string;
  region: Region;
  subregion: SubRegion;
  view: ViewType;
  title: string;
  width: number;
  height: number;
}

export const SUBREGION_PLATES: SubRegionPlate[] = [
  { slug: 'neck', region: 'back-core', subregion: 'neck', view: 'anterior', title: "Back and Core", width: 1400, height: 1400 },
  { slug: 'neck', region: 'back-core', subregion: 'neck', view: 'lateral', title: "Back and Core", width: 1400, height: 1400 },
  { slug: 'neck', region: 'back-core', subregion: 'neck', view: 'posterior', title: "Back and Core", width: 1400, height: 1400 },
  { slug: 'spine', region: 'back-core', subregion: 'spine', view: 'anterior', title: "Back and Core", width: 1400, height: 1400 },
  { slug: 'spine', region: 'back-core', subregion: 'spine', view: 'lateral', title: "Back and Core", width: 1400, height: 1400 },
  { slug: 'spine', region: 'back-core', subregion: 'spine', view: 'posterior', title: "Back and Core", width: 1400, height: 1400 },
  { slug: 'torso', region: 'back-core', subregion: 'torso', view: 'anterior', title: "Back and Core", width: 1400, height: 1400 },
  { slug: 'torso', region: 'back-core', subregion: 'torso', view: 'lateral', title: "Back and Core", width: 1400, height: 1400 },
  { slug: 'torso', region: 'back-core', subregion: 'torso', view: 'posterior', title: "Back and Core", width: 1400, height: 1400 },
  { slug: 'wrist-hand', region: 'forearm-hand', subregion: 'wrist-hand', view: 'anterior', title: "Forearm and Hand", width: 1400, height: 1400 },
  { slug: 'wrist-hand', region: 'forearm-hand', subregion: 'wrist-hand', view: 'lateral', title: "Forearm and Hand", width: 1400, height: 1400 },
  { slug: 'wrist-hand', region: 'forearm-hand', subregion: 'wrist-hand', view: 'posterior', title: "Forearm and Hand", width: 1400, height: 1400 },
  { slug: 'ankle-foot', region: 'lower-leg-foot', subregion: 'ankle-foot', view: 'anterior', title: "Lower Leg and Foot", width: 1400, height: 1400 },
  { slug: 'ankle-foot', region: 'lower-leg-foot', subregion: 'ankle-foot', view: 'lateral', title: "Lower Leg and Foot", width: 1400, height: 1400 },
  { slug: 'ankle-foot', region: 'lower-leg-foot', subregion: 'ankle-foot', view: 'posterior', title: "Lower Leg and Foot", width: 1400, height: 1400 },
  { slug: 'ankle-foot', region: 'lower-leg-foot', subregion: 'ankle-foot', view: 'plantar', title: "Lower Leg and Foot", width: 1400, height: 1400 },
];
