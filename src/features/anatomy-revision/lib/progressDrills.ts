import type { AnatomyRepository } from '../data/repository';
import type { AnatomyContent } from '../hooks/useAnatomyContent';
import type { RevisionSetupParams } from '../hooks/useRevisionSession';
import type { QuestionType, RevisionQuestion } from '../types/question';
import type { Area } from '../types/region';
import { generateRevisionSet } from './questionGenerators/generateSet';
import { getLearnCardAttempts } from './preferences';

/**
 * Progress's two drills, "the untouched" and "the leeches", shared by the
 * desktop and mobile screens so a phone starts the same session a laptop does.
 *
 * Untouched: no mastery is passed on purpose. Every structure in the list is
 * by definition unattempted, so they all carry UNSEEN_WEIGHT and the ordering
 * stays uniform. None of them has fact mastery either, so every OINA question
 * arrives preceded by its learn card — which is what "start these" should mean.
 *
 * Leeches: the muscles a student keeps losing, which is exactly what per-fact
 * drilling is for — OINA leads.
 */
export type ProgressDrill = 'untouched' | 'leeches';

const DRILL_TYPES: Record<ProgressDrill, QuestionType[]> = {
  untouched: ['oina', 'mcq'],
  leeches: ['oina', 'mcq', 'fill-blank', 'identify-typed'],
};

export async function buildProgressDrill(
  drill: ProgressDrill,
  {
    content,
    repository,
    userId,
    structureIds,
    entitledAreas,
  }: {
    content: AnatomyContent;
    repository: AnatomyRepository | null;
    userId: string | null;
    structureIds: string[];
    entitledAreas: Area[];
  },
): Promise<{ questions: RevisionQuestion[]; params: RevisionSetupParams }> {
  const types = DRILL_TYPES[drill];
  const factMastery = repository && userId ? await repository.listFactMastery(userId) : undefined;
  const learnCardAttempts = getLearnCardAttempts();
  const questions = generateRevisionSet(
    content.structures,
    content.images,
    { types, mode: 'practice', structureIds, entitledAreas, factMastery, learnCardAttempts },
    content.sources,
  );
  return { questions, params: { types, mode: 'practice', learnCardAttempts } };
}
