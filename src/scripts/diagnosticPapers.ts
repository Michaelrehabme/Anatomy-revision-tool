/**
 * The diagnostic's papers: check them, fill in a new question, publish them.
 *
 *   npm run papers:check                 does every paper still build what was published?
 *   npm run papers:publish               write the lock and docs/DIAGNOSTIC-PAPERS.md (first time)
 *   npm run papers:publish -- --force    publish again over an existing lock
 *   npx tsx src/scripts/diagnosticPapers.ts --fill
 *                                        complete any question in the file that has no
 *                                        id, picture or wrong answers yet
 *
 * THE PAPERS are src/features/anatomy-revision/data/diagnostic/papers.v<N>.json
 * (lib/diagnosticPapers.ts says what they are and why they hold no facts).
 * Ten of them: the whole body, and one for each area. The questions were
 * CHOSEN, not drawn: what a first- or second-year sports therapy or
 * physiotherapy student is commonly taught and examined on in that area.
 *
 * TO SWAP A QUESTION BEFORE ANYONE HAS SAT THE PAPER. Edit the file: give the
 * entry its "structureId" and "kind" and delete its "id", "imageId" and
 * "distractors". Run with --fill, which picks the picture and three wrong
 * answers from the paper's own area (the same way every time), and prints
 * what the question now reads as. Change the wrong answers by hand if a
 * better neighbour exists. Then `npm run papers:publish -- --force`, and
 * read docs/DIAGNOSTIC-PAPERS.md.
 *
 * ONCE ANYONE HAS SAT IT, a paper is never edited: see NEW_VERSION_NEEDED in
 * lib/paperLock.ts, which is what the check prints when the seed has moved
 * under a published question.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_IMAGES, ALL_STRUCTURES } from '../features/anatomy-revision/data/seed';
import { buildVocabulary } from '../features/anatomy-revision/data/content/vocabulary';
import { AREA_LABELS } from '../features/anatomy-revision/types/region';
import { areasOf, isMuscle, type AnatomyStructure } from '../features/anatomy-revision/types/structure';
import { promptImagesFor } from '../features/anatomy-revision/lib/questionGenerators/promptImages';
import { createRng, shuffle } from '../features/anatomy-revision/lib/rng';
import {
  PAPER_CHOICES,
  PAPER_VERSION,
  WHOLE_BODY_PAPER,
  paperQuestionId,
  paperScope,
  type DiagnosticPaperSpec,
  type DiagnosticPapersFile,
  type PaperDistractor,
  type PaperQuestionKind,
  type PaperQuestionSpec,
} from '../features/anatomy-revision/lib/diagnosticPapers';
import { NEW_VERSION_NEEDED, buildFromScope, lockDrift, lockFor, type PaperLock } from './lib/paperLock';

const DIR = 'src/features/anatomy-revision/data/diagnostic';
const PAPERS = join(process.cwd(), DIR, `papers.v${PAPER_VERSION}.json`);
const LOCK = join(process.cwd(), DIR, `papers.v${PAPER_VERSION}.lock.json`);
const TABLE = join(process.cwd(), 'docs/DIAGNOSTIC-PAPERS.md');

const args = new Set(process.argv.slice(2));
const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
const vocabulary = buildVocabulary(ALL_STRUCTURES);

function readPapers(): DiagnosticPapersFile {
  return JSON.parse(readFileSync(PAPERS, 'utf8')) as DiagnosticPapersFile;
}

function seedFrom(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** A structure's answer to a kind of question, as the seed states it. */
function valueOf(kind: PaperQuestionKind, s: AnatomyStructure): string | null {
  if (kind === 'identify' || kind === 'injury') return s.name;
  if (kind === 'functional') return s.functionalContext ?? null;
  if (!isMuscle(s)) return null;
  if (kind === 'origin') return s.origin.join('; ');
  if (kind === 'insertion') return s.insertion.join('; ');
  if (kind === 'nerve') return s.nerve.map((n) => n.name).join('; ');
  return s.actionText;
}

/**
 * Three wrong answers for a question that has none, from the paper's own
 * scope: nearest neighbours first (the same muscle group, then the same part
 * of the area), then anything else there of the same kind, drawn the same
 * way every time from the question's id.
 */
function suggestDistractors(paper: DiagnosticPaperSpec, q: PaperQuestionSpec): PaperDistractor[] {
  const scope = paperScope(paper.id);
  const target = byId.get(q.structureId)!;
  const correct = valueOf(q.kind, target)!;
  const pool = ALL_STRUCTURES.filter((s) => s.id !== target.id && areasOf(s).some((a) => scope.includes(a)));
  const usable = pool.filter((s) => {
    if (q.kind === 'identify') return s.category === target.category;
    if (q.kind === 'injury') return (s.commonInjuries?.length ?? 0) > 0;
    return valueOf(q.kind, s) !== null;
  });
  const groups = new Set(target.groups ?? []);
  const tiers = [
    usable.filter((s) => (s.groups ?? []).some((g) => groups.has(g))),
    usable.filter((s) => s.subregion === target.subregion && s.category === target.category),
    usable.filter((s) => s.category === target.category),
    usable,
  ];
  const rng = createRng(seedFrom(`${paper.id}.${q.structureId}.${q.kind}`));
  const picked: string[] = [];
  const values = new Set([correct]);
  for (const tier of tiers) {
    for (const s of shuffle(tier, rng)) {
      if (picked.length >= PAPER_CHOICES - 1) break;
      const value = valueOf(q.kind, s)!;
      if (values.has(value)) continue;
      values.add(value);
      picked.push(s.id);
    }
  }
  return picked;
}

function fill(): void {
  const file = readPapers();
  for (const paper of file.papers) {
    for (const q of paper.questions) {
      const target = byId.get(q.structureId);
      if (!target) throw new Error(`${paper.id}: no structure "${q.structureId}" in the seed.`);
      q.id = paperQuestionId(file.version, paper.id, q);
      if (q.kind === 'identify' && !q.imageId) {
        const picture = promptImagesFor(target, ALL_IMAGES)[0];
        if (!picture) throw new Error(`${paper.id}: "${q.structureId}" has no picture to be identified from.`);
        q.imageId = picture.id;
      }
      if (q.kind === 'injury' && q.injury === undefined) q.injury = 0;
      if (!q.distractors || q.distractors.length === 0) {
        q.distractors = suggestDistractors(paper, q);
        console.log(`filled ${q.id}: ${q.distractors.join(', ')}`);
      }
    }
    // One order of keys, so a diff of the file shows what changed and nothing else.
    paper.questions = paper.questions.map((q) => ({
      id: q.id,
      structureId: q.structureId,
      kind: q.kind,
      ...(q.imageId ? { imageId: q.imageId } : {}),
      ...(q.injury !== undefined ? { injury: q.injury } : {}),
      distractors: q.distractors,
    }));
  }
  writeFileSync(PAPERS, `${JSON.stringify(file, null, 2)}\n`);
}

/** Everything a paper must be, beyond what the lock holds: listed so every fault prints at once. */
function contentProblems(file: DiagnosticPapersFile): string[] {
  const problems: string[] = [];
  for (const paper of file.papers) {
    for (const q of paper.questions) {
      const target = byId.get(q.structureId);
      // Reviewed data only: a fact still flagged for review is not one to measure a class on.
      if (target?.needsReview) problems.push(`${paper.id} ${q.id}: "${q.structureId}" is flagged needsReview`);
      for (const d of q.distractors) {
        if (typeof d === 'string') {
          if (byId.get(d)?.needsReview) problems.push(`${paper.id} ${q.id}: wrong answer "${d}" is flagged needsReview`);
        } else if (!vocabulary.nerves.includes(d.nerve)) {
          problems.push(`${paper.id} ${q.id}: "${d.nerve}" is not a nerve name in the public vocabulary`);
        }
      }
    }
  }
  return problems;
}

const KIND_LABEL: Record<PaperQuestionKind, string> = {
  identify: 'name the picture',
  origin: 'origin',
  insertion: 'insertion',
  nerve: 'nerve',
  action: 'action',
  functional: 'functional (clinical)',
  injury: 'injury vignette (clinical)',
};

const cell = (text: string) => text.replace(/\|/g, '\\|');

function table(file: DiagnosticPapersFile): string {
  const lines: string[] = [
    '# The diagnostic papers',
    '',
    `Version ${file.version}. Written by \`npm run papers:publish\` from`,
    `\`${DIR}/papers.v${file.version}.json\` and the seed; do not edit by hand.`,
    '',
    'Ten papers of fifteen questions. A student with every area sits the whole-body paper; a',
    'student on a free account sits the paper for their free area. The questions were chosen for',
    'what a first- or second-year sports therapy or physiotherapy student is commonly taught and',
    'examined on. They are the owner\'s to change **before the first sitting of that paper**; after',
    'it, only as a new version. How to swap one is at the top of `src/scripts/diagnosticPapers.ts`.',
    '',
    'The right answer is printed here as the seed states it. This file is in the repository and',
    'is not part of any build: the papers themselves hold no answers.',
    '',
  ];
  for (const paper of file.papers) {
    const built = buildFromScope(paper, ALL_STRUCTURES, ALL_IMAGES);
    const title = paper.id === WHOLE_BODY_PAPER ? 'Whole body' : AREA_LABELS[paper.id];
    lines.push(`## ${title}`, '');
    lines.push(
      paper.id === WHOLE_BODY_PAPER
        ? 'Sat by anyone holding every area. Built from all nine areas.'
        : `Sat by a free account whose free area is ${AREA_LABELS[paper.id]}. Built from that area alone.`,
      '',
    );
    lines.push('| # | Structure | Kind of thing | Question | Right answer (as the seed states it) | Wrong answers are those of |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    paper.questions.forEach((q, i) => {
      const target = byId.get(q.structureId)!;
      const question = built.questions.find((b) => b.id === q.id);
      const from = q.distractors
        .map((d) => (typeof d === 'string' ? (byId.get(d)?.name ?? d) : `${d.nerve} (a nerve name)`))
        .join('; ');
      lines.push(
        `| ${i + 1} | ${cell(target.name)} | ${target.category} | ${KIND_LABEL[q.kind]}: ${cell(question?.prompt ?? '(does not build)')} | ` +
          `${cell(question ? question.choices[question.correctIndex] : '—')} | ${cell(from)} |`,
      );
    });
    lines.push('');
  }
  return `${lines.join('\n')}`;
}

function review(file: DiagnosticPapersFile): void {
  for (const paper of file.papers) {
    const built = buildFromScope(paper, ALL_STRUCTURES, ALL_IMAGES);
    console.log(`\n=== ${paper.id} ===`);
    for (const q of built.questions) {
      console.log(`  ${q.id}\n    ${q.prompt}${q.promptImageId ? `  [${q.promptImageId}]` : ''}`);
      q.choices.forEach((c, i) => console.log(`      ${i === q.correctIndex ? '*' : ' '} ${c}`));
    }
  }
}

if (args.has('--fill')) fill();

const file = readPapers();
const { lock, problems } = lockFor(file, ALL_STRUCTURES, ALL_IMAGES);
problems.push(...contentProblems(file));
if (problems.length > 0) {
  console.error(`\nThe papers do not hold up:\n${problems.map((p) => `  ${p}`).join('\n')}\n`);
  process.exit(1);
}
if (args.has('--review')) review(file);

if (args.has('--publish')) {
  if (existsSync(LOCK) && !args.has('--force')) {
    const drift = lockDrift(JSON.parse(readFileSync(LOCK, 'utf8')) as PaperLock, lock);
    if (drift.length > 0) {
      console.error(`\nThese papers were published already and no longer match:\n${drift.map((d) => `  ${d}`).join('\n')}\n\n${NEW_VERSION_NEEDED}\n`);
      process.exit(1);
    }
  }
  writeFileSync(LOCK, `${JSON.stringify(lock, null, 2)}\n`);
  writeFileSync(TABLE, `${table(file)}\n`);
  console.log(`Published version ${file.version}: ${Object.keys(lock.questions).length} questions on ${file.papers.length} papers.`);
  console.log(`  ${LOCK}\n  ${TABLE}`);
  process.exit(0);
}

if (!existsSync(LOCK)) {
  console.error('The papers build, but have never been published: run `npm run papers:publish`.');
  process.exit(1);
}
const drift = lockDrift(JSON.parse(readFileSync(LOCK, 'utf8')) as PaperLock, lock);
if (drift.length > 0) {
  console.error(`\nA published diagnostic paper has changed:\n${drift.map((d) => `  ${d}`).join('\n')}\n\n${NEW_VERSION_NEEDED}\n`);
  process.exit(1);
}
console.log(`papers:check — version ${file.version}: ${file.papers.length} papers, ${Object.keys(lock.questions).length} questions, all as published.`);
