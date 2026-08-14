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

  for (const image of images) {
    if (!image.hotspots?.length) continue;

    for (const hotspot of image.hotspots) {
      const structure = structureById.get(hotspot.structureId);
      if (!structure || !structure.eligibility.locate) continue;

      questions.push({
        id: `locate-${image.id}-${structure.id}`,
        type: 'locate',
        structureId: structure.id,
        region: structure.region,
        subregion: structure.subregion,
        category: structure.category,
        difficulty: structure.difficulty,
        promptKind: 'identify',
        imageId: image.id,
        imageMode: image.mode,
        targetStructureId: structure.id,
        toleranceMultiplier: options.toleranceMultiplier,
        prompt:
          image.mode === 'atlas-slide'
            ? `Tap ${structure.name} on the image.`
            : `Tap the ${structure.name}.`,
      });
    }
  }

  return questions;
}
