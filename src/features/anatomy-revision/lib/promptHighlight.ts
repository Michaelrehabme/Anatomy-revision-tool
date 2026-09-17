import type { AnatomyImageAsset, HotspotPolygon } from '../types/image';

/**
 * Which hotspots an identify question should draw over its picture.
 *
 * "Which structure is shown?" only works if the picture says which one. Two
 * ways of doing that coexist: an atlas slide names its structures with
 * hotspots and the app draws the highlight, while a muscle panel or a ligament
 * highlight plate is rendered with the target already picked out in colour and
 * carries no hotspots at all.
 *
 * THE TEST USED TO BE THE MODE, AND THE MODE IS THE WRONG QUESTION. Landmark
 * and joint panels are `single-structure` — one picture, one structure — but
 * they are NOT pre-highlighted: a landmark is not separable geometry, so its
 * panel is a plain skeleton with a target circle stored beside it. Keying off
 * the mode skipped that circle, and "which structure is shown?" over an
 * unmarked wrist with four carpals to choose from is a coin toss. Asking
 * whether the picture actually carries a hotspot for the answer covers both
 * conventions: pre-highlighted images have none, so they are untouched.
 */
export function promptHighlightHotspots(
  image: AnatomyImageAsset | undefined,
  structureId: string,
): HotspotPolygon[] {
  const hotspots = image?.hotspots ?? [];
  return hotspots.some((h) => h.structureId === structureId) ? hotspots : [];
}
