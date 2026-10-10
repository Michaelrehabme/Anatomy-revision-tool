import type { AnatomyStructure } from '../types/structure';
import { areasOf, isMuscle } from '../types/structure';
import type { StructureIndexEntry } from '../types/structureIndex';
import type { AnatomyImageAsset } from '../types/image';
import type { MCQQuestion, PromptKind } from '../types/question';
import { AREAS, AREA_LABELS, type Area } from '../types/region';
import { COHORT_DRAWN_VERSION, type DiagnosticResult } from './diagnostic';
import { questionBase } from './questionGenerators/questionBase';
import { createRng, shuffle } from './rng';

/**
 * The diagnostic's papers (owner's decision, 6 Oct 2026: "choose your own,
 * based on region if on a free account").
 *
 * TEN PAPERS, AND WHICH ONE A STUDENT SITS IS DECIDED BY WHAT THEY HOLD.
 * Someone with every area — a subscriber, a member of a licensed class, a
 * complimentary account, a subscriber inside the days of grace — sits the
 * WHOLE-BODY paper. Someone on a free account sits the paper for THEIR FREE
 * AREA. Fifteen questions each.
 *
 * A PAPER IS A LIST OF WHAT TO ASK, NOT OF ANSWERS. Each entry in
 * data/diagnostic/papers.v3.json names a structure, the kind of question, the
 * picture if it is a picture question, and the structures whose own answers
 * to the same question are the three wrong choices. It holds no origin, no
 * insertion, no action, no sentence of any kind. The question — its wording,
 * the right answer, the wrong ones — is put together here, at the sitting,
 * from the facts the sitter's device already holds: their free area's, or all
 * nine. So nothing about the papers puts a fact in a build that otherwise
 * carries none, and the built-file check (src/scripts/checkBundleForFacts.ts)
 * allows no exception for them.
 *
 * (The one thing in the file that is not a structure's id is a nerve's NAME,
 * where an area has too few nerves of its own to offer four: the elbow has
 * two. Those names are in the public vocabulary every server build already
 * carries — data/content/vocabulary.ts — and say nothing of which muscle a
 * nerve supplies.)
 *
 * EVERYONE WHO SITS A PAPER GETS THE SAME QUESTIONS, in every kind of build.
 * Nothing here draws at random from what happens to be loaded: the wrong
 * answers are named in the file, and the order of the four choices comes from
 * the question's own id. Two students on the knee paper, one on a bundled
 * build and one on a build that fetches facts, see byte-identical questions
 * (diagnosticPapers.test.ts holds that).
 *
 * AN AREA PAPER USES THAT AREA AND NOTHING ELSE — the structure asked about
 * and every structure a wrong answer is taken from sit in the paper's area —
 * because a free student holds nothing else. `buildPaperQuestions` refuses a
 * paper that reaches outside its scope rather than building a shorter one.
 *
 * VERSIONS. These papers are version 3, and a sitting records the paper's id
 * beside it. Version 1 (each class drew its own fifteen, live until October
 * 2026) is still followed up by its own rule (DiagnosticScreen). Version 2
 * was one public paper of finished questions; it never shipped, no real
 * sitting carries it, and it is gone — the number is skipped so that nothing
 * ever sat under "2" can be mistaken for one of these.
 *
 * A PUBLISHED PAPER IS NEVER EDITED. A follow-up replays the paper its
 * baseline was sat from; change a question and every open baseline on that
 * paper stops being one. data/diagnostic/papers.v3.lock.json records what
 * each question built to on the day it was published, and
 * diagnosticPapers.test.ts fails — saying a new version must be cut — if a
 * structure is renamed or removed, or a fact a question prints is corrected.
 *
 * WHEN THE SEED CHANGES ONLY HOW SOMETHING IS SPELT, a paper may carry
 * `publishedWording`: for a named wrong answer of a named question, the few
 * characters as they read now and as they read when the paper was published.
 * On 9 Oct 2026 the seed dropped "of the" from every name, put ligament names
 * in sentence case and wrote one muscle's origin "of the pubis"; seven
 * version-3 questions each showed a wrong answer spelt the old way, and they
 * still do, so a follow-up reads exactly as its baseline did. It is spelling
 * and nothing else: a pair holds no fact (the test holds each to a short
 * fragment that names no structure), it is never applied to a right answer,
 * which must stay word for word what the Atlas shows, and a pair that no
 * longer finds its words is a fault, not a silent no-op. A new version starts
 * with none.
 */

/** The version a NEW baseline is sat under. */
export const PAPER_VERSION = 3;

export const WHOLE_BODY_PAPER = 'whole-body';
export type PaperId = typeof WHOLE_BODY_PAPER | Area;

/**
 * The kinds of question a paper may ask. All are kinds the diagnostic asked
 * before these papers (the version-1 draw took them from the ordinary
 * multiple-choice generators): name the picture, a muscle's origin,
 * insertion, nerve and action, and the two clinical kinds where the dataset
 * has that layer (the shoulder and the elbow).
 */
export type PaperQuestionKind = 'identify' | 'origin' | 'insertion' | 'nerve' | 'action' | 'functional' | 'injury';

/**
 * Where a wrong answer comes from: a structure in the paper's scope (its own
 * answer to the same question), or a nerve's name from the public vocabulary.
 */
export type PaperDistractor = string | { nerve: string };

export interface PaperQuestionSpec {
  /** Stored with the sitting. Stable for the life of the version. */
  id: string;
  structureId: string;
  kind: PaperQuestionKind;
  /** `identify` only: the picture shown. */
  imageId?: string;
  /** `injury` only: which of the structure's listed injuries the vignette is, by position. */
  injury?: number;
  distractors: PaperDistractor[];
}

/** `[as the seed spells it now, as the paper was published]` — a fragment of a wrong answer, never a whole one. */
export type PublishedWording = [now: string, published: string];

export interface DiagnosticPaperSpec {
  id: PaperId;
  questions: PaperQuestionSpec[];
  /**
   * Question id -> the structure a wrong answer is taken from -> how that
   * wrong answer's spelling is put back to what was published. See
   * "WHEN THE SEED CHANGES ONLY HOW SOMETHING IS SPELT" above.
   */
  publishedWording?: Record<string, Record<string, PublishedWording>>;
}

export interface DiagnosticPapersFile {
  version: number;
  papers: DiagnosticPaperSpec[];
}

/** Questions on a paper. */
export const PAPER_SIZE = 15;
/** Choices on a question, the right one included. */
export const PAPER_CHOICES = 4;

const FILES: Record<number, () => Promise<DiagnosticPapersFile>> = {
  3: () => import('../data/diagnostic/papers.v3.json').then((m) => m.default as unknown as DiagnosticPapersFile),
};

/**
 * Loaded when a sitting is offered or started, not with the app: a few
 * kilobytes almost no page view needs, kept out of an entry chunk that is
 * within a few per cent of the size the offline precache allows.
 */
export async function loadPapers(version: number): Promise<DiagnosticPapersFile | null> {
  const load = FILES[version];
  return load ? load() : null;
}

/** The areas whose facts a paper is built from. */
export function paperScope(id: PaperId): readonly Area[] {
  return id === WHOLE_BODY_PAPER ? AREAS : [id];
}

/** "the whole-body paper", "the knee paper" — for the report and the screen. */
export function paperLabel(id: PaperId): string {
  return id === WHOLE_BODY_PAPER ? 'the whole-body paper' : `the ${AREA_LABELS[id].toLowerCase()} paper`;
}

/**
 * The paper a new baseline is sat on, from the areas the sitter may reach:
 * every area, the whole-body paper; otherwise their free area's. Null when
 * they hold no area at all (a free account that has not chosen one yet).
 */
export function paperIdForSitter(areas: readonly Area[]): PaperId | null {
  if (AREAS.every((area) => areas.includes(area))) return WHOLE_BODY_PAPER;
  return AREAS.find((area) => areas.includes(area)) ?? null;
}

/**
 * The paper a sitting is to ask.
 *
 *   paper        one of the ten, to be built from the facts in hand.
 *   cohortDrawn  a version-1 paper, which was never written down: each class
 *                drew its own fifteen from the whole dataset. It can only be
 *                rebuilt where every area's facts are in hand
 *                (components/Diagnostic/DiagnosticScreen.tsx does that).
 *   unknown      a follow-up to a baseline whose paper this build does not
 *                have. Nothing is asked.
 */
export type DiagnosticPaper =
  | { kind: 'paper'; version: number; paper: DiagnosticPaperSpec; replayIds?: string[] }
  | { kind: 'cohortDrawn'; version: typeof COHORT_DRAWN_VERSION; replayIds?: string[] }
  | { kind: 'unknown'; version: number };

/**
 * Which paper a sitting gets.
 *
 * A BASELINE is the paper for what the sitter holds today.
 *
 * A FOLLOW-UP IS THE PAPER ITS BASELINE WAS — that version, that paper, those
 * questions — never today's. A free student who has since subscribed still
 * sits their area's paper; a subscriber who has since lapsed still owes the
 * whole-body one; a student whose baseline was drawn for their class under
 * version 1 is asked those questions again. Handing any of them a different
 * paper would produce a follow-up `pairDiagnostics` rightly refuses, and
 * fifteen answers nobody could use. Whether the paper CAN be built on this
 * device is a separate question (`areasPaperNeeds`).
 */
export async function resolveDiagnosticPaper(
  phase: 'baseline' | 'followUp',
  baseline: Pick<DiagnosticResult, 'version' | 'questionIds' | 'paperId'> | undefined,
  sitterAreas: readonly Area[],
): Promise<DiagnosticPaper> {
  if (phase === 'followUp' && baseline) {
    if (baseline.version === COHORT_DRAWN_VERSION) {
      return { kind: 'cohortDrawn', version: COHORT_DRAWN_VERSION, replayIds: baseline.questionIds };
    }
    const file = await loadPapers(baseline.version);
    const paper = file?.papers.find((p) => p.id === baseline.paperId);
    if (!paper) return { kind: 'unknown', version: baseline.version };
    return { kind: 'paper', version: baseline.version, paper, replayIds: baseline.questionIds };
  }

  const id = paperIdForSitter(sitterAreas);
  const file = await loadPapers(PAPER_VERSION);
  const paper = id ? file?.papers.find((p) => p.id === id) : undefined;
  return paper ? { kind: 'paper', version: PAPER_VERSION, paper } : { kind: 'unknown', version: PAPER_VERSION };
}

/**
 * The areas whose facts must be on the device for this paper to be asked.
 * Null when nothing can be asked whatever is in hand.
 */
export function areasPaperNeeds(paper: DiagnosticPaper): readonly Area[] | null {
  if (paper.kind === 'paper') return paperScope(paper.paper.id);
  if (paper.kind === 'cohortDrawn') return AREAS;
  return null;
}

/** What the builder reads. `structuresById` holds FACTS; `indexById` holds every name. */
export interface PaperContent {
  structuresById: ReadonlyMap<string, AnatomyStructure>;
  indexById: ReadonlyMap<string, StructureIndexEntry>;
  imagesById: ReadonlyMap<string, AnatomyImageAsset>;
}

const PROMPT_KIND: Record<PaperQuestionKind, PromptKind> = {
  identify: 'identify',
  origin: 'origin',
  insertion: 'insertion',
  nerve: 'nerve',
  action: 'action',
  functional: 'functional',
  injury: 'injury-mechanism',
};

/** A stable number from a question's id: the order of its four choices, the same for every sitter. */
function seedFrom(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * A structure's own answer to a kind of question, or null when it has none.
 * For the two kinds whose choices are NAMES (the picture and the vignette)
 * that is its name, which needs no facts.
 */
function answerOf(kind: PaperQuestionKind, entry: StructureIndexEntry, facts: AnatomyStructure | undefined): string | null {
  if (kind === 'identify' || kind === 'injury') return entry.name;
  if (!facts) return null;
  if (kind === 'functional') return facts.functionalContext || null;
  if (!isMuscle(facts)) return null;
  switch (kind) {
    case 'origin':
      return facts.origin.join('; ') || null;
    case 'insertion':
      return facts.insertion.join('; ') || null;
    case 'nerve':
      return facts.nerve.map((n) => n.name).join('; ') || null;
    case 'action':
      return facts.actionText || null;
    default:
      return null;
  }
}

/** The wording. The same sentences the ordinary multiple-choice questions use (questionGenerators/mcq.ts, clinical.ts). */
function promptOf(
  spec: PaperQuestionSpec,
  entry: StructureIndexEntry,
  facts: AnatomyStructure | undefined,
  image: AnatomyImageAsset | undefined,
): string | null {
  switch (spec.kind) {
    case 'identify':
      if (!image) return null;
      return image.mode === 'atlas-slide' ? 'Which structure is highlighted?' : 'Which structure is shown?';
    case 'origin':
    case 'insertion':
      return `What is the ${spec.kind} of ${entry.name}?`;
    case 'nerve':
      return `What nerve innervates ${entry.name}?`;
    case 'action':
      return `What is the action of ${entry.name}?`;
    case 'functional':
      return `${entry.name} is most responsible for which of these?`;
    case 'injury': {
      const injury = facts?.commonInjuries?.[spec.injury ?? 0];
      return injury ? `${injury.presentation} Which structure is most likely involved?` : null;
    }
    default:
      return null;
  }
}

function depicts(image: AnatomyImageAsset, structureId: string): boolean {
  if (image.mode === 'single-structure') return image.structureId === structureId;
  return (image.hotspots ?? []).some((h) => h.structureId === structureId);
}

export interface BuiltPaper {
  /** In the paper's own order. Empty unless EVERY question could be built. */
  questions: MCQQuestion[];
  /** Why not, one line per fault. Empty when the paper built. */
  problems: string[];
}

/**
 * The paper's fifteen questions, from the facts in hand.
 *
 * ALL OR NOTHING. A paper with a question missing is a different test from
 * the one its other sitters took, and its score could not be set beside
 * theirs; so one fault anywhere and nothing is asked. The caller says why.
 *
 * DETERMINISTIC. No clock, no Math.random, and nothing read from the content
 * beyond the structures the paper names — so what else happens to be loaded
 * (one area or nine) cannot change a word of it.
 *
 * `replayIds` keeps only the questions a baseline recorded, which for these
 * papers is all of them; it is honoured so that a follow-up asks exactly what
 * was stored even if that ever stops being true.
 */
export function buildPaperQuestions(
  paper: DiagnosticPaperSpec,
  content: PaperContent,
  replayIds?: readonly string[],
): BuiltPaper {
  const scope = paperScope(paper.id);
  const problems: string[] = [];
  const questions: MCQQuestion[] = [];
  const inScope = (entry: StructureIndexEntry) => areasOf(entry).some((area) => scope.includes(area));

  for (const spec of paper.questions) {
    const fault = (what: string) => problems.push(`${paper.id} ${spec.id}: ${what}`);
    const entry = content.indexById.get(spec.structureId);
    if (!entry) { fault(`no structure "${spec.structureId}"`); continue; }
    if (!inScope(entry)) { fault(`"${spec.structureId}" is outside the paper's area`); continue; }
    const facts = content.structuresById.get(spec.structureId);

    const image = spec.kind === 'identify' ? content.imagesById.get(spec.imageId ?? '') : undefined;
    if (spec.kind === 'identify' && (!image || !depicts(image, spec.structureId))) {
      fault(`picture "${spec.imageId}" is missing or does not show the structure`);
      continue;
    }

    const prompt = promptOf(spec, entry, facts, image);
    const correct = answerOf(spec.kind, entry, facts);
    if (!prompt || !correct) { fault(`"${spec.structureId}" has no ${spec.kind} to ask about`); continue; }

    const wrong: string[] = [];
    let bad = false;
    for (const distractor of spec.distractors) {
      if (typeof distractor !== 'string') {
        if (spec.kind !== 'nerve') { fault('a nerve name is only a wrong answer to a nerve question'); bad = true; break; }
        wrong.push(distractor.nerve);
        continue;
      }
      const other = content.indexById.get(distractor);
      if (!other) { fault(`no structure "${distractor}" for a wrong answer`); bad = true; break; }
      if (!inScope(other)) { fault(`wrong answer "${distractor}" is outside the paper's area`); bad = true; break; }
      // A picture's choices are all the same kind of thing as the answer: a
      // bone among three ligaments is not a choice anyone has to think about.
      if (spec.kind === 'identify' && other.category !== entry.category) {
        fault(`wrong answer "${distractor}" is not a ${entry.category}`);
        bad = true;
        break;
      }
      // A vignette's choices are structures that have an injury listed, as in the ordinary clinical questions.
      if (spec.kind === 'injury' && !content.structuresById.get(distractor)?.commonInjuries?.length) {
        fault(`wrong answer "${distractor}" has no injury listed`);
        bad = true;
        break;
      }
      const value = answerOf(spec.kind, other, content.structuresById.get(distractor));
      if (!value) { fault(`wrong answer "${distractor}" has no ${spec.kind}`); bad = true; break; }
      // Spelt as it was when the paper was published, where the seed has
      // since respelt it. A pair that finds nothing to respell means the seed
      // has moved again, and the paper is no longer the one that was sat.
      const wording = paper.publishedWording?.[spec.id]?.[distractor];
      if (wording && !value.includes(wording[0])) {
        fault(`wrong answer "${distractor}" no longer reads "${wording[0]}", so it cannot be put back to "${wording[1]}"`);
        bad = true;
        break;
      }
      wrong.push(wording ? value.replace(wording[0], wording[1]) : value);
    }
    if (bad) continue;

    const pool = [correct, ...wrong];
    if (pool.length !== PAPER_CHOICES || new Set(pool).size !== PAPER_CHOICES) {
      fault(`does not come to ${PAPER_CHOICES} different choices`);
      continue;
    }

    const choices = shuffle(pool, createRng(seedFrom(spec.id)));
    questions.push({
      ...questionBase(entry, PROMPT_KIND[spec.kind]),
      type: 'mcq',
      id: spec.id,
      prompt,
      ...(image ? { promptImageId: image.id } : {}),
      choices,
      correctIndex: choices.indexOf(correct),
      // Never shown: a sitting gives no feedback (lib/diagnostic.ts, rule 2).
      explanation: '',
    });
  }

  if (problems.length > 0) return { questions: [], problems };
  if (!replayIds || replayIds.length === 0) return { questions, problems };

  const wanted = new Set(replayIds);
  const asked = questions.filter((q) => wanted.has(q.id));
  // A baseline that recorded a question this paper no longer has cannot be repeated.
  if (asked.length !== wanted.size) {
    return { questions: [], problems: [`${paper.id}: the baseline recorded questions this paper does not have`] };
  }
  return { questions: asked, problems };
}

/**
 * What a paper is held to before it is published, beyond building: fifteen
 * questions, no structure asked about twice, ids that are unique and say
 * which paper they belong to. Returned as a list so the script and the test
 * can print every fault at once.
 */
export function paperShapeProblems(file: DiagnosticPapersFile): string[] {
  const problems: string[] = [];
  const expected: PaperId[] = [WHOLE_BODY_PAPER, ...AREAS];
  const ids = file.papers.map((p) => p.id);
  for (const id of expected) if (!ids.includes(id)) problems.push(`no paper "${id}"`);
  for (const id of ids) if (!expected.includes(id)) problems.push(`unknown paper "${id}"`);
  if (new Set(ids).size !== ids.length) problems.push('a paper is listed twice');

  const seen = new Set<string>();
  for (const paper of file.papers) {
    if (paper.questions.length !== PAPER_SIZE) problems.push(`${paper.id}: ${paper.questions.length} questions, not ${PAPER_SIZE}`);
    const structures = new Set<string>();
    for (const q of paper.questions) {
      if (structures.has(q.structureId)) problems.push(`${paper.id}: "${q.structureId}" is asked about twice`);
      structures.add(q.structureId);
      if (seen.has(q.id)) problems.push(`${paper.id}: question id "${q.id}" is used twice`);
      seen.add(q.id);
      if (q.id !== paperQuestionId(file.version, paper.id, q)) problems.push(`${paper.id}: question id "${q.id}" does not match what it asks`);
      if (q.distractors.length !== PAPER_CHOICES - 1) problems.push(`${paper.id} ${q.id}: ${q.distractors.length} wrong answers, not ${PAPER_CHOICES - 1}`);
    }
    // A respelling belongs to a wrong answer this paper really has.
    for (const [questionId, byStructure] of Object.entries(paper.publishedWording ?? {})) {
      const q = paper.questions.find((x) => x.id === questionId);
      if (!q) { problems.push(`${paper.id}: publishedWording names "${questionId}", which is not on the paper`); continue; }
      for (const structureId of Object.keys(byStructure)) {
        if (!q.distractors.includes(structureId)) problems.push(`${paper.id} ${questionId}: publishedWording names "${structureId}", which is not one of its wrong answers`);
      }
    }
  }
  return problems;
}

/** `dx3.knee.vastus-lateralis.nerve` — the version, the paper, the structure, the kind. */
export function paperQuestionId(version: number, paper: PaperId, q: Pick<PaperQuestionSpec, 'structureId' | 'kind'>): string {
  return `dx${version}.${paper}.${q.structureId}.${q.kind}`;
}
