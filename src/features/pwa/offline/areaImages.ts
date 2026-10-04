import { AREAS, AREAS_BY_SUBREGION, REGION_SUBREGIONS, type Area } from '../../anatomy-revision/types/region';
import { areasOf } from '../../anatomy-revision/types/structure';
import type { StructureIndexEntry } from '../../anatomy-revision/types/structureIndex';
import type { AnatomyImageAsset } from '../../anatomy-revision/types/image';
import { rotationSetKey } from '../../anatomy-revision/lib/rotationFrames';
import { promptImagesFor } from '../../anatomy-revision/lib/questionGenerators/promptImages';
import { buildLocateQuestions } from '../../anatomy-revision/lib/questionGenerators/locate';

/**
 * WHICH PICTURES AN AREA NEEDS, worked out from the seed rather than from the
 * folders the files happen to sit in.
 *
 * The folders are by family (muscles, ligaments, joints…), not by area, and a
 * download that globbed them would either take the whole atlas or miss what a
 * session actually shows. The question an offline download has to answer is
 * narrower: "if a student starts a session in the knee with no network, which
 * files can the app ask for?" — and the app only ever shows a picture FOR A
 * STRUCTURE, so the answer is the pictures of every structure in the area.
 *
 * WHICH pictures of a structure is not guessed at here. It is asked of the
 * same functions the session uses, so the download cannot drift from what the
 * app shows when somebody changes how a picture is chosen:
 *
 *  1. Its own pictures — every single-structure image that names it. The
 *     structure's card opens on one of these and the flashcards use them.
 *  2. What identify and multiple choice open on: promptImagesFor.
 *  3. What locate opens on and may be turned to: buildLocateQuestions.
 *  4. Every other frame of those turntables. A student can turn any picture
 *     through every angle of its set (rotationFramesFor), and a set with holes
 *     in it offline is a picture that breaks halfway round.
 *  5. A picture NOTHING above claimed — a plate no question opens on today —
 *     goes where its own subregion says it lives, and failing that its region.
 *     No picture is left out of every download: a file that belongs nowhere is
 *     a file that is quietly never available offline.
 *
 * WHAT THIS DELIBERATELY IS NOT: "every picture that traces a structure of the
 * area". A ligament plate traces every strap and muscle in frame, so by that
 * rule the elbow came to 84 MB and the lumbar spine to 172 MB, most of it
 * plates framed on something else that no elbow question ever opens. Rules 2
 * and 3 already pick the one plate a structure is asked on.
 *
 * Areas still overlap where the anatomy does — a pedicle belongs to all three
 * spine areas, and so do its pictures.
 */

/** Rule 5: where a picture lives when no structure claims it. */
function areasFromPlacement(image: AnatomyImageAsset): Area[] {
  if (image.subregion) return AREAS_BY_SUBREGION[image.subregion];
  return [...new Set(REGION_SUBREGIONS[image.region].flatMap((sub) => AREAS_BY_SUBREGION[sub]))];
}

/**
 * Every image's areas, keyed by image id, each list in canonical AREAS order.
 *
 * `images` must already carry their hotspots — anything reading ALL_IMAGES
 * without a repository has to `await attachHotspots()` first, or rules 2 and 3
 * find no picture to open on and the areas come out too small with no error.
 */
export function areasByImage(
  structures: readonly StructureIndexEntry[],
  images: readonly AnatomyImageAsset[],
): Map<string, Area[]> {
  const all = [...structures];
  const pictures = [...images];
  const structureAreas = new Map(all.map((s) => [s.id, areasOf(s)]));
  const claimed = new Map<string, Set<Area>>(pictures.map((image) => [image.id, new Set<Area>()]));
  const claim = (imageId: string | undefined, structureId: string | undefined) => {
    const set = imageId ? claimed.get(imageId) : undefined;
    if (set) for (const area of (structureId && structureAreas.get(structureId)) || []) set.add(area);
  };

  // Rule 1.
  for (const image of pictures) {
    if (image.mode === 'single-structure') claim(image.id, image.structureId);
  }

  // Rule 2.
  for (const structure of all) {
    for (const image of promptImagesFor(structure, pictures)) claim(image.id, structure.id);
  }

  // Rule 3. Built over everything at once: which picture a structure is asked
  // on does not depend on what else is in the session.
  for (const question of buildLocateQuestions(all, pictures)) {
    for (const imageId of [question.imageId, ...(question.frameImageIds ?? [])]) claim(imageId, question.structureId);
  }

  // Rule 4. The set is rotationSetKey's and nothing wider: the '-context' and
  // '-highlight' renders of one plate are two turntables, and each is claimed
  // on its own by the question type that opens on it.
  const bySet = new Map<string, Set<Area>>();
  const setKeyOf = (image: AnatomyImageAsset) => rotationSetKey(image.id) ?? image.id;
  for (const image of pictures) {
    const merged = bySet.get(setKeyOf(image)) ?? new Set<Area>();
    for (const area of claimed.get(image.id)!) merged.add(area);
    bySet.set(setKeyOf(image), merged);
  }

  return new Map(
    pictures.map((image) => {
      const merged = bySet.get(setKeyOf(image))!;
      // Rule 5, per picture and after the sets are merged, so a frame that no
      // question opens on still travels with the rest of its turntable.
      const areas = merged.size > 0 ? merged : new Set(areasFromPlacement(image));
      return [image.id, AREAS.filter((area) => areas.has(area))];
    }),
  );
}

/**
 * The file paths each area downloads, sorted and without duplicates — two
 * images can share a file, and the order must not depend on seed order or
 * the manifest's hash would change when nothing on disk had.
 */
export function filePathsByArea(
  structures: readonly StructureIndexEntry[],
  images: readonly AnatomyImageAsset[],
): Record<Area, string[]> {
  const areas = areasByImage(structures, images);
  const paths = Object.fromEntries(AREAS.map((area) => [area, new Set<string>()])) as Record<Area, Set<string>>;
  for (const image of images) {
    for (const area of areas.get(image.id) ?? []) {
      paths[area].add(image.filePath);
      // A FRAME'S SECOND RENDER GOES WHEREVER THE FRAME GOES. The viewer's
      // switch swaps the file under the same frame (types/image.ts,
      // ImageVariant), so an area that holds one without the other has a
      // switch that shows a broken picture offline. Taken from the same image
      // in the same loop, there is no way to list a frame and miss its variant.
      if (image.variant) paths[area].add(image.variant.filePath);
    }
  }
  return Object.fromEntries(AREAS.map((area) => [area, [...paths[area]].sort()])) as Record<Area, string[]>;
}
