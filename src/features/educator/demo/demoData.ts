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

/**
 * Roster sizes differ so the cohort switcher shows two visibly different
 * classes, and both sit in the 40-120 band a real UK MSK cohort occupies.
 * This is a sales asset before it is a review tool: a course leader looking
 * at a class of 8 is looking at somebody else's problem.
 */
const COHORT_SIZES: Record<string, number> = {
  'demo-cohort-physio-y2': 58,
  'demo-cohort-sports-y1': 41,
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
  // Proportional rather than the fixed 1-and-2 this used at a roster of 14:
  // in a class of 58 a single dormant student reads as a rounding error, and
  // "who has stopped" is the first question an educator asks the dashboard.
  const neverStarted = Math.max(1, Math.round(size * 0.05));
  const quietUntil = neverStarted + Math.max(2, Math.round(size * 0.12));

  return Array.from({ length: size }, (_, i) => {
    const n = offset + i;
    const first = FIRST_NAMES[n % FIRST_NAMES.length];
    // The +3*wraps term matters: with both lists 22 long, a plain stride of 7 hands
    // student 0 and student 44 the same first AND last name, which reads as a bug.
    const last = LAST_NAMES[(n * 7 + 3 + Math.floor(n / LAST_NAMES.length) * 3) % LAST_NAMES.length];
    // Some students have never opened a session and more have gone quiet —
    // an educator's first real question is "who has stopped", so the demo has to contain some.
    const dormant =
      i < neverStarted ? WINDOW_DAYS : i < quietUntil ? intBetween(rand, 9, 21) : intBetween(rand, 0, 5);
    const attemptCount =
      i < neverStarted ? 0 : Math.round(between(rand, 45, 320) * (1 - dormant / (WINDOW_DAYS * 2)));

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

/**
 * Offsets accumulate rather than striding by a fixed 40. A stride shorter
 * than a cohort walks into the next cohort's slice of the name pools: at the
 * roster sizes above, `i * 40` handed 18 students in one class the same names
 * as 18 in the other. Passing the running total cannot overlap by
 * construction, whatever the sizes become.
 */
const DEMO_STUDENTS: DemoStudent[] = (() => {
  const all: DemoStudent[] = [];
  for (const cohort of DEMO_COHORTS) all.push(...buildStudents(cohort, all.length));
  return all;
})();

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
 * The mix-ups an MSK educator actually meets in marking. A dashboard whose
 * top confusion row is a pair nobody confuses is read as generated, and the
 * demo exists to be believed — so these are named rather than left to the
 * same-region fallback below, which produces plausible pairs but not
 * recognisable ones.
 *
 * Applied in both directions, and deliberately also weighted harder in
 * DIFFICULTY: a pair only reaches the confusion table by being missed, so
 * listing one without making it hard leaves it invisible.
 */
const NOTORIOUS_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['supraspinatus', 'infraspinatus'],
  ['subscapularis', 'supraspinatus'],
  ['teres-minor', 'teres-major'],
  ['teres-major', 'latissimus-dorsi'],
  ['semitendinosus', 'semimembranosus'],
  ['biceps-femoris', 'semitendinosus'],
  ['vastus-lateralis', 'vastus-medialis'],
  ['vastus-intermedius', 'rectus-femoris'],
  ['extensor-carpi-radialis-longus', 'extensor-carpi-radialis-brevis'],
  ['extensor-carpi-ulnaris', 'flexor-carpi-ulnaris'],
  ['flexor-carpi-radialis', 'flexor-carpi-ulnaris'],
  ['peroneus-longus', 'peroneus-brevis'],
  ['tibialis-anterior', 'tibialis-posterior'],
  ['gluteus-medius', 'gluteus-minimus'],
  ['rhomboid-major', 'rhomboid-minor'],
  ['pronator-teres', 'pronator-quadratus'],

  // Carpals — the ones that cost marks every year.
  ['scaphoid', 'lunate'],
  ['trapezium', 'trapezoid'],
  ['capitate', 'hamate'],
  ['triquetrum', 'pisiform'],

  // Humerus and forearm.
  ['greater-tubercle-humerus', 'lesser-tubercle-humerus'],
  ['medial-epicondyle-humerus', 'lateral-epicondyle-humerus'],
  ['anatomical-neck-humerus', 'surgical-neck-humerus'],
  ['radial-styloid-process', 'ulnar-styloid-process'],
  ['olecranon', 'coronoid-process-ulna'],

  // Scapula.
  ['acromion', 'coracoid-process'],
  ['supraspinous-fossa', 'infraspinous-fossa'],
  ['superior-angle-scapula', 'inferior-angle-scapula'],

  // Pelvis, hip and knee.
  ['asis', 'aiis'],
  ['asis', 'psis'],
  ['ilium', 'ischium'],
  ['greater-trochanter', 'lesser-trochanter'],
  ['medial-condyle-femur', 'lateral-condyle-femur'],
  ['medial-epicondyle-femur', 'lateral-epicondyle-femur'],
  ['medial-condyle-tibia', 'lateral-condyle-tibia'],
  ['tibial-tuberosity', 'tibial-crest'],

  // Ankle and foot.
  ['medial-malleolus', 'lateral-malleolus'],
  ['talus', 'calcaneus'],
  ['navicular', 'cuboid'],
  ['medial-cuneiform', 'intermediate-cuneiform'],

  // Spine and thorax.
  ['atlas-c1', 'axis-c2'],
  ['pedicle', 'lamina'],
  ['spinous-process', 'transverse-process'],
  ['superior-articular-process', 'inferior-articular-process'],
  ['sacrum', 'coccyx'],
  ['manubrium', 'xiphoid-process'],
  ['sternal-angle', 'jugular-notch'],
];

const NOTORIOUS_IDS = new Set(NOTORIOUS_PAIRS.flat());

/**
 * Per-structure difficulty, stable across students so the cohort has genuine
 * shared weak spots (which is the entire point of the weakness table) rather
 * than noise that averages out to a flat 70% everywhere.
 *
 * Structures in NOTORIOUS_PAIRS sit above the ordinary 0-0.3 band so they
 * reliably reach the weakness and confusion tables instead of depending on
 * where the seeded draw happened to put them.
 */
const DIFFICULTY = new Map<string, number>(
  QUIZZABLE.map((s, i) => {
    const draw = makeRandom(9000 + i)();
    return [s.id, NOTORIOUS_IDS.has(s.id) ? 0.3 + draw * 0.1 : draw * 0.3];
  }),
);

/** A stable "looks like this one" partner per structure — the named pairs above first, then same region and category where possible, so every confusion pair an educator sees is at least plausible. */
const CONFUSED_WITH = new Map<string, AnatomyStructure>();
const QUIZZABLE_BY_ID = new Map(QUIZZABLE.map((s) => [s.id, s]));
for (const [a, b] of NOTORIOUS_PAIRS) {
  const left = QUIZZABLE_BY_ID.get(a);
  const right = QUIZZABLE_BY_ID.get(b);
  // Skipped rather than thrown: this is a curated list pointing at a seed that
  // changes, and a renamed muscle should cost one good pair, not the demo.
  if (!left || !right) continue;
  if (!CONFUSED_WITH.has(a)) CONFUSED_WITH.set(a, right);
  if (!CONFUSED_WITH.has(b)) CONFUSED_WITH.set(b, left);
}
/**
 * Everything the curated list does not name pairs with its NEIGHBOUR in the
 * same region and category, not an arbitrary member of it. The seed files are
 * written in anatomical order, so the structure next to this one is usually a
 * genuine near-miss (sacrum/coccyx, one cuneiform for the next), where
 * indexing into the pool produced "Sacrum -> Atlas (C1)" — a pair no educator
 * has ever had to mark, on the table the whole demo is meant to sell.
 */
const BY_REGION_AND_CATEGORY = new Map<string, AnatomyStructure[]>();
for (const s of QUIZZABLE) {
  const key = `${s.region}::${s.category}`;
  const group = BY_REGION_AND_CATEGORY.get(key);
  if (group) group.push(s);
  else BY_REGION_AND_CATEGORY.set(key, [s]);
}
for (const group of BY_REGION_AND_CATEGORY.values()) {
  for (const [i, s] of group.entries()) {
    if (CONFUSED_WITH.has(s.id)) continue;
    const partner = group.length > 1 ? group[(i + 1) % group.length] : QUIZZABLE.find((o) => o.id !== s.id);
    if (partner) CONFUSED_WITH.set(s.id, partner);
  }
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
