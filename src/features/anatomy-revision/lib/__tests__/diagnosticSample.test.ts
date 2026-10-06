import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import { AREAS } from '../../types/region';
import { areasOf } from '../../types/structure';
import { generateRevisionSet } from '../questionGenerators/generateSet';
import type { MCQQuestion } from '../../types/question';
import {
  COHORT_DRAWN_VERSION,
  DIAGNOSTIC_SIZE,
  DIAGNOSTIC_VERSION,
  pairDiagnostics,
  type DiagnosticResult,
} from '../diagnostic';
import {
  FIXED_SAMPLE_MARKER,
  hasFixedSample,
  loadFixedSampleFile,
  resolveDiagnosticPaper,
} from '../diagnosticSample';

/**
 * The diagnostic's fixed paper (docs/CONTENT-SERVER-STATUS.md, decision 7).
 *
 * What is held here: the paper is one thing for everyone and for both
 * sittings; every question on it can be answered as printed; it publishes
 * what diagnosticSample.ts says it publishes and no more; and a baseline sat
 * before it existed is followed up on its own paper, not this one.
 */

const PATH = `src/features/anatomy-revision/data/diagnostic/fixedSample.v${DIAGNOSTIC_VERSION}.json`;
const file = (await loadFixedSampleFile(DIAGNOSTIC_VERSION))!;
const questions = file.questions.map((q) => q.question);

function sitting(over: Partial<DiagnosticResult> & Pick<DiagnosticResult, 'phase' | 'version'>): DiagnosticResult {
  return { userId: 'u1', cohortId: 'c1', correct: 6, total: 15, takenAt: '2026-10-01T09:00:00.000Z', ...over };
}

describe('the fixed paper', () => {
  it('is fifteen different questions about fifteen different structures', () => {
    expect(file.version).toBe(DIAGNOSTIC_VERSION);
    expect(file.sample).toBe(`${FIXED_SAMPLE_MARKER}${DIAGNOSTIC_VERSION}`);
    expect(questions).toHaveLength(DIAGNOSTIC_SIZE);
    expect(new Set(questions.map((q) => q.id)).size).toBe(DIAGNOSTIC_SIZE);
    expect(new Set(questions.map((q) => q.structureId)).size).toBe(DIAGNOSTIC_SIZE);
  });

  it('is the same every time it is asked for, to the byte', async () => {
    const a = await resolveDiagnosticPaper('baseline');
    const b = await resolveDiagnosticPaper('baseline');
    expect(a.kind).toBe('fixed');
    expect(a.version).toBe(DIAGNOSTIC_VERSION);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    // And it is the committed file, not something derived from the seed.
    const onDisk = JSON.parse(readFileSync(PATH, 'utf8'));
    expect(JSON.stringify(a.kind === 'fixed' && a.questions)).toBe(
      JSON.stringify(onDisk.questions.map((q: { question: unknown }) => q.question)),
    );
  });

  // Nothing about the sitter goes in: no content, no entitlement, no class.
  // A student holding one area and one holding nine cannot be handed
  // different papers because there is nothing to hand them differently BY.
  // (diagnosticScreen.test.tsx renders both and compares what is on screen.)
  it('takes nothing about the sitter', () => {
    expect(resolveDiagnosticPaper.length).toBeLessThanOrEqual(2);
  });

  it('covers every one of the nine areas', () => {
    expect(new Set(file.questions.map((q) => q.coversArea))).toEqual(new Set(AREAS));
    const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
    for (const { coversArea, question } of file.questions) {
      expect(areasOf(byId.get(question.structureId)!), question.id).toContain(coversArea);
    }
  });

  it('can be answered as printed: four different choices, one of them right', () => {
    const images = new Map(ALL_IMAGES.map((i) => [i.id, i]));
    for (const q of questions) {
      expect(q.type).toBe('mcq');
      expect(q.prompt.length, q.id).toBeGreaterThan(10);
      expect(q.choices, q.id).toHaveLength(4);
      expect(new Set(q.choices).size, q.id).toBe(4);
      expect(q.choices.every((c) => c.trim().length > 0), q.id).toBe(true);
      expect(q.correctIndex, q.id).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex, q.id).toBeLessThan(4);
      if (q.promptKind === 'identify') {
        // A picture question is only a question with its picture.
        expect(images.get(q.promptImageId!), q.id).toBeTruthy();
      } else {
        expect(q.promptImageId, q.id).toBeUndefined();
      }
    }
  });

  it('asks the kinds of question the diagnostic asked before, spread', () => {
    const kinds: Record<string, number> = {};
    for (const q of questions) kinds[q.promptKind] = (kinds[q.promptKind] ?? 0) + 1;
    expect(kinds).toEqual({ action: 3, identify: 3, insertion: 3, nerve: 3, origin: 2, functional: 1 });
  });

  // The paper is frozen and the seed is not. If a fact the paper marks as the
  // right answer is corrected in the seed, the paper is now marking a wrong
  // answer right, and nothing else would say so. This fails instead. The fix
  // is a new version of the paper (src/scripts/buildDiagnosticSample.ts), not
  // an edit to this one: students have sat it.
  it('still marks as right what the dataset says is right', () => {
    const pool = new Map(
      generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { types: ['mcq'], mode: 'practice', seed: 1, entitledAreas: AREAS })
        .filter((q): q is MCQQuestion => q.type === 'mcq')
        .map((q) => [q.id, q]),
    );
    for (const q of questions) {
      const now = pool.get(q.id);
      expect(now, `${q.id} is no longer a question the app asks`).toBeTruthy();
      expect(q.choices[q.correctIndex], q.id).toBe(now!.choices[now!.correctIndex]);
      expect(q.prompt, q.id).toBe(now!.prompt);
    }
  });
});

describe('what the fixed paper makes public', () => {
  it('is a prompt, a picture id, four choices and the answer, and no explanation', () => {
    const allowed = new Set([
      'id', 'structureId', 'region', 'subregion', 'area', 'category', 'difficulty', 'promptKind',
      'type', 'prompt', 'promptImageId', 'choices', 'correctIndex', 'explanation',
    ]);
    expect(Object.keys(file).filter((k) => k !== 'default').sort()).toEqual(['drawnAs', 'questions', 'sample', 'version']);
    for (const entry of file.questions) {
      expect(Object.keys(entry).sort()).toEqual(['coversArea', 'question']);
      expect(Object.keys(entry.question).filter((k) => !allowed.has(k)), entry.question.id).toEqual([]);
      // The generator's explanation is the structure's whole card.
      expect(entry.question.explanation).toBe('');
    }
  });

  // The list in lib/diagnosticSample.ts and docs/CONTENT-SERVER-STATUS.md.
  // Changing the paper changes what is public: this has to be changed with it.
  it('states one fact about each of these twelve muscles, and none about the three shown as pictures', () => {
    expect(questions.map((q) => `${q.structureId}: ${q.promptKind}`).sort()).toEqual([
      'brachioradialis: insertion',
      'external-oblique: nerve',
      'flexor-digiti-minimi-brevis-foot: insertion',
      'flexor-digitorum-longus: origin',
      'flexor-digitorum-profundus: identify',
      'iliocostalis: identify',
      'latissimus-dorsi: functional',
      'levator-scapulae: insertion',
      'longissimus: origin',
      'multifidus: action',
      'obturator-internus: action',
      'opponens-digiti-minimi-hand: nerve',
      'popliteus: action',
      'psoas-major: identify',
      'vastus-intermedius: nerve',
    ]);
  });

  it('offers only names beside a picture', () => {
    const names = new Set(ALL_STRUCTURES.map((s) => s.name));
    for (const q of questions.filter((x) => x.promptKind === 'identify')) {
      expect(q.choices.every((c) => names.has(c)), q.id).toBe(true);
    }
  });

  it('is small: a few kilobytes, loaded only when a sitting starts', () => {
    expect(readFileSync(PATH).length).toBeLessThan(16_000);
  });
});

describe('which paper a sitting gets', () => {
  it('gives a follow-up the same fifteen its baseline asked', async () => {
    const baseline = await resolveDiagnosticPaper('baseline');
    if (baseline.kind !== 'fixed') throw new Error('expected the fixed paper');
    const followUp = await resolveDiagnosticPaper('followUp', {
      version: baseline.version,
      // As a sitting stores them: in the order shown, which is shuffled.
      questionIds: [...baseline.questions.map((q) => q.id)].reverse(),
    });
    expect(followUp).toEqual(baseline);
  });

  it('gives a follow-up the whole paper when its baseline recorded no questions', async () => {
    const followUp = await resolveDiagnosticPaper('followUp', { version: DIAGNOSTIC_VERSION });
    expect(followUp.kind === 'fixed' && followUp.questions).toHaveLength(DIAGNOSTIC_SIZE);
  });

  // The classes mid-diagnostic on the live site. Their baseline was drawn for
  // their class under version 1; the follow-up has to be that paper.
  it('never gives the fixed paper to a follow-up whose baseline was sat before it existed', async () => {
    expect(hasFixedSample(COHORT_DRAWN_VERSION)).toBe(false);
    const paper = await resolveDiagnosticPaper('followUp', { version: COHORT_DRAWN_VERSION, questionIds: ['mcq-a', 'mcq-b'] });
    expect(paper).toEqual({ kind: 'cohortDrawn', version: COHORT_DRAWN_VERSION, replayIds: ['mcq-a', 'mcq-b'] });
  });

  it('gives a new baseline the fixed paper whatever was sat before', async () => {
    const paper = await resolveDiagnosticPaper('baseline', { version: COHORT_DRAWN_VERSION, questionIds: ['mcq-a'] });
    expect(paper.kind).toBe('fixed');
    expect(paper.version).toBe(DIAGNOSTIC_VERSION);
  });
});

describe('pairing across the change of paper', () => {
  const ids = questions.map((q) => q.id);

  it('does not pair a version-1 baseline with a follow-up on the fixed paper', () => {
    expect(pairDiagnostics([
      sitting({ phase: 'baseline', version: COHORT_DRAWN_VERSION, questionIds: ['mcq-a', 'mcq-b'] }),
      sitting({ phase: 'followUp', version: DIAGNOSTIC_VERSION, questionIds: ids, takenAt: '2026-12-15T09:00:00.000Z' }),
    ])).toEqual([]);
  });

  // Not even when neither sitting recorded its questions, which `sameQuestions`
  // alone would let through as "unknown".
  it('does not pair them when neither recorded its questions either', () => {
    expect(pairDiagnostics([
      sitting({ phase: 'baseline', version: COHORT_DRAWN_VERSION }),
      sitting({ phase: 'followUp', version: DIAGNOSTIC_VERSION, takenAt: '2026-12-15T09:00:00.000Z' }),
    ])).toEqual([]);
  });

  it('pairs a version-1 baseline with its version-1 follow-up, as before', () => {
    expect(pairDiagnostics([
      sitting({ phase: 'baseline', version: COHORT_DRAWN_VERSION, questionIds: ['mcq-a', 'mcq-b'] }),
      sitting({ phase: 'followUp', version: COHORT_DRAWN_VERSION, questionIds: ['mcq-b', 'mcq-a'], correct: 9, takenAt: '2026-12-15T09:00:00.000Z' }),
    ])).toHaveLength(1);
  });

  it('pairs two sittings of the fixed paper', () => {
    const [gain] = pairDiagnostics([
      sitting({ phase: 'baseline', version: DIAGNOSTIC_VERSION, questionIds: ids }),
      sitting({ phase: 'followUp', version: DIAGNOSTIC_VERSION, questionIds: [...ids].reverse(), correct: 12, takenAt: '2026-12-15T09:00:00.000Z' }),
    ]);
    expect(gain.gainPoints).toBe(40);
  });
});
