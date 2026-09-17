import type { ViewType } from '../../types/image';
import type { Region, SubRegion } from '../../types/region';

/**
 * GENERATED — do not edit by hand.
 * Regenerate with: npx tsx src/scripts/platesToHotspots.ts --family bone
 *
 * One row per file in public/anatomy/bones/. Dimensions are measured from the
 * images, because they become the aspect-ratio of the box a student clicks in
 * and a box that does not match the image normalises every click wrongly.
 */
export interface BonePlate {
  slug: string;
  region: Region;
  subregion: SubRegion;
  view: ViewType;
  /**
   * Camera angle around the vertical axis, degrees, 0 anterior — present only on
   * a rotation set. Two angles share a view name, so this is what tells them
   * apart and what builds the image id the app groups frames by.
   */
  angle?: number;
  title: string;
  width: number;
  height: number;
}

export const BONE_PLATES: BonePlate[] = [
  { slug: 'back-core', region: 'back-core', subregion: 'spine', view: 'anterior', title: "Back and Core", width: 1600, height: 1600 },
  { slug: 'back-core', region: 'back-core', subregion: 'spine', view: 'lateral', title: "Back and Core", width: 1600, height: 1600 },
  { slug: 'back-core', region: 'back-core', subregion: 'spine', view: 'posterior', title: "Back and Core", width: 1600, height: 1600 },
  { slug: 'forearm-hand', region: 'forearm-hand', subregion: 'wrist-hand', view: 'anterior', title: "Forearm and Hand", width: 1600, height: 1600 },
  { slug: 'forearm-hand', region: 'forearm-hand', subregion: 'wrist-hand', view: 'lateral', title: "Forearm and Hand", width: 1600, height: 1600 },
  { slug: 'forearm-hand', region: 'forearm-hand', subregion: 'wrist-hand', view: 'posterior', title: "Forearm and Hand", width: 1600, height: 1600 },
  { slug: 'hip-thigh', region: 'hip-thigh', subregion: 'hip', view: 'anterior', title: "Hip and Thigh", width: 1600, height: 1600 },
  { slug: 'hip-thigh', region: 'hip-thigh', subregion: 'hip', view: 'lateral', title: "Hip and Thigh", width: 1600, height: 1600 },
  { slug: 'hip-thigh', region: 'hip-thigh', subregion: 'hip', view: 'posterior', title: "Hip and Thigh", width: 1600, height: 1600 },
  { slug: 'lower-leg-foot', region: 'lower-leg-foot', subregion: 'ankle-foot', view: 'anterior', title: "Lower Leg and Foot", width: 1600, height: 1600 },
  { slug: 'lower-leg-foot', region: 'lower-leg-foot', subregion: 'ankle-foot', view: 'lateral', title: "Lower Leg and Foot", width: 1600, height: 1600 },
  { slug: 'lower-leg-foot', region: 'lower-leg-foot', subregion: 'ankle-foot', view: 'posterior', title: "Lower Leg and Foot", width: 1600, height: 1600 },
  { slug: 'shoulder-arm', region: 'shoulder-arm', subregion: 'shoulder', view: 'anterior', title: "Shoulder and Arm", width: 1600, height: 1600 },
  { slug: 'shoulder-arm', region: 'shoulder-arm', subregion: 'shoulder', view: 'lateral', title: "Shoulder and Arm", width: 1600, height: 1600 },
  { slug: 'shoulder-arm', region: 'shoulder-arm', subregion: 'shoulder', view: 'posterior', title: "Shoulder and Arm", width: 1600, height: 1600 },
];
