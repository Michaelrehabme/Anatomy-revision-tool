import type { AnatomyStructure, Category } from '../types/structure';
import type { Area } from '../types/region';
import { areasOf } from '../types/structure';
import { createRng, shuffle } from './rng';

/**
 * The baseline diagnostic — the "before" half of the sentence a pilot is run to
 * earn (CR-033 item 14).
 *
 * WHY IT EXISTS AT ALL. The February claim was originally going to lean on
 * anonymised module marks. It cannot: a university disclosing per-student
 * results to a supplier is disclosing personal data, marks move with resits and
 * moderation, and the request would likely need ethics approval. What a supplier
 * CAN measure is a student's own performance on a fixed assessment, taken inside
 * the app under the consent already given.
 *
 * WHY IT MUST EXIST BEFORE THE COHORT STARTS. Everything else in this product is
 * derivable after the fact, because every answer is recorded with a timestamp. A
 * baseline is not. Once a student has been revising for a month, the person they
 * were in week one is gone and no query brings them back. This is the one
 * measurement that expires.
 *
 * THREE RULES, AND THEY ARE WHY THIS IS NOT A REVISION SESSION.
 *
 * 1. It never touches mastery, the review scheduler, or the cohort counters.
 *    Not by a flag on the attempt that someone later forgets to check — by
 *    construction: nothing here calls `recordAttempt` or `upsertMastery`, so a
 *    diagnostic answer cannot reach the educator's weakness table, a student's
 *    due queue, or any accuracy figure in the product.
 *
 * 2. It gives no feedback. Not per question, not at the end, not "here is what
 *    you got wrong". A pre-test that tells you the answers IS revision — the
 *    testing effect is well enough established that a scored, corrected pre-test
 *    reliably improves the post-test on its own — and the improvement it
 *    manufactures would be indistinguishable from the improvement the app is
 *    trying to demonstrate. Only the total is shown.
 *
 * 3. Every student in a cohort gets the SAME items, and the same ones again at
 *    the end. Two different samples of fifteen questions produce two scores that
 *    cannot be subtracted from one another.
 *
 *    The ORDER is not part of that promise and is deliberately shuffled per
 *    sitting, by whoever presents it. Fixing the items is what makes the two
 *    scores comparable; fixing the order would only help a student remember
 *    that the third question was peroneus longus.
 */

/**
 * Items in one sitting.
 *
 * Fifteen rather than twenty: free navigation and a review step make a sitting
 * feel longer than its question count, and a baseline is only worth having if
 * students actually finish it in the week they join. The score is a proportion,
 * so a shorter paper costs precision, not comparability.
 */
export const DIAGNOSTIC_SIZE = 15;

/**
 * The version of the item-selection rules. It is stamped on every result, and
 * a follow-up is only comparable with a baseline that carries the same value:
 * change how items are chosen and every open baseline stops being a baseline.
 */
export const DIAGNOSTIC_VERSION = 1;

/** One item: a structure to be named, and which cohort-fixed slot it fills. */
export interface DiagnosticItem {
  structureId: string;
  /** The area it was drawn from, so coverage can be shown and checked. */
  area: Area;
  category: Category;
}

export interface DiagnosticSpec {
  /** The cohort this set belongs to; the seed that fixes it. */
  cohortId: string;
  version: number;
  items: DiagnosticItem[];
}

/** What a completed sitting stores. No per-item answers: see rule 2. */
export interface DiagnosticResult {
  userId: string;
  cohortId: string;
  version: number;
  /** 'baseline' is the sitting on joining; 'followUp' the one at the end of term. */
  phase: 'baseline' | 'followUp';
  correct: number;
  total: number;
  /** ISO. A baseline taken weeks into term is worth less, and this is how anyone can tell. */
  takenAt: string;
  /** Wall-clock for the sitting, for sanity-checking a suspiciously fast one. */
  durationMs?: number;
}

/**
 * A stable numeric seed from the cohort id, so the same class always draws the
 * same items without anything being stored. Two cohorts get different sets,
 * which limits how far an answer key can travel between year groups.
 */
function seedFrom(cohortId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < cohortId.length; i += 1) {
    hash ^= cohortId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * How many of an area's most-taught structures are eligible to be drawn.
 *
 * WHY THERE IS A POOL AT ALL. The first version drew evenly from every muscle
 * and bone, and produced a paper asking about interspinales, longus colli and
 * the distal phalanges of the foot. A week-one student scores near zero on that
 * — and a floor is the worst place to start a before-and-after measurement,
 * because everyone begins at the bottom and any movement at all looks dramatic.
 * A diagnostic should measure the core of the module, where students actually
 * have somewhere to move from.
 *
 * The proxy for "core" is how many images the project holds of a structure.
 * It is not arbitrary: images are where the curriculum's attention went, and
 * the correlation is stark — deltoid and gluteus maximus carry three or four,
 * interspinales and opponens digiti minimi carry one. It has the further merit
 * of being a fact in the dataset rather than a judgement typed into a list that
 * would drift the moment content changed.
 */
const CORE_POOL_PER_AREA = 6;

/**
 * The cohort's fixed item set.
 *
 * Spread across areas on purpose: a diagnostic drawn at random from the whole
 * dataset would, at 20 items, quite often miss a region entirely, and a student
 * who happens to be shown four shoulders and no spine has been measured on
 * something narrower than the module.
 *
 * Deterministic given (cohortId, version, structures) — no date, no Math.random.
 * A follow-up months later rebuilds exactly the same twenty.
 */
export function buildDiagnostic(
  structures: AnatomyStructure[],
  cohortId: string,
  size: number = DIAGNOSTIC_SIZE,
): DiagnosticSpec {
  const eligible = structures.filter((s) => s.category === 'muscle' || s.category === 'bone');

  const byArea = new Map<Area, AnatomyStructure[]>();
  for (const structure of eligible) {
    for (const area of areasOf(structure)) {
      const list = byArea.get(area);
      if (list) list.push(structure);
      else byArea.set(area, [structure]);
    }
  }

  // Narrow each area to the structures the curriculum spends most time on,
  // ranked by image count, before anything is drawn. Ties break on id so the
  // ranking cannot depend on the order the dataset happens to be in.
  for (const [area, list] of byArea) {
    const ranked = [...list].sort(
      (a, b) => (b.imageIds?.length ?? 0) - (a.imageIds?.length ?? 0) || a.id.localeCompare(b.id),
    );
    byArea.set(area, ranked.slice(0, CORE_POOL_PER_AREA));
  }

  const rng = createRng(seedFrom(cohortId) + DIAGNOSTIC_VERSION);
  // Areas in a fixed order, then shuffled by the cohort's own seed: the order
  // must not depend on Map insertion, which depends on dataset ordering.
  const areas = shuffle([...byArea.keys()].sort(), rng);

  const picked: DiagnosticItem[] = [];
  const used = new Set<string>();

  // Round-robin across areas until full, so coverage is even rather than lucky.
  for (let round = 0; picked.length < size && round < size; round += 1) {
    for (const area of areas) {
      if (picked.length >= size) break;
      const pool = shuffle(
        (byArea.get(area) ?? []).filter((s) => !used.has(s.id)),
        createRng(seedFrom(cohortId + area) + round),
      );
      const next = pool[0];
      if (!next) continue;
      used.add(next.id);
      picked.push({ structureId: next.id, area, category: next.category });
    }
  }

  return { cohortId, version: DIAGNOSTIC_VERSION, items: picked };
}

export function scoreDiagnostic(answers: boolean[]): { correct: number; total: number } {
  return { correct: answers.filter(Boolean).length, total: answers.length };
}

export function percent(result: { correct: number; total: number }): number | null {
  return result.total > 0 ? (result.correct / result.total) * 100 : null;
}

/** One student's before and after, and the movement between them. */
export interface DiagnosticGain {
  userId: string;
  baselinePct: number;
  followUpPct: number;
  /** Percentage POINTS. 40% to 60% is 20, not 50. */
  gainPoints: number;
  daysBetween: number;
}

/**
 * Pairs each student's baseline with their follow-up.
 *
 * Unpaired sittings are dropped rather than counted: a student with only a
 * follow-up looks like a high scorer and a student with only a baseline looks
 * like a low one, and including either would bias the mean in a direction that
 * depends on who dropped out. Mismatched versions are dropped for the same
 * reason — the two scores are not measurements of the same thing.
 */
export function pairDiagnostics(results: DiagnosticResult[]): DiagnosticGain[] {
  const byUser = new Map<string, DiagnosticResult[]>();
  for (const r of results) {
    const list = byUser.get(r.userId);
    if (list) list.push(r);
    else byUser.set(r.userId, [r]);
  }

  const gains: DiagnosticGain[] = [];
  for (const [userId, rows] of byUser) {
    // Earliest baseline against latest follow-up: a student who retook the
    // baseline is measured from the first time they saw it.
    const baselines = rows
      .filter((r) => r.phase === 'baseline')
      .sort((a, b) => a.takenAt.localeCompare(b.takenAt));
    const followUps = rows
      .filter((r) => r.phase === 'followUp')
      .sort((a, b) => b.takenAt.localeCompare(a.takenAt));

    const before = baselines[0];
    const after = followUps[0];
    if (!before || !after) continue;
    if (before.version !== after.version) continue;

    const beforePct = percent(before);
    const afterPct = percent(after);
    if (beforePct === null || afterPct === null) continue;

    gains.push({
      userId,
      baselinePct: beforePct,
      followUpPct: afterPct,
      gainPoints: afterPct - beforePct,
      daysBetween: Math.round(
        (Date.parse(after.takenAt) - Date.parse(before.takenAt)) / 86400000,
      ),
    });
  }

  return gains.sort((a, b) => b.gainPoints - a.gainPoints);
}

/** Below this many paired students, a mean gain is not worth quoting. */
export const MIN_PAIRED = 8;

export interface DiagnosticSummary {
  paired: number;
  meanBaselinePct: number | null;
  meanFollowUpPct: number | null;
  meanGainPoints: number | null;
  /** Students who improved at all, as a share of those paired. */
  improvedPct: number | null;
  reportable: boolean;
}

export function summariseDiagnostics(results: DiagnosticResult[]): DiagnosticSummary {
  const gains = pairDiagnostics(results);
  const mean = (values: number[]) =>
    values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;

  return {
    paired: gains.length,
    meanBaselinePct: mean(gains.map((g) => g.baselinePct)),
    meanFollowUpPct: mean(gains.map((g) => g.followUpPct)),
    meanGainPoints: mean(gains.map((g) => g.gainPoints)),
    improvedPct:
      gains.length > 0 ? (gains.filter((g) => g.gainPoints > 0).length / gains.length) * 100 : null,
    reportable: gains.length >= MIN_PAIRED,
  };
}
