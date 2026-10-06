import { createHash } from 'node:crypto';
import type { MCQQuestion } from '../../features/anatomy-revision/types/question';
import type { AnatomyStructure } from '../../features/anatomy-revision/types/structure';
import { areasOf } from '../../features/anatomy-revision/types/structure';
import type { AnatomyImageAsset } from '../../features/anatomy-revision/types/image';
import {
  buildPaperQuestions,
  paperScope,
  paperShapeProblems,
  type BuiltPaper,
  type DiagnosticPaperSpec,
  type DiagnosticPapersFile,
} from '../../features/anatomy-revision/lib/diagnosticPapers';

/**
 * What a published diagnostic paper built to on the day it was published, and
 * whether it still builds to that (src/scripts/diagnosticPapers.ts and
 * lib/__tests__/diagnosticPapers.test.ts both read this).
 *
 * WHY A LOCK. A paper is a list of what to ask (lib/diagnosticPapers.ts); the
 * words are taken from the seed at the sitting. So an edit to the seed — a
 * corrected origin, a renamed ligament, a structure removed — silently
 * changes a question a student has already sat, and their follow-up would
 * ask something their baseline did not. The lock is a fingerprint of every
 * question as it was first asked. When one stops matching, the test says
 * which, and that the paper must be published again AS A NEW VERSION.
 *
 * A FINGERPRINT, NOT THE TEXT. The lock is committed beside the papers, and
 * the papers hold no facts; writing the built questions down here would put
 * them all back in one file. A hash says "changed" without saying what it was.
 * Nothing in the app imports it.
 */
export interface PaperLock {
  version: number;
  /** Question id -> fingerprint of the question as built. */
  questions: Record<string, string>;
}

/** The parts of a question a student sees, and nothing a build may vary. */
export function fingerprint(q: MCQQuestion): string {
  const seen = { prompt: q.prompt, picture: q.promptImageId ?? null, choices: q.choices, correct: q.correctIndex };
  return createHash('sha256').update(JSON.stringify(seen)).digest('hex').slice(0, 20);
}

/**
 * A paper built from ITS SCOPE ALONE: handed the structures of its own area
 * and no others, which is all a free student's device holds. The whole-body
 * paper is handed everything.
 */
export function buildFromScope(
  paper: DiagnosticPaperSpec,
  structures: readonly AnatomyStructure[],
  images: readonly AnatomyImageAsset[],
): BuiltPaper {
  const scope = paperScope(paper.id);
  const held = structures.filter((s) => areasOf(s).some((area) => scope.includes(area)));
  return buildPaperQuestions(paper, {
    structuresById: new Map(held.map((s) => [s.id, s])),
    // Names are public and every build has all of them (data/structureIndex.ts).
    indexById: new Map(structures.map((s) => [s.id, s])),
    imagesById: new Map(images.map((i) => [i.id, i])),
  });
}

export function lockFor(
  file: DiagnosticPapersFile,
  structures: readonly AnatomyStructure[],
  images: readonly AnatomyImageAsset[],
): { lock: PaperLock; problems: string[] } {
  const problems = paperShapeProblems(file);
  const questions: Record<string, string> = {};
  for (const paper of file.papers) {
    const built = buildFromScope(paper, structures, images);
    problems.push(...built.problems);
    for (const q of built.questions) questions[q.id] = fingerprint(q);
  }
  return { lock: { version: file.version, questions }, problems };
}

/** One line per question that no longer builds what was published. Empty when nothing has moved. */
export function lockDrift(published: PaperLock, now: PaperLock): string[] {
  const drift: string[] = [];
  if (published.version !== now.version) drift.push(`the lock is for version ${published.version}, the papers are version ${now.version}`);
  for (const [id, was] of Object.entries(published.questions)) {
    if (!(id in now.questions)) drift.push(`${id}: was published and is no longer on its paper, or can no longer be built`);
    else if (now.questions[id] !== was) drift.push(`${id}: now builds a different question from the one published`);
  }
  for (const id of Object.keys(now.questions)) {
    if (!(id in published.questions)) drift.push(`${id}: is on a paper but was never published`);
  }
  return drift;
}

/** What to say when the papers and the lock disagree. */
export const NEW_VERSION_NEEDED =
  'A published diagnostic paper is never edited: a follow-up must ask exactly what its baseline asked.\n' +
  'Either undo the change to the seed or to papers.v3.json, or cut a NEW VERSION:\n' +
  '  1. copy data/diagnostic/papers.v3.json to papers.v4.json and set "version": 4 (question ids follow the version);\n' +
  '  2. register it in lib/diagnosticPapers.ts (FILES) and raise PAPER_VERSION, keeping version 3 for open baselines;\n' +
  '  3. run `npm run papers:publish` to write its lock and docs/DIAGNOSTIC-PAPERS.md.\n' +
  'Only if NO student has sat the changed paper yet may the same version be published again:\n' +
  '  `npm run papers:publish -- --force`.';
