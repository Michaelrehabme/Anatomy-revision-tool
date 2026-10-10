import { isLigament, reviewedAttachmentIds } from '../../types/structure';
import { structureNameVariants } from '../nameVariants';
import type { AnatomyStructure } from '../../types/structure';
import type { StructureIndexEntry } from '../../types/structureIndex';
import type { AnatomyImageAsset } from '../../types/image';
import type { TypedIdentifyQuestion } from '../../types/question';
import { summarizeStructure } from '../facts';
import { promptImagesFor } from './promptImages';
import { siteLabel } from '../attachmentSites';
import { questionBase } from './questionBase';

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
  /**
   * The whole dataset, for naming a ligament's attachments. It must not be the
   * filtered pool: a student who narrows a session to ligaments has a pool with
   * no bones in it, so looking an attachment up there finds nothing and the
   * boxes silently vanish — exactly the session where they matter most.
   * Defaults to `structures` for callers that pass the full set anyway.
   *
   * Index entries, because only a name and its aliases are read: the bone a
   * ligament attaches to can sit in an area whose facts are not loaded, and
   * its name is in the index regardless (sources.ts).
   */
  allStructures: readonly StructureIndexEntry[] = structures,
): TypedIdentifyQuestion[] {
  const questions: TypedIdentifyQuestion[] = [];
  const byId = new Map(allStructures.map((s) => [s.id, s]));

  for (const structure of structures) {
    if (!structure.eligibility.mcq) continue;

    // A ligament is asked for its name AND its attachments, one box each —
    // the bones are named through the seed so "talus" and "tarsals" are
    // graded by the same variants the rest of the app accepts.
    const attachmentSlots = isLigament(structure)
      ? reviewedAttachmentIds(structure).flatMap((id) => {
          const bone = byId.get(id);
          if (!bone) return [];
          // Shown as "landmark of bone"; the landmark alone is still right,
          // and so is anything its name already accepted.
          const variants = structureNameVariants(bone.name, bone.aliases);
          const label = siteLabel(bone, byId);
          return [{ label: 'Attaches to', accepted: variants.includes(label) ? variants : [label, ...variants] }];
        })
      : [];

    // One per turntable, on the plate framed for this structure (promptImages.ts).
    for (const image of promptImagesFor(structure, images)) {
      questions.push({
        ...questionBase(structure, 'identify'),
        type: 'identify-typed',
        id: `identify-typed-${structure.id}-${image.id}`,
        prompt: image.mode === 'atlas-slide' ? 'Which structure is highlighted?' : 'Which structure is shown?',
        promptImageId: image.id,
        acceptedAnswers: structureNameVariants(structure.name, structure.aliases),
        ...(attachmentSlots.length ? { attachmentSlots } : {}),
        explanation: summarizeStructure(structure, byId),
      });
    }
  }

  return questions;
}
