import { primaryAreaOf } from '../../types/structure';
import type { AnatomyStructure } from '../../types/structure';
import type { AnatomyImageAsset } from '../../types/image';
import type { LocateQuestion } from '../../types/question';

export interface LocateGenOptions {
  toleranceMultiplier?: number;
}

/**
 * Builds locate-the-structure questions — one per (image, hotspot) pair.
 * Only images with populated `hotspots` produce questions; this generator
 * MUST degrade gracefully to an empty array rather than error when no
 * hotspot data exists yet (true for all seed images today — see
 * data/seed/images.seed.ts). Single-structure images need a hotspot too
 * (covering the whole/visible structure outline) since "click the
 * structure" requires knowing where within the image it actually is, not
 * just that the image depicts it.
 */
export function buildLocateQuestions(
  structures: AnatomyStructure[],
  images: AnatomyImageAsset[],
  options: LocateGenOptions = {},
): LocateQuestion[] {
  const structureById = new Map(structures.map((s) => [s.id, s]));
  const questions: LocateQuestion[] = [];

  // A ROTATION SET IS ONE PICTURE, NOT EIGHT. Images rendered every 45 degrees
  // share an id apart from an "-aNNN-" angle segment. One question per
  // (set, structure): the opening frame is the angle where the structure's
  // hotspot is largest, and every frame that carries a hotspot for it is a
  // frame the student may turn to. Without this a ligament visible from six
  // angles would be six questions, and the scheduler would drill it six times
  // over for one fact.
  const setKey = (id: string) => (/-a\d{3}-/.test(id) ? id.replace(/-a\d{3}-/, '-*-') : null);
  const sets = new Map<string, AnatomyImageAsset[]>();
  for (const image of images) {
    const key = setKey(image.id);
    if (key) sets.set(key, [...(sets.get(key) ?? []), image]);
  }
  const angleOf = (id: string) => Number(/-a(\d{3})-/.exec(id)?.[1] ?? 0);
  const emitted = new Set<string>();

  for (const image of images) {
    if (!image.hotspots?.length) continue;
    const key = setKey(image.id);
    const frames = key ? [...sets.get(key)!].sort((a, b) => angleOf(a.id) - angleOf(b.id)) : null;

    for (const hotspot of image.hotspots) {
      const structure = structureById.get(hotspot.structureId);
      if (!structure || !structure.eligibility.locate) continue;

      let opening = image;
      let frameIds: string[] | undefined;
      if (frames) {
        const withTarget = frames.filter((f) => f.hotspots?.some((h) => h.structureId === structure.id));
        const questionKey = `${key}|${structure.id}`;
        if (emitted.has(questionKey)) continue;
        emitted.add(questionKey);
        opening = withTarget.reduce((best, f) => {
          const area = (f.hotspots ?? []).find((h) => h.structureId === structure.id)?.area ?? 0;
          const bestArea = (best.hotspots ?? []).find((h) => h.structureId === structure.id)?.area ?? 0;
          return area > bestArea ? f : best;
        }, withTarget[0]);
        frameIds = withTarget.map((f) => f.id);
      }

      questions.push({
        id: `locate-${frames ? key! : image.id}-${structure.id}`,
        type: 'locate',
        structureId: structure.id,
        region: structure.region,
        subregion: structure.subregion,
        area: primaryAreaOf(structure),
        category: structure.category,
        difficulty: structure.difficulty,
        promptKind: 'identify',
        imageId: opening.id,
        imageMode: opening.mode,
        targetStructureId: structure.id,
        toleranceMultiplier: options.toleranceMultiplier,
        prompt:
          opening.mode === 'atlas-slide'
            ? `Tap ${structure.name} on the image.`
            : `Tap the ${structure.name}.`,
        ...(frameIds && frameIds.length > 1 ? { frameImageIds: frameIds } : {}),
      });
    }
  }

  return questions;
}
