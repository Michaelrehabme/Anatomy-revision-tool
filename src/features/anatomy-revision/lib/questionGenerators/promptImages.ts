import type { AnatomyImageAsset } from '../../types/image';
import type { AnatomyStructure } from '../../types/structure';
import { rotationSetKey } from '../rotationFrames';
import { imageDepicts } from './mcq';

/**
 * ONE PICTURE PER TURNTABLE, AND THE STRUCTURE'S OWN TURNTABLE FIRST.
 *
 * A rotation set is eight renders of one scene, and the viewer already lets a
 * student turn through them (rotationFramesFor). Asking "which structure is
 * highlighted?" once per FRAME therefore asked the same question of the same
 * picture up to eight times over, and a session could serve the sacrotuberous
 * ligament four times from four angles. Locate solved this months ago
 * (locate.ts); identify and MCQ did not, because regrouping changes question
 * ids and the exposure history keyed to them.
 *
 * It also picks WHICH set. A ligament is drawn on its own plate, framed for
 * it, and on the wide sub-region plates of the area it lives in — where it is
 * a few pixels of a whole skeleton and the question is unanswerable. If a
 * structure has a plate of its own, that is the only one it is asked on.
 */

/** Framed for this structure: its plate, or a panel that names it as its subject. */
function isOwnPlate(image: AnatomyImageAsset, structure: AnatomyStructure): boolean {
  if (image.mode === 'single-structure') return image.structureId === structure.id;
  const subject = image.panelStructureNames?.[0]?.toLowerCase();
  if (subject === undefined) return false;
  return [structure.name, ...structure.aliases].some((n) => n.toLowerCase() === subject);
}

/** How much of the frame the structure covers, for choosing the opening angle. */
function areaIn(image: AnatomyImageAsset, structureId: string): number {
  return (image.hotspots ?? []).find((h) => h.structureId === structureId)?.area ?? 0;
}

/**
 * One image per rotation set that depicts the structure — the angle where it
 * shows largest, so the question opens on the clearest view and the student
 * turns from there. Single images (no `-aNNN-` in the id) are returned as they
 * are: they are their own set.
 */
export function promptImagesFor(
  structure: AnatomyStructure,
  images: readonly AnatomyImageAsset[],
): AnatomyImageAsset[] {
  const depicting = images.filter((img) => imageDepicts(img, structure.id));
  if (depicting.length === 0) return [];

  // A ligament plate is rendered twice from one scene: '-context', which draws
  // every strap at rest for a locate tap, and '-highlight', which shows the
  // target in cyan. They are one picture for this purpose, and identify wants
  // the one with the answer already highlighted.
  const bySet = new Map<string, AnatomyImageAsset[]>();
  for (const image of depicting) {
    const key = (rotationSetKey(image.id) ?? image.id).replace(/-(context|highlight)$/, '');
    bySet.set(key, [...(bySet.get(key) ?? []), image]);
  }

  const rank = (image: AnatomyImageAsset) =>
    (image.id.endsWith('-highlight') ? 1 : 0) * 1000 + areaIn(image, structure.id);
  const openers = [...bySet.values()].map((frames) =>
    frames.reduce((best, f) => (rank(f) > rank(best) ? f : best), frames[0]),
  );

  /**
   * A PLATE THAT IS NOT FRAMED FOR IT MUST AT LEAST SHOW IT.
   *
   * Every ligament of the hip is also drawn on the wide spine and torso
   * plates, where it is a speck at the bottom of a whole skeleton: "which
   * structure is highlighted?" over a picture where the highlight is four
   * pixels is not a question, it is a guess. A plate framed for the structure
   * is always kept; anything else has to give it this much of the frame.
   *
   * Not a blanket ban on wide plates: a bone or a landmark on its region's
   * turntable is perfectly legible there, and those are the pictures a student
   * can turn round, so they stay.
   */
  const MIN_LEGIBLE_AREA = 0.015;
  const own = openers.filter((img) => isOwnPlate(img, structure));
  if (own.length) return own;
  const legible = openers.filter((img) => areaIn(img, structure.id) >= MIN_LEGIBLE_AREA);
  // Nothing framed for it and nothing legible: keep the best picture there is
  // rather than dropping the structure out of identify altogether.
  return legible.length ? legible : [openers.reduce((best, f) => (rank(f) > rank(best) ? f : best), openers[0])];
}
