import type { Area } from '../types/region';
import type { MCQQuestion } from '../types/question';
import { COHORT_DRAWN_VERSION, DIAGNOSTIC_VERSION, type DiagnosticResult } from './diagnostic';

/**
 * The diagnostic's fixed paper: fifteen finished questions that ship to
 * everyone (owner's decision, 6 Oct 2026 — docs/CONTENT-SERVER-STATUS.md,
 * decision 7).
 *
 * WHY A FIXED PAPER. The diagnostic is a whole-body baseline for a class, and
 * a class is measured on one paper or it is not measured. Once facts are
 * served per area to whoever has paid for them, a paper generated on the
 * device depends on what that device holds: a free student has one area's
 * facts and cannot be asked the nerve of a muscle in another. So the paper is
 * no longer generated on the device at all. It is written down once
 * (src/scripts/buildDiagnosticSample.ts) and every sitter — one area or nine,
 * bundled build or server build, baseline or follow-up — is handed the same
 * fifteen questions from the same file.
 *
 * THIS FILE IS DELIBERATELY PUBLIC, AND THIS IS ALL OF WHAT IT PUBLISHES.
 * data/diagnostic/fixedSample.v2.json is in every build, including one made
 * with VITE_CONTENT_SOURCE=server that otherwise carries no fact. It holds,
 * for each question, the prompt, the picture's id, four choices and which is
 * right. Names, areas and pictures were public already (the index). What is
 * NEW to the public is, per question:
 *
 *   action (3)     multifidus, popliteus, obturator-internus — the muscle's
 *                  action sentence (the same sentence as its `description`),
 *                  and three other muscles' action sentences beside each, not
 *                  attributed to their muscles
 *   origin (2)     flexor-digitorum-longus, longissimus — its `origin`, and
 *                  three other origins beside each, not attributed
 *   insertion (3)  levator-scapulae, brachioradialis,
 *                  flexor-digiti-minimi-brevis-foot — its `insertion`, and
 *                  three other insertions beside each, not attributed
 *   nerve (3)      opponens-digiti-minimi-hand, external-oblique,
 *                  vastus-intermedius — its `nerve`; the wrong answers are
 *                  nerve names, which the public vocabulary already holds
 *   functional (1) latissimus-dorsi — one sentence of its clinical layer
 *                  (functional relevance), and three other structures'
 *                  beside it, not attributed
 *   identify (3)   psoas-major, iliocostalis, flexor-digitorum-profundus —
 *                  nothing: a picture and four names
 *
 * Twelve facts attributed to twelve muscles, and the unattributed wrong
 * answers beside them. No explanation is stored (the generator's is the
 * structure's whole card), and no structure's other fields. The full list of
 * strings is in docs/CONTENT-SERVER-STATUS.md; diagnosticSample.test.ts holds
 * the file to this description, and the built-file check
 * (src/scripts/lib/bundleFacts.ts) allows these strings in the one built file
 * that carries the paper and nowhere else.
 *
 * The right answers are in the file too. That is no worse than before — a
 * bundled build carries every answer to everything — and the diagnostic is
 * not an exam: nothing rides on it for the student.
 *
 * VERSIONS. A paper is frozen under its version and never edited: a follow-up
 * replays the file its baseline was sat from. A new paper is a new version
 * and a new file, registered below, with the old one kept for as long as a
 * baseline sat from it may still be followed up.
 *
 * LOADED WHEN A SITTING STARTS, not with the app: the paper is a few
 * kilobytes that almost no page view needs, and the entry chunk is within a
 * few per cent of the size the offline precache allows.
 */

/** In the file, and so in whichever built file carries it: how the build check finds the paper. */
export const FIXED_SAMPLE_MARKER = 'locusmsk-diagnostic-fixed-sample-v';

export interface FixedSampleFile {
  /** FIXED_SAMPLE_MARKER + version. */
  sample: string;
  version: number;
  /** The name the paper was drawn under (buildDiagnosticSample.ts). A record, not an input. */
  drawnAs: string;
  questions: {
    /** The area this question was drawn to cover — a structure may sit in several. */
    coversArea: Area;
    question: MCQQuestion;
  }[];
}

const FILES: Record<number, () => Promise<FixedSampleFile>> = {
  2: () => import('../data/diagnostic/fixedSample.v2.json').then((m) => m.default as unknown as FixedSampleFile),
};

/** Whether papers of this version are a fixed file, rather than drawn per class from the facts (version 1). */
export function hasFixedSample(version: number): boolean {
  return version in FILES;
}

export async function loadFixedSampleFile(version: number): Promise<FixedSampleFile | null> {
  const load = FILES[version];
  return load ? load() : null;
}

/**
 * The paper a sitting is to ask.
 *
 *   fixed        the fifteen questions themselves. Needs nothing from the
 *                device: no facts, no entitlement.
 *   cohortDrawn  a version-1 paper, which was never written down: each class
 *                drew its own fifteen from the whole dataset. It can only be
 *                rebuilt where every area's facts are in hand
 *                (components/Diagnostic/DiagnosticScreen.tsx does that).
 */
export type DiagnosticPaper =
  | { kind: 'fixed'; version: number; questions: MCQQuestion[] }
  | { kind: 'cohortDrawn'; version: typeof COHORT_DRAWN_VERSION; replayIds?: string[] };

/**
 * Which paper a sitting gets.
 *
 * A BASELINE is always the current fixed paper.
 *
 * A FOLLOW-UP is the paper its baseline was: the baseline's version decides,
 * never today's. That is what keeps a class that was mid-diagnostic when the
 * fixed paper arrived whole — a student whose baseline was drawn for their
 * class under version 1 is asked those same questions again and their
 * follow-up is stamped version 1, so the two still pair. Handing them the new
 * paper instead would produce a follow-up that `pairDiagnostics` rightly
 * refuses, and fifteen answers nobody could use.
 */
export async function resolveDiagnosticPaper(
  phase: 'baseline' | 'followUp',
  baseline?: Pick<DiagnosticResult, 'version' | 'questionIds'>,
): Promise<DiagnosticPaper> {
  const version = phase === 'followUp' && baseline ? baseline.version : DIAGNOSTIC_VERSION;
  const file = await loadFixedSampleFile(version);
  if (!file) return { kind: 'cohortDrawn', version: COHORT_DRAWN_VERSION, replayIds: baseline?.questionIds };

  const all = file.questions.map((q) => q.question);
  const asked = phase === 'followUp' ? baseline?.questionIds : undefined;
  if (!asked || asked.length === 0) return { kind: 'fixed', version, questions: all };
  const wanted = new Set(asked);
  return { kind: 'fixed', version, questions: all.filter((q) => wanted.has(q.id)) };
}
