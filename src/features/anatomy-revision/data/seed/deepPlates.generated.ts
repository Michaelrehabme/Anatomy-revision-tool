import type { ViewType } from '../../types/image';
import type { Region, SubRegion } from '../../types/region';

/**
 * GENERATED — do not edit by hand.
 * Regenerate with: npx tsx src/scripts/platesToHotspots.ts --family deep
 *
 * One row per file in public/anatomy/deep/. Dimensions are measured from the
 * images, because they become the aspect-ratio of the box a student clicks in
 * and a box that does not match the image normalises every click wrongly.
 */
export interface DeepPlate {
  slug: string;
  region: Region;
  subregion: SubRegion;
  view: ViewType;
  title: string;
  width: number;
  height: number;
}

export const DEEP_PLATES: DeepPlate[] = [
  { slug: 'back-core', region: 'back-core', subregion: 'spine', view: 'anterior', title: "Back and Core", width: 1400, height: 1400 },
  { slug: 'back-core', region: 'back-core', subregion: 'spine', view: 'lateral', title: "Back and Core", width: 1400, height: 1400 },
  { slug: 'back-core', region: 'back-core', subregion: 'spine', view: 'posterior', title: "Back and Core", width: 1400, height: 1400 },
  { slug: 'forearm-hand', region: 'forearm-hand', subregion: 'wrist-hand', view: 'anterior', title: "Forearm and Hand", width: 1400, height: 1400 },
  { slug: 'forearm-hand', region: 'forearm-hand', subregion: 'wrist-hand', view: 'lateral', title: "Forearm and Hand", width: 1400, height: 1400 },
  { slug: 'forearm-hand', region: 'forearm-hand', subregion: 'wrist-hand', view: 'posterior', title: "Forearm and Hand", width: 1400, height: 1400 },
  { slug: 'hip-thigh', region: 'hip-thigh', subregion: 'hip', view: 'anterior', title: "Hip and Thigh", width: 1400, height: 1400 },
  { slug: 'hip-thigh', region: 'hip-thigh', subregion: 'hip', view: 'lateral', title: "Hip and Thigh", width: 1400, height: 1400 },
  { slug: 'hip-thigh', region: 'hip-thigh', subregion: 'hip', view: 'posterior', title: "Hip and Thigh", width: 1400, height: 1400 },
  { slug: 'lower-leg-foot', region: 'lower-leg-foot', subregion: 'ankle-foot', view: 'anterior', title: "Lower Leg and Foot", width: 1400, height: 1400 },
  { slug: 'lower-leg-foot', region: 'lower-leg-foot', subregion: 'ankle-foot', view: 'lateral', title: "Lower Leg and Foot", width: 1400, height: 1400 },
  { slug: 'lower-leg-foot', region: 'lower-leg-foot', subregion: 'ankle-foot', view: 'posterior', title: "Lower Leg and Foot", width: 1400, height: 1400 },
  { slug: 'shoulder-arm', region: 'shoulder-arm', subregion: 'shoulder', view: 'anterior', title: "Shoulder and Arm", width: 1400, height: 1400 },
  { slug: 'shoulder-arm', region: 'shoulder-arm', subregion: 'shoulder', view: 'lateral', title: "Shoulder and Arm", width: 1400, height: 1400 },
  { slug: 'shoulder-arm', region: 'shoulder-arm', subregion: 'shoulder', view: 'posterior', title: "Shoulder and Arm", width: 1400, height: 1400 },
];
