import type { Category } from '../types/structure';
import type { StructureIndexEntry } from '../types/structureIndex';
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
 * The version of the paper. It is stamped on every result, and a follow-up is
 * only comparable with a baseline that carries the same value: change what is
 * asked and every open baseline stops being a baseline.
 *
 *   1  each class drew its own fifteen from the whole dataset, on the device
 *      (`buildDiagnostic` below). Live until October 2026.
 *   2  one public paper of fifteen finished questions. Built on a branch,
 *      never shipped: no real sitting carries it. The number is skipped so
 *      nothing sat under it can ever be read as one of the papers below.
 *   3  ten written papers — the whole body, and one for each area
 *      (lib/diagnosticPapers.ts). Owner's decision, 6 Oct 2026: a student
 *      with every area sits the whole-body paper, a student on a free
 *      account sits the paper for their free area. A sitting records WHICH
 *      paper beside the version (`paperId`).
 *
 * This is the version a NEW BASELINE is stamped with. A follow-up carries its
 * baseline's version and paper, not this one — see `resolveDiagnosticPaper`.
 */
export const DIAGNOSTIC_VERSION = 3;

/**
 * The version whose papers were drawn per class. Baselines sat under it are
 * still open on the live site, so the rule that drew them is kept, exactly,
 * for their follow-ups — and for nothing else.
 */
export const COHORT_DRAWN_VERSION = 1;

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
  /**
   * Which of a version's papers was sat: 'whole-body', or an area. Absent on
   * version 1, where a class had one paper and it was the class's own.
   * Two sittings pair only on the same paper (`pairDiagnostics`).
   */
  paperId?: string;
  /** 'baseline' is the sitting on joining; 'followUp' the one at the end of term. */
  phase: 'baseline' | 'followUp';
  correct: number;
  total: number;
  /** ISO. A baseline taken weeks into term is worth less, and this is how anyone can tell. */
  takenAt: string;
  /** Wall-clock for the sitting, for sanity-checking a suspiciously fast one. */
  durationMs?: number;
  /**
   * The exact questions asked, in the order the generator produced them (NOT the
   * order they were shown — that is shuffled per sitting and carries no meaning).
   *
   * WHY THIS IS STORED RATHER THAN RE-DERIVED. Pinning the structures is not
   * enough: "which nerve innervates peroneus longus" and "which structure is
   * highlighted" are different questions about the same muscle, and a follow-up
   * that asked the other one would be measuring something else. Re-deriving the
   * question from the structure would work only while the dataset stands still,
   * and this dataset does not — images, prompt kinds and phrasing all changed
   * during the week this was written.
   *
   * So the baseline records what it actually asked, and the follow-up replays
   * exactly that. A term's comparison then survives any amount of content work
   * in between, which is the only version of this that is safe to promise a
   * university.
   *
   * Absent on sittings recorded before this was tracked; `sameQuestions` treats
   * that as unknown rather than as a mismatch.
   */
  questionIds?: string[];
}

/**
 * Whether a follow-up asked what its baseline asked.
 *
 * Order is ignored on purpose — the sitting shuffles it — so this compares the
 * sets. Unknown (either side missing the record) is not a mismatch: it is an
 * older sitting, and refusing to pair it would silently discard real data.
 */
export function sameQuestions(before: DiagnosticResult, after: DiagnosticResult): boolean {
  if (!before.questionIds || !after.questionIds) return true;
  if (before.questionIds.length !== after.questionIds.length) return false;
  const seen = new Set(before.questionIds);
  return after.questionIds.every((id) => seen.has(id));
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
 * The cohort's fixed item set, AS VERSION 1 DREW IT.
 *
 * No new baseline is built from this: a baseline is now one of the written
 * papers (lib/diagnosticPapers.ts). It stays for one caller: a follow-up to a
 * version-1 baseline, sat on the live site before October 2026, is rebuilt
 * from it. It must go on returning exactly what it returned while version 1
 * was live, which is why its seed is tied to COHORT_DRAWN_VERSION and not to
 * the current version.
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
  structures: readonly StructureIndexEntry[],
  cohortId: string,
  size: number = DIAGNOSTIC_SIZE,
): DiagnosticSpec {
  const eligible = structures.filter((s) => s.category === 'muscle' || s.category === 'bone');

  const byArea = new Map<Area, StructureIndexEntry[]>();
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

  const rng = createRng(seedFrom(cohortId) + COHORT_DRAWN_VERSION);
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

  return { cohortId, version: COHORT_DRAWN_VERSION, items: picked };
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
 * depends on who dropped out. Mismatched versions, and follow-ups that asked
 * different questions, are dropped for the same reason — the two scores are not
 * measurements of the same thing.
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
    // Nor is the knee paper a follow-up to the whole-body one.
    if (paperKey(before) !== paperKey(after)) continue;
    // A follow-up that asked different questions is not a follow-up.
    if (!sameQuestions(before, after)) continue;

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

/**
 * Which paper a sitting was on, as one comparable value: the version and the
 * paper within it. Version-1 sittings carry no paper id — a class had one
 * paper — so they all share a key within their class.
 */
export function paperKey(result: Pick<DiagnosticResult, 'version' | 'paperId'>): string {
  return `${result.version}:${result.paperId ?? ''}`;
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

/**
 * A class's figures on ONE paper.
 *
 * WHY THERE IS NO FIGURE FOR A WHOLE CLASS ANY MORE. A class can sit more
 * than one paper: three members with every area sit the whole-body paper
 * while two on free accounts sit the knee's. A score out of fifteen on one
 * and a score out of fifteen on the other are scores on two tests, and a
 * mean over both is a number about nothing. So every figure — who sat a
 * baseline, the mean, the pairs, whether it may be quoted — is worked out per
 * paper, and MIN_PAIRED is asked of each paper on its own.
 */
export interface PaperFigures {
  /** `paperKey` of the sittings counted here. */
  key: string;
  version: number;
  /** Absent for version 1 (the class's own drawn paper). */
  paperId?: string;
  /** Students whose first baseline was on this paper. */
  baselines: number;
  meanBaselinePct: number | null;
  /** Of those, the students with a follow-up on the same paper and questions. */
  paired: number;
  meanPairedBaselinePct: number | null;
  meanFollowUpPct: number | null;
  meanGainPoints: number | null;
  improved: number;
  /**
   * Students with a baseline here and a follow-up that could not be paired
   * with it (another paper, another version, other questions).
   */
  unpairable: number;
  reportable: boolean;
}

/**
 * The class's sittings, one row per paper, the most-sat paper first.
 *
 * A student belongs to the paper of their FIRST baseline: that is the sitting
 * `pairDiagnostics` measures from.
 */
export function summariseDiagnosticsByPaper(results: DiagnosticResult[]): PaperFigures[] {
  const mean = (values: number[]) =>
    values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;

  const firstBaseline = new Map<string, DiagnosticResult>();
  for (const r of results) {
    if (r.phase !== 'baseline' || !(r.total > 0)) continue;
    const held = firstBaseline.get(r.userId);
    if (!held || r.takenAt < held.takenAt) firstBaseline.set(r.userId, r);
  }
  const followedUp = new Set(results.filter((r) => r.phase === 'followUp').map((r) => r.userId));
  const gains = new Map(pairDiagnostics(results).map((g) => [g.userId, g]));

  const byPaper = new Map<string, DiagnosticResult[]>();
  for (const baseline of firstBaseline.values()) {
    const key = paperKey(baseline);
    byPaper.set(key, [...(byPaper.get(key) ?? []), baseline]);
  }

  return [...byPaper.entries()]
    .map(([key, baselines]) => {
      const paired = baselines.map((b) => gains.get(b.userId)).filter((g): g is DiagnosticGain => !!g);
      return {
        key,
        version: baselines[0].version,
        ...(baselines[0].paperId ? { paperId: baselines[0].paperId } : {}),
        baselines: baselines.length,
        meanBaselinePct: mean(baselines.map((b) => (b.correct / b.total) * 100)),
        paired: paired.length,
        meanPairedBaselinePct: mean(paired.map((g) => g.baselinePct)),
        meanFollowUpPct: mean(paired.map((g) => g.followUpPct)),
        meanGainPoints: mean(paired.map((g) => g.gainPoints)),
        improved: paired.filter((g) => g.gainPoints > 0).length,
        unpairable: baselines.filter((b) => followedUp.has(b.userId) && !gains.has(b.userId)).length,
        reportable: paired.length >= MIN_PAIRED,
      };
    })
    .sort((a, b) => b.baselines - a.baselines || a.key.localeCompare(b.key));
}

/**
 * Every pair in one figure. Only meaningful when the sittings handed in are
 * all on ONE paper — a caller holding a whole class's sittings must use
 * `summariseDiagnosticsByPaper` instead.
 */
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

/**
 * Turns a spec into the actual questions, deterministically.
 *
 * Generated over the WHOLE dataset and then filtered, never over the fifteen
 * structures alone: multiple-choice distractors are drawn from the pool the
 * generator is given, and a pool of fifteen produces questions with one
 * plausible answer and three absurd ones. That was not hypothetical — the
 * first export of this for the preview produced a question with a single
 * choice.
 *
 * Prompt kinds are spread rather than taken first-come, because the generator
 * offers them in a stable order and the result was otherwise "what nerve
 * innervates X" fifteen times.
 *
 * `replayIds` re-asks exactly what a baseline asked. Passing it makes the
 * function a lookup rather than a selection, which is what a follow-up needs.
 */
export function buildDiagnosticQuestions<
  Q extends { id: string; structureId: string; promptKind: string; choices?: string[] },
>(
  spec: DiagnosticSpec,
  allQuestions: Q[],
  replayIds?: string[],
): Q[] {
  if (replayIds && replayIds.length > 0) {
    const byId = new Map(allQuestions.map((q) => [q.id, q]));
    return replayIds.map((id) => byId.get(id)).filter((q): q is Q => !!q);
  }

  const wanted = new Set(spec.items.map((i) => i.structureId));
  const byStructure = new Map<string, Q[]>();
  for (const q of allQuestions) {
    if (!wanted.has(q.structureId)) continue;
    // Four choices or it is not a fair multiple-choice question.
    if ((q.choices?.length ?? 0) < 4) continue;
    const list = byStructure.get(q.structureId);
    if (list) list.push(q);
    else byStructure.set(q.structureId, [q]);
  }

  const usedKind = new Map<string, number>();
  const picked: Q[] = [];
  for (const item of spec.items) {
    const options = byStructure.get(item.structureId);
    if (!options || options.length === 0) continue;
    // Least-used prompt kind first; ties break on id so this cannot depend on
    // the order the generator happened to emit.
    const best = [...options].sort(
      (a, b) =>
        (usedKind.get(a.promptKind) ?? 0) - (usedKind.get(b.promptKind) ?? 0) ||
        a.id.localeCompare(b.id),
    )[0];
    usedKind.set(best.promptKind, (usedKind.get(best.promptKind) ?? 0) + 1);
    picked.push(best);
  }
  return picked;
}

/**
 * The display order for one sitting: shuffled, and deliberately NOT derived
 * from the cohort. See rule 3 — fixing the items is what makes two scores
 * comparable, while a fixed order would only help a student remember where a
 * question was.
 */
export function shuffleForSitting<T>(items: T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
