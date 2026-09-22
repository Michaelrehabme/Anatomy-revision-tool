import type { HotspotPolygon } from '../../types/image';
import { IMAGE_ASSETS } from './images.seed';

/**
 * The hotspot polygons, fetched separately from the images they belong to.
 *
 * WHY THEY ARE NOT IMPORTED WITH THE IMAGES. A hotspot is a list of traced
 * outlines, and by weight the app is mostly those numbers: 1.8 MB of the
 * seed, against about 100 kB for every panel's metadata put together. Imported
 * statically they landed in the entry chunk, which grew past 3 MB — over the
 * 2 MiB a service worker will precache, so the build failed outright at the
 * precache step and nothing could be deployed.
 *
 * Loaded through `import()` instead, each set becomes its own chunk. The app
 * shell and the whole of the setup screen paint without any of them; they
 * arrive with the content, which was always behind a loading state. Nothing is
 * lost offline — every chunk is still precached, just as its own file.
 *
 * THE REGION HOTSPOTS ARE THE EXCEPTION and stay with the images. Their module
 * also exports the region panels' structure names, which the image list is
 * built from, so importing it at all brings the whole module along. At 95 kB
 * it is not worth splitting the generator to separate them.
 *
 * Attaching mutates the image objects rather than copying them, because every
 * caller holds `AnatomyImageAsset` objects by reference — the repositories
 * hand out the same array, and re-creating them would leave a session grading
 * against a stale copy.
 */
const SETS: Record<string, () => Promise<Record<string, HotspotPolygon[]>>> = {
  joints: () => import('./hotspots.joints.generated').then((m) => m.JOINT_HOTSPOTS),
  bones: () => import('./hotspots.bones.generated').then((m) => m.BONE_HOTSPOTS),
  deep: () => import('./hotspots.deep.generated').then((m) => m.DEEP_HOTSPOTS),
  landmarks: () => import('./hotspots.landmarks.generated').then((m) => m.LANDMARK_HOTSPOTS),
  subregions: () => import('./hotspots.subregions.generated').then((m) => m.SUBREGION_HOTSPOTS),
  // Ligaments come in seven area files: together they are past the 2 MiB a
  // service worker will precache (see publishLigamentPlates.ts).
  ligamentsUpper: () => import('./hotspots.ligaments.upper.generated').then((m) => m.LIGAMENT_HOTSPOTS_PART),
  ligamentsHand: () => import('./hotspots.ligaments.hand.generated').then((m) => m.LIGAMENT_HOTSPOTS_PART),
  ligamentsHip: () => import('./hotspots.ligaments.hip.generated').then((m) => m.LIGAMENT_HOTSPOTS_PART),
  ligamentsKnee: () => import('./hotspots.ligaments.knee.generated').then((m) => m.LIGAMENT_HOTSPOTS_PART),
  ligamentsFoot: () => import('./hotspots.ligaments.foot.generated').then((m) => m.LIGAMENT_HOTSPOTS_PART),
  ligamentsFootTilt: () => import('./hotspots.ligaments.footTilt.generated').then((m) => m.LIGAMENT_HOTSPOTS_PART),
  ligamentsAxial: () => import('./hotspots.ligaments.axial.generated').then((m) => m.LIGAMENT_HOTSPOTS_PART),
};

let pending: Promise<void> | null = null;

/**
 * Loads every hotspot set and attaches it to the images, once per session.
 *
 * All of them together, not the one set a question needs: the setup screen
 * counts what it can ask before the student has chosen anything, and question
 * generation indexes the whole catalogue (see useAnatomyContent). Narrowing
 * this to the sets a region needs would mean a separate index of which
 * structures are tappable at all, which is a bigger change than the one this
 * fixes.
 *
 * A failed load is not swallowed: the repository's caller already shows the
 * "could not load anatomy content" path, and silently handing back images with
 * no hotspots would instead show a locate question that cannot be answered.
 */
export function attachHotspots(): Promise<void> {
  pending ??= Promise.all(Object.values(SETS).map((load) => load())).then((maps) => {
    const byImageId = new Map<string, HotspotPolygon[]>();
    for (const map of maps) {
      for (const [imageId, hotspots] of Object.entries(map)) byImageId.set(imageId, hotspots);
    }
    for (const image of IMAGE_ASSETS) {
      const hotspots = byImageId.get(image.id);
      if (hotspots) image.hotspots = hotspots;
    }
  });
  return pending;
}
