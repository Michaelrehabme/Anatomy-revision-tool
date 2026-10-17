import type { AnatomyStructure } from '../anatomy-revision/types/structure';
import type { AnatomyImageAsset } from '../anatomy-revision/types/image';
import type { QuestionType, RevisionQuestion } from '../anatomy-revision/types/question';
import { AREAS } from '../anatomy-revision/types/region';
import { generateRevisionSet } from '../anatomy-revision/lib/questionGenerators/generateSet';
import type { DistractorSources } from '../anatomy-revision/lib/questionGenerators/sources';

/**
 * The trial: ten questions a visitor can answer with no account.
 *
 * THE SAME TEN, EVERY TIME (owner's decision, 12 October 2026). Someone who
 * will not make an account gets a taste, not a revision tool: nothing is
 * scheduled, nothing is remembered, and coming back shows the same set. The
 * way to a second set is the free account.
 *
 * A FEW OF EACH FORMAT, ACROSS THE BODY. Every format the app has appears, in
 * the order a first-timer can follow: recognise, then find, then recall. Six
 * of the nine areas and a muscle, a bone and a ligament are in it, so the set
 * also shows that the app is more than muscles.
 *
 * WHAT IS LEFT OUT ON PURPOSE: blood supply (its ratings are the least
 * well-sourced content in the app), and the small ligament plates.
 *
 * Each entry names a question the ordinary generators already produce, by the
 * id they give it. A locate question's id carries the picture it opens on,
 * which is chosen at run time, so those are matched by structure alone.
 *
 * NEEDS THE FACTS IN HAND. In a bundled build they all are. A build that
 * serves facts per area to entitled accounts (data/content/contentSource.ts)
 * serves a guest none, and this returns fewer questions or none; before
 * production is switched to it, these ten need a fixture of their own.
 */
interface TrialSpec {
  type: QuestionType;
  structureId: string;
  /** The generator's id for the question. Omitted for locate, which has one question per structure. */
  id?: string;
}

export const TRIAL_SPECS: readonly TrialSpec[] = [
  { type: 'mcq', structureId: 'deltoid', id: 'mcq-deltoid-identify-image-muscle-deltoid-a270-highlight' },
  { type: 'locate', structureId: 'biceps-brachii' },
  { type: 'flashcard', structureId: 'gluteus-maximus', id: 'flashcard-gluteus-maximus-action' },
  { type: 'identify-typed', structureId: 'scaphoid', id: 'identify-typed-scaphoid-panel-scaphoid' },
  { type: 'multi-select', structureId: 'anterior-cruciate-ligament', id: 'multiselect-ligament-attachment-anterior-cruciate-ligament' },
  { type: 'oina', structureId: 'gastrocnemius', id: 'oina-gastrocnemius-insertion-select' },
  { type: 'mcq', structureId: 'biceps-brachii', id: 'mcq-biceps-brachii-nerve' },
  { type: 'locate', structureId: 'gastrocnemius' },
  {
    type: 'identify-typed',
    structureId: 'anterior-cruciate-ligament',
    // From its attachments since 17 Oct 2026: ligaments are not asked from a picture.
    id: 'identify-typed-anterior-cruciate-ligament-attachments',
  },
  { type: 'oina', structureId: 'deltoid', id: 'oina-deltoid-action-select' },
];

export const TRIAL_TYPES: QuestionType[] = [...new Set(TRIAL_SPECS.map((spec) => spec.type))];

/** Fixed, so the wrong answers offered and their order are the same on every visit too. */
const TRIAL_SEED = 20261012;

/**
 * The trial's questions, in order. One that cannot be built from what is
 * loaded is left out rather than replaced: a different question in its place
 * would not be the same ten.
 */
export function buildTrialSet(
  structures: AnatomyStructure[],
  images: AnatomyImageAsset[],
  sources?: DistractorSources,
): RevisionQuestion[] {
  const byType = new Map<QuestionType, RevisionQuestion[]>();
  for (const type of TRIAL_TYPES) {
    const structureIds = TRIAL_SPECS.filter((spec) => spec.type === type).map((spec) => spec.structureId);
    byType.set(
      type,
      generateRevisionSet(
        structures,
        images,
        { types: [type], structureIds, entitledAreas: AREAS, mode: 'practice', seed: TRIAL_SEED },
        sources,
      ),
    );
  }

  const out: RevisionQuestion[] = [];
  for (const spec of TRIAL_SPECS) {
    const candidates = (byType.get(spec.type) ?? []).filter(
      (q) => q.type === spec.type && q.structureId === spec.structureId,
    );
    const question = spec.id
      ? candidates.find((q) => q.id === spec.id)
      : // Sorted, so which of several is taken does not depend on the shuffle.
        [...candidates].sort((a, b) => a.id.localeCompare(b.id))[0];
    if (question) out.push(question);
  }
  return out;
}
