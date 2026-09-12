import { primaryAreaOf, isLigament } from '../../types/structure';
import { structureNameVariants } from '../nameVariants';
import type { AnatomyStructure } from '../../types/structure';
import type { AnatomyImageAsset } from '../../types/image';
import type { TypedIdentifyQuestion } from '../../types/question';
import { summarizeStructure } from '../facts';
import { imageDepicts } from './mcq';

/**
 * Builds a typed-answer counterpart to MCQ's image-based "identify"
 * variant — same population (every mcq-eligible structure with a matching
 * image), but graded by fuzzy string match instead of picking a choice.
 * Atlas-slide images still need a populated hotspot for that structure to
 * match, same current gap as the MCQ/locate image variants.
 */
export function buildIdentifyTypedQuestions(
  structures: AnatomyStructure[],
  images: AnatomyImageAsset[],
): TypedIdentifyQuestion[] {
  const questions: TypedIdentifyQuestion[] = [];
  const byId = new Map(structures.map((s) => [s.id, s]));

  for (const structure of structures) {
    if (!structure.eligibility.mcq) continue;

    // A ligament is asked for its name AND its attachments, one box each —
    // the bones are named through the seed so "talus" and "tarsals" are
    // graded by the same variants the rest of the app accepts.
    const attachmentSlots = isLigament(structure)
      ? structure.attachmentStructureIds.flatMap((id) => {
          const bone = byId.get(id);
          return bone ? [{ label: 'Attaches to', accepted: structureNameVariants(bone.name, bone.aliases) }] : [];
        })
      : [];

    for (const image of images.filter((img) => imageDepicts(img, structure.id))) {
      questions.push({
        structureId: structure.id,
        region: structure.region,
        subregion: structure.subregion,
    area: primaryAreaOf(structure),
        category: structure.category,
        difficulty: structure.difficulty,
        promptKind: 'identify',
        type: 'identify-typed',
        id: `identify-typed-${structure.id}-${image.id}`,
        prompt: image.mode === 'atlas-slide' ? 'Which structure is highlighted?' : 'Which structure is shown?',
        promptImageId: image.id,
        acceptedAnswers: structureNameVariants(structure.name, structure.aliases),
        ...(attachmentSlots.length ? { attachmentSlots } : {}),
        explanation: summarizeStructure(structure),
      });
    }
  }

  return questions;
}
