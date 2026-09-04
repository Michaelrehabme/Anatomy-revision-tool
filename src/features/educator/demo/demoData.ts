import { ALL_STRUCTURES } from '../../anatomy-revision/data/seed';
import type { AnatomyStructure, Category } from '../../anatomy-revision/types/structure';
import type { QuestionType } from '../../anatomy-revision/types/question';
import type { Region } from '../../anatomy-revision/types/region';
import type { RevisionSessionSummary, UserAttempt } from '../../anatomy-revision/types/attempt';
import type { Assignment, Cohort, CohortStudent } from '../types/cohort';

/**
 * Fixture cohort data for VITE_EDUCATOR_DEMO=1 — see README "Educator demo
 * mode". Exists so the /educator screens can be reviewed locally without a
 * Firebase project, an educator custom claim, or real students' data.
 *
 * Deliberately generated rather than hand-written: every educator screen is
 * an aggregate (weakness tables, confusion pairs, retention curves), and a
 * dozen hand-typed attempts produce charts that look broken rather than
 * charts that look empty. The generator is seeded, so the same class,
 * the same weak structures and the same confusion pairs appear on every
 * reload — a moving demo is impossible to design against.
 *
 * NOT a test fixture: `lib/__tests__` owns the correctness of the
 * aggregation functions with small explicit inputs. This is for looking at.
 */

/** Deterministic PRNG (mulberry32) — same seed, same class, every reload. */
function makeRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(rand: () => number, items: T[]): T => items[Math.floor(rand() * items.length)];
const between = (rand: () => number, min: number, max: number) => min + rand() * (max - min);
const intBetween = (rand: () => number, min: number, max: number) => Math.floor(between(rand, min, max + 1));

export const DEMO_EDUCATOR_UID = 'demo-educator';

/** The generated student whose history the demo's own signed-in account borrows — see repositoryDemo.ts. */
export const DEMO_ACCOUNT_PERSONA = 'demo-physio-y2-06';

export const DEMO_COHORTS: Cohort[] = [
  {
    id: 'demo-cohort-physio-y2',
    name: 'Y2 Physiotherapy 2026',
    institution: 'Riverside College',
    ownerUid: DEMO_EDUCATOR_UID,
    joinCode: 'HTQ4KP',
    createdAt: '2026-01-12T09:00:00.000Z',
    archivedAt: null,
  },
  {
    id: 'demo-cohort-sports-y1',
    name: 'Y1 Sports Therapy 2026',
    institution: 'Riverside College',
    ownerUid: DEMO_EDUCATOR_UID,
    joinCode: 'RM7BXW',
    createdAt: '2026-02-03T09:00:00.000Z',
    archivedAt: null,
  },
];

const FIRST_NAMES = [
  'Aisha', 'Tom', 'Priya', 'Callum', 'Grace', 'Ade', 'Niamh', 'Josh', 'Mei', 'Rhys',
  'Sofia', 'Daniel', 'Ellie', 'Omar', 'Katie', 'Ben', 'Zara', 'Lewis', 'Hannah', 'Finn',
  'Layla', 'Sam',
];
const LAST_NAMES = [
  'Bennett', 'Okafor', 'Sharma', 'Wright', 'Donnelly', 'Adeyemi', 'Kavanagh', 'Price', 'Chen', 'Morgan',
  'Rossi', 'Fletcher', 'Baxter', 'Haddad', 'Sullivan', 'Ward', 'Ahmed', 'Grant', 'Petersen', 'Doyle',
  'Karim', 'Ellis',
];

/** Roster sizes differ so the cohort switcher shows two visibly different classes. */
const COHORT_SIZES: Record<string, number> = {
  'demo-cohort-physio-y2': 14,
  'demo-cohort-sports-y1': 8,
};

const DAY_MS = 86_400_000;
/** Everything is generated relative to load time, so the activity charts always end "today" rather than trailing off at a hardcoded date. */
const NOW = Date.now();
const WINDOW_DAYS = 45;

interface DemoStudent extends CohortStudent {
  cohortId: string;
  /** Base probability this student answers correctly, before per-structure difficulty. */
  ability: number;
  /** Days since load this student was last active — drives the "dormant student" rows an educator is meant to spot. */
  lastActiveDaysAgo: number;
  attemptCount: number;
}

function buildStudents(cohort: Cohort, offset: number): DemoStudent[] {
  const rand = makeRandom(1000 + offset);
  const size = COHORT_SIZES[cohort.id] ?? 10;

  return Array.from({ length: size }, (_, i) => {
    const n = offset + i;
    const first = FIRST_NAMES[n % FIRST_NAMES.length];
    // The +3*wraps term matters: with both lists 22 long, a plain stride of 7 hands
    // student 0 and student 44 the same first AND last name, which reads as a bug.
    const last = LAST_NAMES[(n * 7 + 3 + Math.floor(n / LAST_NAMES.length) * 3) % LAST_NAMES.length];
    // One student per cohort has never opened a session, and a couple have gone quiet —
    // an educator's first real question is "who has stopped", so the demo has to contain some.
    const dormant = i === 0 ? WINDOW_DAYS : i < 3 ? intBetween(rand, 9, 21) : intBetween(rand, 0, 5);
    const attemptCount = i === 0 ? 0 : Math.round(between(rand, 45, 320) * (1 - dormant / (WINDOW_DAYS * 2)));

    return {
      uid: `demo-${cohort.id.slice(12)}-${String(i + 1).padStart(2, '0')}`,
      displayName: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@student.riverside.ac.uk`,
      joinedAt: new Date(Date.parse(cohort.createdAt) + intBetween(rand, 0, 9) * DAY_MS).toISOString(),
      lastActiveAt: attemptCount === 0 ? null : new Date(NOW - dormant * DAY_MS).toISOString(),
      cohortId: cohort.id,
      ability: between(rand, 0.62, 0.93),
      lastActiveDaysAgo: dormant,
      attemptCount,
    };
  });
}

const DEMO_STUDENTS: DemoStudent[] = DEMO_COHORTS.flatMap((cohort, i) => buildStudents(cohort, i * 40));

export function demoStudentsInCohort(cohortId: string): CohortStudent[] {
  return DEMO_STUDENTS.filter((s) => s.cohortId === cohortId).map(({ uid, displayName, email, joinedAt, lastActiveAt }) => ({
    uid,
    displayName,
    email,
    joinedAt,
    lastActiveAt,
  }));
}

/**
 * Only structures the app can actually build a question from — generating
 * attempts against ineligible structures would put rows in the weakness
 * table that no student could ever have seen.
 */
const QUIZZABLE: AnatomyStructure[] = ALL_STRUCTURES.filter((s) => s.imageIds.length > 0 || s.description.length > 0);

/**
 * Per-structure difficulty, stable across students so the cohort has genuine
 * shared weak spots (which is the entire point of the weakness table) rather
 * than noise that averages out to a flat 70% everywhere.
 */
const DIFFICULTY = new Map<string, number>(
  QUIZZABLE.map((s, i) => [s.id, makeRandom(9000 + i)() * 0.3]),
);

/** A stable "looks like this one" partner per structure — same region and category where possible, so the confusion pairs an educator sees are plausible ones. */
const CONFUSED_WITH = new Map<string, AnatomyStructure>();
for (const [i, s] of QUIZZABLE.entries()) {
  const siblings = QUIZZABLE.filter((o) => o.id !== s.id && o.region === s.region && o.category === s.category);
  const pool = siblings.length > 0 ? siblings : QUIZZABLE.filter((o) => o.id !== s.id);
  CONFUSED_WITH.set(s.id, pool[i % pool.length]);
}

const QUESTION_TYPES: QuestionType[] = ['mcq', 'mcq', 'mcq', 'flashcard', 'locate', 'fill-blank', 'identify-typed'];
const EMPTY_CATEGORY_BREAKDOWN = (): Record<Category, { total: number; correct: number }> => ({
  muscle: { total: 0, correct: 0 },
  bone: { total: 0, correct: 0 },
  landmark: { total: 0, correct: 0 },
  joint: { total: 0, correct: 0 },
});

interface GeneratedActivity {
  attempts: UserAttempt[];
  summaries: RevisionSessionSummary[];
}

function generateForStudent(student: DemoStudent, seed: number): GeneratedActivity {
  const attempts: UserAttempt[] = [];
  const summaries: RevisionSessionSummary[] = [];
  if (student.attemptCount === 0) return { attempts, summaries };

  const rand = makeRandom(seed);
  const exposure = new Map<string, number>();
  // Students revise the regions they're being taught, not the whole body at random.
  const focusRegions: Region[] = [pick(rand, QUIZZABLE).region, pick(rand, QUIZZABLE).region];
  const pool = QUIZZABLE.filter((s) => focusRegions.includes(s.region));
  const structures = pool.length > 20 ? pool : QUIZZABLE;

  let remaining = student.attemptCount;
  let sessionIndex = 0;

  while (remaining > 0) {
    const size = Math.min(remaining, intBetween(rand, 8, 22));
    remaining -= size;
    sessionIndex += 1;

    const daysAgo = student.lastActiveDaysAgo + Math.floor((sessionIndex - 1) * between(rand, 0.8, 3.4));
    if (daysAgo > WINDOW_DAYS) break;

    const startedAt = NOW - daysAgo * DAY_MS + intBetween(rand, 8, 21) * 3_600_000;
    const sessionId = `${student.uid}-s${sessionIndex}`;
    const questionTypes: QuestionType[] = [];
    const breakdownByCategory = EMPTY_CATEGORY_BREAKDOWN();
    const breakdownByRegion: RevisionSessionSummary['breakdownByRegion'] = {};
    const missed: string[] = [];
    let correctCount = 0;
    let cursor = startedAt;

    for (let q = 0; q < size; q++) {
      const structure = pick(rand, structures);
      const difficulty = DIFFICULTY.get(structure.id) ?? 0.3;
      // Later sessions are a bit better than early ones — a flat accuracy line over 45 days reads as fake.
      const improvement = Math.min(0.12, sessionIndex * 0.012);
      const correct = rand() < Math.min(0.97, student.ability + improvement - difficulty);
      const type = pick(rand, QUESTION_TYPES);
      const durationMs = Math.round(between(rand, 1800, 11_000) * (correct ? 1 : 1.4));
      cursor += durationMs + intBetween(rand, 1500, 14_000);

      const key = `${structure.id}`;
      const attemptNumber = (exposure.get(key) ?? 0) + 1;
      exposure.set(key, attemptNumber);

      if (!questionTypes.includes(type)) questionTypes.push(type);
      breakdownByCategory[structure.category].total += 1;
      const regionRow = breakdownByRegion[structure.region] ?? { total: 0, correct: 0 };
      regionRow.total += 1;
      if (correct) {
        correctCount += 1;
        breakdownByCategory[structure.category].correct += 1;
        regionRow.correct += 1;
      } else if (!missed.includes(structure.id)) {
        missed.push(structure.id);
      }
      breakdownByRegion[structure.region] = regionRow;

      attempts.push({
        id: `${sessionId}-${q}`,
        userId: student.uid,
        sessionId,
        questionId: `${structure.id}::${type}`,
        questionType: type,
        structureId: structure.id,
        promptKind: 'identify',
        region: structure.region,
        category: structure.category,
        correct,
        attemptNumber,
        timestamp: new Date(cursor).toISOString(),
        durationMs,
        // Only the typed/choice question types carry an answer string — locate and
        // flashcard don't, and inventing one would put fake rows in confusion pairs.
        ...(type === 'mcq' || type === 'fill-blank' || type === 'identify-typed'
          ? {
              correctAnswer: structure.name,
              selectedAnswer: correct ? structure.name : (CONFUSED_WITH.get(structure.id)?.name ?? structure.name),
            }
          : {}),
      });
    }

    summaries.push({
      id: sessionId,
      userId: student.uid,
      startedAt: new Date(startedAt).toISOString(),
      // A tenth of sessions are abandoned, so completion rate isn't a flat 100%.
      finishedAt: rand() < 0.9 ? new Date(cursor).toISOString() : undefined,
      questionTypes,
      regionFilter: focusRegions,
      totalQuestions: size,
      correctCount,
      breakdownByCategory,
      breakdownByRegion,
      missedStructureIds: missed,
    });
  }

  return { attempts, summaries };
}

let cache: Map<string, GeneratedActivity> | null = null;

function activity(): Map<string, GeneratedActivity> {
  if (cache) return cache;
  cache = new Map(DEMO_STUDENTS.map((s, i) => [s.uid, generateForStudent(s, 5000 + i * 17)]));
  return cache;
}

export function demoAttempts(uid: string): UserAttempt[] {
  return activity().get(uid)?.attempts ?? [];
}

export function demoSessionSummaries(uid: string): RevisionSessionSummary[] {
  return activity().get(uid)?.summaries ?? [];
}

/** Mutable in demo mode: creating an assignment from the UI should appear in the list, then vanish on reload. */
export const DEMO_ASSIGNMENTS: Assignment[] = [
  {
    id: 'demo-assignment-1',
    cohortId: 'demo-cohort-physio-y2',
    region: 'shoulder-arm',
    title: 'Rotator cuff + shoulder girdle — before the Thursday practical',
    dueAt: new Date(NOW + 4 * DAY_MS).toISOString(),
    createdAt: new Date(NOW - 6 * DAY_MS).toISOString(),
    createdBy: DEMO_EDUCATOR_UID,
  },
  {
    id: 'demo-assignment-2',
    cohortId: 'demo-cohort-physio-y2',
    region: 'hip-thigh',
    title: 'Hip flexors and adductors',
    dueAt: new Date(NOW - 2 * DAY_MS).toISOString(),
    createdAt: new Date(NOW - 16 * DAY_MS).toISOString(),
    createdBy: DEMO_EDUCATOR_UID,
  },
  {
    id: 'demo-assignment-3',
    cohortId: 'demo-cohort-sports-y1',
    region: 'lower-leg-foot',
    title: 'Ankle and foot — week 3 recap',
    dueAt: new Date(NOW + 9 * DAY_MS).toISOString(),
    createdAt: new Date(NOW - 3 * DAY_MS).toISOString(),
    createdBy: DEMO_EDUCATOR_UID,
  },
];
