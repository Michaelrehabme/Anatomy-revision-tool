import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import { generateRevisionSet, type RevisionSetConfig } from '../questionGenerators/generateSet';
import { buildStarterSet } from '../questionGenerators/starterSet';
import { buildDiagnostic, buildDiagnosticQuestions } from '../diagnostic';
import { previewAssignment } from '../../../educator/lib/assignmentScope';
import { AREAS } from '../../types/region';
import type { FactMastery, StructureMastery } from '../../types/attempt';
import type { MCQQuestion, QuestionType } from '../../types/question';

/**
 * THE BEFORE-AND-AFTER CHECK FOR WORK THAT MUST NOT CHANGE A QUESTION
 * (docs/CONTENT-SERVER-STATUS.md, "Proof that nothing changed").
 *
 * Builds a fixed list of sessions under fixed seeds — every area on its own,
 * every question type, practice, assessment, adaptive, mastery-weighted,
 * priority, drills, the free-tier clamp, the starter set, the diagnostic and
 * the assignment previews — and writes every question to one JSON file with
 * its SHA-256. Run it before a refactor and after; the same hash means the
 * same questions, byte for byte, and a different one comes with two files to
 * diff.
 *
 *   QUESTION_DUMP=/path/to/before.json npx vitest run --exclude ".claude/**" \
 *     src/features/anatomy-revision/lib/__tests__/questionDump.test.ts
 *
 * Skipped unless QUESTION_DUMP is set: it asserts nothing about the content,
 * so on an ordinary run it would only cost time.
 *
 * It reads the SEED, through the same entry points the app calls with the
 * seed bundled. It therefore says nothing about a build that loads facts per
 * area; singleAreaGeneration.test.ts is the check for that.
 */

const OUT = process.env.QUESTION_DUMP;
const NOW = new Date('2026-10-05T09:00:00.000Z');
const ALL_TYPES: QuestionType[] = ['flashcard', 'mcq', 'locate', 'fill-blank', 'identify-typed', 'multi-select', 'oina'];

/** Mastery that is a function of the dataset alone: every third structure, in three states. */
function syntheticMastery(): StructureMastery[] {
  return ALL_STRUCTURES.filter((_, i) => i % 3 === 0).map((s, i) => ({
    structureId: s.id,
    userId: 'dump',
    attemptsTotal: 4 + (i % 5),
    attemptsCorrect: i % 4,
    lastAttemptAt: new Date(NOW.getTime() - (i % 20) * 86400000).toISOString(),
    dueAt: new Date(NOW.getTime() + ((i % 7) - 3) * 86400000).toISOString(),
    intervalDays: 1 + (i % 9),
    easeFactor: 2.3,
  }));
}

function syntheticFactMastery(): FactMastery[] {
  const kinds = ['origin', 'insertion', 'nerve', 'action'] as const;
  return ALL_STRUCTURES.filter((s) => s.category === 'muscle')
    .filter((_, i) => i % 2 === 0)
    .flatMap((s, i) =>
      kinds.slice(0, 1 + (i % 4)).map((promptKind, k) => ({
        userId: 'dump',
        structureId: s.id,
        promptKind,
        attemptsTotal: 3 + k,
        attemptsCorrect: (i + k) % 4,
        streak: (i + k) % 3,
        missStreak: (i + k) % 2,
        lastCorrect: (i + k) % 2 === 0,
        lastAttemptAt: new Date(NOW.getTime() - k * 86400000).toISOString(),
        typed: (i + k) % 3 === 0,
      })),
    );
}

describe.skipIf(!OUT)('question dump', () => {
  // THE CLOCK IS FIXED. Several generators read the time when a config gives
  // none (whether a fact is due decides its format and its learn card), and
  // two dumps taken an hour apart differed in exactly those sessions until
  // this was added. With it, a dump is a function of the code and the seed.
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });
  afterAll(() => vi.useRealTimers());

  it('writes every question of every fixed configuration', () => {
    const mastery = syntheticMastery();
    const factMastery = syntheticFactMastery();
    const muscles = ALL_STRUCTURES.filter((s) => s.category === 'muscle').map((s) => s.id);
    const ligaments = ALL_STRUCTURES.filter((s) => s.category === 'ligament').map((s) => s.id);

    const configs: Record<string, RevisionSetConfig> = {};
    for (const area of AREAS) {
      for (const seed of [11, 12, 13]) {
        configs[`area ${area} seed ${seed}`] = { types: ALL_TYPES, mode: 'practice', areas: [area], entitledAreas: [area], seed, learnCardAttempts: 0 };
      }
    }
    for (const type of ALL_TYPES) {
      configs[`type ${type}`] = { types: [type], mode: 'practice', entitledAreas: AREAS, seed: 21, learnCardAttempts: 3 };
    }
    for (const seed of [31, 32, 33]) {
      configs[`practice all seed ${seed}`] = { types: ALL_TYPES, mode: 'practice', entitledAreas: AREAS, seed, count: 40 };
      configs[`assessment seed ${seed}`] = { types: ['mcq', 'identify-typed', 'multi-select', 'locate', 'oina'], mode: 'assessment', entitledAreas: AREAS, seed, count: 30 };
      configs[`adaptive seed ${seed}`] = { types: ['mcq', 'locate', 'identify-typed', 'oina'], mode: 'adaptive', entitledAreas: AREAS, seed, count: 20, mastery, now: NOW };
      configs[`mastery-weighted seed ${seed}`] = { types: ['mcq', 'locate', 'identify-typed'], mode: 'practice', entitledAreas: AREAS, seed, count: 20, mastery, now: NOW };
      configs[`oina fact mastery seed ${seed}`] = { types: ['oina'], mode: 'practice', entitledAreas: AREAS, areas: ['hip', 'knee'], seed, factMastery, learnCardAttempts: 3 };
    }
    configs['priority'] = { types: ['mcq', 'oina'], mode: 'practice', entitledAreas: AREAS, seed: 41, count: 20, priorityStructureIds: muscles.slice(0, 12), mastery, now: NOW };
    configs['drill one muscle'] = { types: ['oina', 'mcq'], mode: 'practice', entitledAreas: AREAS, seed: 42, structureIds: muscles.slice(5, 6), factMastery, learnCardAttempts: 3 };
    configs['quiz ligaments'] = { types: ['mcq', 'locate', 'identify-typed'], mode: 'practice', entitledAreas: AREAS, seed: 43, structureIds: ligaments.slice(0, 25), count: 20, mastery, now: NOW, learnCardAttempts: 0 };
    configs['free tier, nothing picked'] = { types: ALL_TYPES, mode: 'practice', entitledAreas: ['knee'], seed: 44, count: 30 };
    configs['free tier, locked drill'] = { types: ['oina', 'mcq'], mode: 'practice', entitledAreas: ['knee'], seed: 45, structureIds: muscles.slice(0, 40) };
    configs['groups'] = { types: ['mcq', 'oina'], mode: 'practice', entitledAreas: AREAS, seed: 46, groups: ['rotator-cuff', 'hip-flexors'] };
    configs['bones and joints'] = { types: ALL_TYPES, mode: 'assessment', entitledAreas: AREAS, seed: 47, categories: ['bone', 'joint'], count: 25 };

    const dump: Record<string, unknown> = {};
    let questions = 0;
    for (const [name, config] of Object.entries(configs)) {
      const set = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, config);
      questions += set.length;
      dump[name] = set;
    }
    for (const area of AREAS) {
      const set = buildStarterSet(ALL_STRUCTURES, ALL_IMAGES, { areas: [area], seed: 51 });
      questions += set.length;
      dump[`starter ${area}`] = set;
    }
    // The diagnostic, built as DiagnosticScreen builds it.
    const pool = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      types: ['mcq'], mode: 'practice', seed: 1, entitledAreas: AREAS,
    }).filter((q): q is MCQQuestion => q.type === 'mcq');
    for (const cohortId of ['cohort-a', 'demo-cohort', '7b1c']) {
      const spec = buildDiagnostic(ALL_STRUCTURES, cohortId);
      const set = buildDiagnosticQuestions(spec, pool);
      questions += set.length;
      dump[`diagnostic ${cohortId}`] = { spec, set };
    }
    // Only the two numbers: the preview has since gained fields that say how
    // it was counted, which are not part of what a student is asked.
    dump['assignment previews'] = [
      previewAssignment({ areas: ['shoulder'] }, ['mcq']),
      previewAssignment({ areas: ['hip', 'knee'], category: 'muscle' }, ['mcq', 'oina']),
      previewAssignment({ areas: [...AREAS] }, ['mcq', 'identify-typed', 'multi-select', 'locate', 'oina']),
      previewAssignment({ areas: ['hip'], groups: ['hip-flexors'] }, ['oina']),
      previewAssignment({ areas: ['wrist-hand'], category: 'ligament' }, ['identify-typed', 'locate']),
    ].map(({ poolSize, available }) => ({ poolSize, available }));

    const text = JSON.stringify(dump);
    const hash = createHash('sha256').update(text).digest('hex');
    writeFileSync(OUT!, text);
    writeFileSync(`${OUT}.sha256`, `${hash}  ${Object.keys(dump).length} configurations, ${questions} questions\n`);
    console.log(`question dump: ${Object.keys(dump).length} configurations, ${questions} questions, sha256 ${hash}`);
    expect(questions).toBeGreaterThan(1000);
  }, 600_000);
});
