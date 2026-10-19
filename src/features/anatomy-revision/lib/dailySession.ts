import type { AnatomyContent } from '../hooks/useAnatomyContent';
import type { RevisionSetupParams } from '../hooks/useRevisionSession';
import type { FactMastery, StructureMastery } from '../types/attempt';
import type { QuestionType, RevisionQuestion } from '../types/question';
import type { Area } from '../types/region';
import type { AnatomyStructure } from '../types/structure';
import { generateRevisionSet } from './questionGenerators/generateSet';
import { buildStarterSet, STARTER_TYPES } from './questionGenerators/starterSet';
import { reviewItemsInArea, type ReviewItem } from './reviewQueue';
import {
  FOCUS_NEW_SHARE,
  hasAnswers,
  newShareFor,
  newStructureBias,
  sessionCountFor,
  skipsFlashcard,
  starterAreaOrder,
  starterCategories,
  typeWeightsFor,
  type StudyProfile,
  type WeeklyFocus,
} from './studyProfile';

// OINA is in the default mix because attachments are the thing students come back
// to relearn (CR-018); its own learn cards handle teaching, so 'flashcard' stays for
// the whole-muscle identify cards rather than as the teaching step.
export const DEFAULT_TYPES: QuestionType[] = ['flashcard', 'mcq', 'locate', 'identify-typed', 'oina'];

/**
 * Which of Today's buttons was pressed.
 *
 *   continue  works down the queue oldest first, up to two questions a
 *             structure, so a structure is finished before the review moves on.
 *   fresh     the same queue spread out: one question a structure, the ones
 *             answered longest ago first, and half the session new (owner,
 *             3 Oct 2026).
 *   focus     this week's focus (owner, 19 Oct 2026): what is due in the focus
 *             area, then more new material from it than the daily review
 *             takes. Nothing outside it — the daily review is still there for
 *             the rest of the body.
 */
export type DailyStyle = 'continue' | 'fresh' | 'focus';

export interface DailySessionInput {
  content: Pick<AnatomyContent, 'structures' | 'images' | 'sources' | 'structuresById'>;
  entitledAreas: readonly Area[];
  /** The areas new material comes from, already narrowed to what may be reached. Undefined = every entitled area. */
  areas: Area[] | undefined;
  /** Today's one-area review (ReviewAreaSelect), if one was picked. */
  only: Area | null;
  firstRun: boolean;
  reviewItems: readonly ReviewItem[];
  spreadItems: readonly ReviewItem[];
  mastery: StructureMastery[];
  facts: FactMastery[];
  learnCardAttempts: number;
  profile: StudyProfile | null;
  /** Required for 'focus'; ignored otherwise. */
  focus?: WeeklyFocus | null;
  style: DailyStyle;
  now?: Date;
  /** Fixed seed, for tests. */
  seed?: number;
}

export interface DailySession {
  questions: RevisionQuestion[];
  params: RevisionSetupParams;
}

/**
 * The session behind each of Today's buttons, the same on desktop and mobile.
 * The questionnaire's answers (lib/studyProfile.ts) lean it — which new
 * structures come first, how long it is, which formats it favours — and
 * change nothing for a student who skipped it.
 */
export function buildDailySession(input: DailySessionInput): DailySession {
  const { content, entitledAreas, profile, now = new Date() } = input;

  // Nothing attempted yet: the guided starter, from the area the student is
  // least sure of, in the kinds they have at least met.
  if (input.firstRun && input.style !== 'focus') {
    const starterAreas = starterAreaOrder(profile, input.areas ?? entitledAreas);
    const starter = buildStarterSet(
      content.structures,
      content.images,
      { areas: starterAreas, categories: starterCategories(profile) },
      content.sources,
    );
    // An area with no muscles falls through to an ordinary session.
    if (starter.length > 0) return { questions: starter, params: { types: STARTER_TYPES, mode: 'practice', areas: input.areas } };
  }

  const focus = input.style === 'focus' ? input.focus ?? null : null;
  const focusArea = focus?.area && entitledAreas.includes(focus.area) ? focus.area : null;
  const scopeArea = focus ? focusArea : input.only;
  const areas = focus ? (focusArea ? [focusArea] : input.areas) : input.areas;
  const category = focus?.category;

  const base = input.style === 'fresh' ? input.spreadItems : input.reviewItems;
  const inScope = base.filter((item) => {
    const structure = content.structuresById.get(item.structureId);
    return !!structure && (!category || structure.category === category);
  });
  const reviewItems = scopeArea ? reviewItemsInArea(inScope, scopeArea, content.structuresById) : inScope;

  const types = DEFAULT_TYPES;
  const questions = generateRevisionSet(content.structures, content.images, {
    types,
    mode: 'practice',
    areas,
    ...(category ? { category } : {}),
    entitledAreas,
    // Per question type (lib/reviewQueue.ts): what is due, then weak types
    // pulled forward, then new structures — never something well known and
    // not due. Fewer than asked for when there is not that much worth asking.
    reviewItems,
    ...(input.style === 'fresh' ? { maxPerStructure: 1 } : {}),
    newShare:
      input.style === 'focus'
        ? newShareFor(profile, now, FOCUS_NEW_SHARE)
        : newShareFor(profile, now, input.style === 'fresh' ? 0.5 : undefined),
    count: sessionCountFor(profile),
    // Without mastery the generator falls back to a uniform shuffle and the
    // scheduler's due/weakness weighting never runs on the daily review.
    mastery: input.mastery,
    now,
    factMastery: input.facts,
    learnCardAttempts: input.learnCardAttempts,
    // Only with answers to go on: passed at all, the bias turns the plain
    // shuffle into a weighted one, and a student who skipped the questions
    // should get exactly the review they always had.
    ...(hasAnswers(profile)
      ? {
          newStructureBias: (s: AnatomyStructure) => newStructureBias(profile, s),
          skipFlashcard: (s: AnatomyStructure) => skipsFlashcard(profile, s),
          typeWeights: typeWeightsFor(profile),
        }
      : {}),
    seed: input.seed,
  }, content.sources);
  return {
    questions,
    params: { types, mode: 'practice', areas, ...(category ? { category } : {}), learnCardAttempts: input.learnCardAttempts },
  };
}
