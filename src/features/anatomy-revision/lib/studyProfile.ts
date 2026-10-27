import type { FactMastery, StructureMastery } from '../types/attempt';
import type { QuestionType } from '../types/question';
import { AREAS, type Area } from '../types/region';
import { areasOf, CATEGORIES, type Category } from '../types/structure';
import type { StructureIndexEntry } from '../types/structureIndex';
import { structureLevel } from './masteryLevel';

/**
 * WHERE A STUDENT SAYS THEY ARE STARTING FROM, and the weekly focus they have
 * chosen (owner, 19 Oct 2026).
 *
 * The questionnaire is optional and short: how long they have studied
 * anatomy, at what level, how sure they feel about each area and each kind of
 * structure, how long a day they have, which formats they like, and when
 * their exam is. It steers only what the app does NOT yet know — which NEW
 * structures come first, which formats a session leans on, how long it is.
 * Everything with a graded answer is scheduled by its answers, exactly as
 * before, so the questionnaire fades out by itself as real data arrives.
 *
 * It lives on the account (users/{uid}.studyProfile), cached on the device
 * so a session never waits on a read — see hooks/useStudyProfile.ts.
 *
 * Every rule here is pure, so the screens and the tests share one answer.
 */

export type Confidence = 'confident' | 'unsure' | 'new';

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  confident: 'Confident',
  unsure: 'Unsure',
  new: 'New to me',
};

export type StudyLength = 'starting' | 'lt6m' | '6to12m' | '1to2y' | '2yplus';

export const STUDY_LENGTH_LABELS: Record<StudyLength, string> = {
  starting: 'Just starting',
  lt6m: 'Under 6 months',
  '6to12m': '6 to 12 months',
  '1to2y': '1 to 2 years',
  '2yplus': 'More than 2 years',
};

export type StudyLevel = 'school' | 'ug-year1' | 'ug-later' | 'postgrad' | 'qualified' | 'other';

export const STUDY_LEVEL_LABELS: Record<StudyLevel, string> = {
  school: 'School or college',
  'ug-year1': 'First year of a degree',
  'ug-later': 'Later years of a degree',
  postgrad: 'Postgraduate',
  qualified: 'Qualified, keeping up',
  other: 'Something else',
};

export type Course =
  | 'sports-rehab'
  | 'physio'
  | 'sports-therapy'
  | 'sport-science'
  | 'osteo-chiro'
  | 'medicine'
  | 'other';

export const COURSE_LABELS: Record<Course, string> = {
  'sports-rehab': 'Sports rehabilitation',
  physio: 'Physiotherapy',
  'sports-therapy': 'Sports therapy',
  'sport-science': 'Sport & exercise science',
  'osteo-chiro': 'Osteopathy or chiropractic',
  medicine: 'Medicine',
  other: 'Something else',
};

export const MINUTES_OPTIONS = [5, 10, 20, 30] as const;
export type MinutesPerDay = (typeof MINUTES_OPTIONS)[number];

/** The formats a student can say they like, in the words they would use. */
export type PreferredFormat = 'locate' | 'mcq' | 'typed' | 'flashcard';

export const PREFERRED_FORMAT_LABELS: Record<PreferredFormat, string> = {
  locate: 'Finding it on a picture',
  mcq: 'Multiple choice',
  typed: 'Typing the name from memory',
  flashcard: 'Flashcards',
};

const FORMAT_TYPES: Record<PreferredFormat, QuestionType[]> = {
  locate: ['locate'],
  mcq: ['mcq'],
  typed: ['identify-typed', 'fill-blank'],
  flashcard: ['flashcard'],
};

/** This week's focus. `area` for a subscriber; `category` alone is the free tier's focus, inside its one area. */
export interface WeeklyFocus {
  area?: Area;
  category?: Category;
  /** The Monday the focus was chosen for, as a local YYYY-MM-DD. */
  weekStart: string;
}

export interface StudyProfile {
  version: 1;
  /** ms since epoch. The newer of the device's copy and the account's wins. */
  updatedAt: number;
  /** Answered "Skip": nothing below was asked, and the app behaves as it always has. */
  skipped?: boolean;
  studyLength?: StudyLength;
  level?: StudyLevel;
  course?: Course;
  areaConfidence: Partial<Record<Area, Confidence>>;
  typeConfidence: Partial<Record<Category, Confidence>>;
  minutesPerDay?: MinutesPerDay;
  preferredFormats: PreferredFormat[];
  /** Local YYYY-MM-DD. */
  examDate?: string;
  weeklyFocus?: WeeklyFocus;
  /**
   * Whether a never-seen structure is shown before it is asked ('show': the
   * flashcard rung) or asked straight away on multiple choice ('ask'). Unset:
   * decided from the answers above (skipsFlashcard). Account's "Learn first
   * or test first".
   */
  newStructures?: NewStructureStart;
  /** Structure ids starred from a card: the student's own list, a filter in the Atlas. */
  starred?: string[];
  /** Local "HH:MM" for the app's "reviews are due" notification. Unset: REMINDER_HOUR. Installed app only. */
  reminderTime?: string;
  /** A daily goal of the student's own (Account → Daily goal → Custom). Moves the ring only, not the review's length. */
  dailyGoal?: number;
}

/** The custom goal's bounds: one question a day up to a long day's work. */
export const DAILY_GOAL_MIN = 1;
export const DAILY_GOAL_MAX = 300;

export type NewStructureStart = 'show' | 'ask';

/** Enough for every structure in the app twice over; a cap so a broken client cannot grow the profile forever. */
export const STARRED_LIMIT = 1000;
const STRUCTURE_ID = /^[a-z0-9][a-z0-9-]{0,120}$/;

export function emptyStudyProfile(now: number = Date.now()): StudyProfile {
  return { version: 1, updatedAt: now, areaConfidence: {}, typeConfidence: {}, preferredFormats: [] };
}

const CONFIDENCES: readonly Confidence[] = ['confident', 'unsure', 'new'];
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

function confidenceMap<K extends string>(raw: unknown, keys: readonly K[]): Partial<Record<K, Confidence>> {
  const out: Partial<Record<K, Confidence>> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const key of keys) {
    const value = oneOf((raw as Record<string, unknown>)[key], CONFIDENCES);
    if (value) out[key] = value;
  }
  return out;
}

/**
 * A profile read from storage or from Firestore, kept only where it is
 * readable. Anything hand-edited, stale or from a later version of the app
 * drops the field rather than the whole profile — a student should not lose
 * their answers to one bad value. Null when there is no profile at all.
 */
export function asStudyProfile(raw: unknown): StudyProfile | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const updatedAt = typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? r.updatedAt : 0;
  const focusRaw = r.weeklyFocus as Record<string, unknown> | undefined;
  const focusArea = oneOf(focusRaw?.area, AREAS);
  const focusCategory = oneOf(focusRaw?.category, CATEGORIES);
  const focusWeek = typeof focusRaw?.weekStart === 'string' && ISO_DAY.test(focusRaw.weekStart) ? focusRaw.weekStart : undefined;
  const minutes = typeof r.minutesPerDay === 'number' && (MINUTES_OPTIONS as readonly number[]).includes(r.minutesPerDay)
    ? (r.minutesPerDay as MinutesPerDay)
    : undefined;
  const formats = Array.isArray(r.preferredFormats)
    ? r.preferredFormats.filter((f): f is PreferredFormat => !!oneOf(f, Object.keys(PREFERRED_FORMAT_LABELS) as PreferredFormat[]))
    : [];
  return {
    version: 1,
    updatedAt,
    ...(r.skipped === true ? { skipped: true } : {}),
    ...withDefined('studyLength', oneOf(r.studyLength, Object.keys(STUDY_LENGTH_LABELS) as StudyLength[])),
    ...withDefined('level', oneOf(r.level, Object.keys(STUDY_LEVEL_LABELS) as StudyLevel[])),
    ...withDefined('course', oneOf(r.course, Object.keys(COURSE_LABELS) as Course[])),
    areaConfidence: confidenceMap(r.areaConfidence, AREAS),
    typeConfidence: confidenceMap(r.typeConfidence, CATEGORIES),
    ...withDefined('minutesPerDay', minutes),
    preferredFormats: [...new Set(formats)],
    ...withDefined('examDate', typeof r.examDate === 'string' && ISO_DAY.test(r.examDate) ? r.examDate : undefined),
    ...withDefined('newStructures', oneOf(r.newStructures, ['show', 'ask'] as const)),
    ...withDefined(
      'dailyGoal',
      typeof r.dailyGoal === 'number' && Number.isInteger(r.dailyGoal) && r.dailyGoal >= DAILY_GOAL_MIN && r.dailyGoal <= DAILY_GOAL_MAX
        ? r.dailyGoal
        : undefined,
    ),
    ...withDefined('reminderTime', typeof r.reminderTime === 'string' && parseReminderTime(r.reminderTime) ? r.reminderTime : undefined),
    ...(Array.isArray(r.starred)
      ? { starred: [...new Set(r.starred.filter((id): id is string => typeof id === 'string' && STRUCTURE_ID.test(id)))].slice(0, STARRED_LIMIT) }
      : {}),
    ...((focusArea || focusCategory) && focusWeek
      ? { weeklyFocus: { ...withDefined('area', focusArea), ...withDefined('category', focusCategory), weekStart: focusWeek } }
      : {}),
  };
}

/** Firestore refuses `undefined`, so an unanswered question is left out rather than written as one. */
function withDefined<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

/** The copy to keep when the device and the account disagree: the one changed last. */
export function newerProfile(a: StudyProfile | null, b: StudyProfile | null): StudyProfile | null {
  if (!a) return b;
  if (!b) return a;
  return b.updatedAt > a.updatedAt ? b : a;
}

/** Whether the questionnaire has been answered — not skipped, not empty. */
export function hasAnswers(profile: StudyProfile | null): profile is StudyProfile {
  return !!profile && !profile.skipped && (
    !!profile.studyLength ||
    !!profile.level ||
    Object.keys(profile.areaConfidence).length > 0 ||
    Object.keys(profile.typeConfidence).length > 0 ||
    !!profile.minutesPerDay ||
    profile.preferredFormats.length > 0 ||
    !!profile.examDate
  );
}

// ---------------------------------------------------------------------------
// How the answers steer a session
// ---------------------------------------------------------------------------

/**
 * How much more often a NEW structure is drawn, by how the student rated its
 * area or its kind. "Unsure" is where the questionnaire earns its keep — the
 * student knows a little and has said so — so it gets the most. "New to me"
 * comes next rather than first: material that is wholly new is better met a
 * few at a time than as a flood. "Confident" is not skipped, only slowed: the
 * first answers are what prove the confidence right.
 */
export const CONFIDENCE_WEIGHT: Record<Confidence, number> = {
  unsure: 2,
  new: 1.5,
  confident: 0.5,
};

/**
 * The multiplier on a never-answered structure's chance of being drawn. Its
 * area's rating and its kind's rating multiply; a structure in several areas
 * takes the strongest area rating. 1 for a structure the questionnaire says
 * nothing about, and for every structure when it was skipped.
 */
export function newStructureBias(
  profile: StudyProfile | null,
  structure: Pick<StructureIndexEntry, 'areas' | 'subregion' | 'category'>,
): number {
  if (!hasAnswers(profile)) return 1;
  const areaWeights = areasOf(structure)
    .map((a) => profile.areaConfidence[a])
    .filter((c): c is Confidence => !!c)
    .map((c) => CONFIDENCE_WEIGHT[c]);
  const area = areaWeights.length ? Math.max(...areaWeights) : 1;
  const kind = profile.typeConfidence[structure.category];
  return area * (kind ? CONFIDENCE_WEIGHT[kind] : 1);
}

/**
 * Whether a structure the student has never answered opens on multiple
 * choice instead of a flashcard.
 *
 * Only the flashcard rung is skipped, never one above it. The flashcard is
 * "shown, not asked" — the rung for something never seen — and a student a
 * year into anatomy, or confident with that kind of structure, has seen it.
 * Typed recall is still earned at the rung by answering multiple choice
 * (lib/ladder.ts: every rung is earned, at the rung; owner's rule).
 */
export function skipsFlashcard(
  profile: StudyProfile | null,
  structure: Pick<StructureIndexEntry, 'category'>,
): boolean {
  // The student's own choice in Account wins over anything inferred, and
  // applies whether or not they answered the questions.
  if (profile?.newStructures) return profile.newStructures === 'ask';
  if (!hasAnswers(profile)) return false;
  if (profile.typeConfidence[structure.category] === 'confident') return true;
  if (profile.typeConfidence[structure.category] === 'new') return false;
  return profile.studyLength === '1to2y' || profile.studyLength === '2yplus';
}

/**
 * The daily goal on Today's ring, in questions (owner, 19 Oct 2026). One
 * daily review's worth: the same figure the session length comes from, so the
 * goal is met by doing what Today offers, not by a number set somewhere else.
 */
export function dailyGoalFor(profile: StudyProfile | null): number {
  // A goal the student typed in is theirs whatever else was answered or skipped.
  return profile?.dailyGoal ?? sessionCountFor(profile);
}

/** The minutes answer behind each goal, for Account's "Daily goal" row. */
export const GOAL_FOR_MINUTES: Record<MinutesPerDay, number> = { 5: 10, 10: 20, 20: 30, 30: 40 };

/** "18:30" → { hour: 18, minute: 30 }, or null for anything that is not a time of day. */
export function parseReminderTime(value: string): { hour: number; minute: number } | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return m ? { hour: Number(m[1]), minute: Number(m[2]) } : null;
}

/** The daily review's length for the minutes a student said they have. Twenty — the old fixed length — without an answer. */
export function sessionCountFor(profile: StudyProfile | null): number {
  switch (hasAnswers(profile) ? profile.minutesPerDay : undefined) {
    case 5:
      return 10;
    case 10:
      return 20;
    case 20:
      return 30;
    case 30:
      return 40;
    default:
      return 20;
  }
}

/** Days before the exam kept for review alone: everything should have been met a week before it. */
export const EXAM_REVIEW_DAYS = 7;
/** The most of a session given to new material, however close the exam: a review that is all new is not a review. */
export const EXAM_MAX_NEW_SHARE = 0.7;

/**
 * The share of a review given to new structures, paced to an exam date
 * (owner, 19 Oct 2026: "exam countdown plan").
 *
 * With `unseen` structures still to meet and the days left before the
 * review week, a daily session of `count` questions needs `unseen / days`
 * of them new; that, as a share of the session, is the floor. It only ever
 * RAISES the share: an exam months away, or a student well ahead, keeps
 * `base` (the generator's own default when undefined). Past the review week,
 * or past the exam, nothing changes either — new material in the last week
 * is what the review week exists to avoid.
 */
export function newShareFor(
  profile: StudyProfile | null,
  now: Date,
  base?: number,
  pace?: { unseen: number; count: number },
): number | undefined {
  const exam = hasAnswers(profile) && profile.examDate ? localDate(profile.examDate) : null;
  if (!exam || !pace || pace.unseen <= 0 || pace.count <= 0) return base;
  const daysLeft = Math.round((exam.getTime() - startOfDay(now).getTime()) / 86_400_000) - EXAM_REVIEW_DAYS;
  if (daysLeft <= 0) return base;
  const needed = pace.unseen / daysLeft / pace.count;
  const floor = base ?? 0.25;
  return needed > floor ? Math.min(EXAM_MAX_NEW_SHARE, needed) : base;
}

/** Days of new material left before the exam's review week, or null without an exam ahead. For the screens' wording. */
export function examPaceDays(profile: StudyProfile | null, now: Date): number | null {
  const exam = hasAnswers(profile) && profile.examDate ? localDate(profile.examDate) : null;
  if (!exam) return null;
  const days = Math.round((exam.getTime() - startOfDay(now).getTime()) / 86_400_000) - EXAM_REVIEW_DAYS;
  return days > 0 ? days : null;
}

/**
 * Extra weight per question type for the formats a student said they like —
 * one and a half times as many of them, and never NONE of the others. Matching
 * teaching to a stated "learning style" has not been shown to help (Pashler et
 * al., 2008), whereas recalling a name and finding it on a picture both do;
 * so a preference leans the mix, it does not choose it.
 */
export const PREFERRED_FORMAT_WEIGHT = 1.5;

export function typeWeightsFor(profile: StudyProfile | null): Partial<Record<QuestionType, number>> | undefined {
  if (!hasAnswers(profile) || profile.preferredFormats.length === 0) return undefined;
  const out: Partial<Record<QuestionType, number>> = {};
  for (const format of profile.preferredFormats) {
    for (const type of FORMAT_TYPES[format]) out[type] = PREFERRED_FORMAT_WEIGHT;
  }
  return out;
}

/**
 * The first session's areas, least confident first: "new to me", then
 * "unsure", then unrated, then "confident". Stable within a rating, so the
 * order the student chose them in still breaks ties.
 */
export function starterAreaOrder(profile: StudyProfile | null, areas: readonly Area[]): Area[] {
  if (!hasAnswers(profile)) return [...areas];
  const rank = (a: Area) => {
    const c = profile.areaConfidence[a];
    return c === 'new' ? 0 : c === 'unsure' ? 1 : c === 'confident' ? 3 : 2;
  };
  return [...areas].sort((a, b) => rank(a) - rank(b));
}

/**
 * The kinds of structure a first session may ask about. Muscles — what the
 * starter has always asked — plus every kind the student did not call new,
 * so someone sure of their bones and unsure of their ligaments starts with
 * those rather than with muscles alone. A kind called "new to me" waits for
 * the ordinary review, where it can be met a few at a time.
 */
export function starterCategories(profile: StudyProfile | null): Category[] {
  if (!hasAnswers(profile) || Object.keys(profile.typeConfidence).length === 0) return ['muscle'];
  const rated = CATEGORIES.filter((c) => profile.typeConfidence[c] && profile.typeConfidence[c] !== 'new');
  return rated.length ? rated : ['muscle'];
}

// ---------------------------------------------------------------------------
// The weekly focus
// ---------------------------------------------------------------------------

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function localDate(iso: string): Date | null {
  if (!ISO_DAY.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * The Monday of the week `now` falls in, as a local YYYY-MM-DD. Built from
 * calendar fields, not by subtracting milliseconds, so a week that crosses a
 * clock change still starts on the right day.
 */
export function weekStartOf(now: Date): string {
  const day = startOfDay(now);
  const sinceMonday = (day.getDay() + 6) % 7;
  return isoDay(new Date(day.getFullYear(), day.getMonth(), day.getDate() - sinceMonday));
}

/**
 * This week's focus, or null when none has been chosen for THIS week — a
 * focus from last week is a prompt to choose again, not a standing order.
 * A focus on an area this account can no longer reach is no focus at all.
 */
export function currentFocus(profile: StudyProfile | null, now: Date, reachable: readonly Area[]): WeeklyFocus | null {
  const focus = profile?.weeklyFocus;
  if (!focus || focus.weekStart !== weekStartOf(now)) return null;
  if (focus.area && !reachable.includes(focus.area)) return null;
  return focus;
}

/** Last week's focus, for the one line that says how it went. */
export function previousFocus(profile: StudyProfile | null, now: Date): WeeklyFocus | null {
  const focus = profile?.weeklyFocus;
  return focus && focus.weekStart < weekStartOf(now) ? focus : null;
}

export interface FocusStanding {
  total: number;
  /** Structures with at least one graded answer. */
  seen: number;
  /** Seen and at Intermediate or above (lib/masteryLevel.ts). */
  secure: number;
}

/** How far a student is through one area, or one kind of structure in it. */
export function focusStanding(
  index: readonly StructureIndexEntry[],
  masteryById: ReadonlyMap<string, StructureMastery>,
  factsByKey: ReadonlyMap<string, FactMastery>,
  scope: { area?: Area; category?: Category; areas?: readonly Area[] },
  now: Date,
): FocusStanding {
  const inScope = index.filter((s) => {
    const areas = areasOf(s);
    if (scope.area && !areas.includes(scope.area)) return false;
    if (!scope.area && scope.areas && !areas.some((a) => scope.areas!.includes(a))) return false;
    return !scope.category || s.category === scope.category;
  });
  let seen = 0;
  let secure = 0;
  for (const s of inScope) {
    const state = structureLevel(s, masteryById.get(s.id), factsByKey, now);
    if (!state.seen) continue;
    seen += 1;
    if (state.level === 'intermediate' || state.level === 'advanced' || state.level === 'master') secure += 1;
  }
  return { total: inScope.length, seen, secure };
}

/**
 * The area to suggest for this week: the one with the smallest share of its
 * structures secure, nudged towards what the student rated unsure or new and
 * away from what they rated confident. The student confirms or picks
 * another — this only decides which chip is lit first.
 */
export function suggestFocusArea(
  reachable: readonly Area[],
  standingOf: (area: Area) => FocusStanding,
  profile: StudyProfile | null,
  /** Not suggested two weeks running when there is anything else to suggest. */
  lastWeek?: Area,
): Area | null {
  const candidates = reachable.length > 1 && lastWeek ? reachable.filter((a) => a !== lastWeek) : [...reachable];
  let best: { area: Area; score: number } | null = null;
  for (const area of candidates) {
    const s = standingOf(area);
    if (s.total === 0) continue;
    const secureShare = s.secure / s.total;
    const rating = profile?.areaConfidence[area];
    const nudge = rating === 'unsure' ? -0.15 : rating === 'new' ? -0.1 : rating === 'confident' ? 0.15 : 0;
    const score = secureShare + nudge;
    if (!best || score < best.score) best = { area, score };
  }
  return best?.area ?? null;
}

/**
 * A free account's suggestion: the kind of structure in its one area with the
 * least secure, rated the same way. Kinds the area has none of are skipped.
 */
export function suggestFocusCategory(
  standingOf: (category: Category) => FocusStanding,
  profile: StudyProfile | null,
  lastWeek?: Category,
): Category | null {
  let best: { category: Category; score: number } | null = null;
  for (const category of CATEGORIES) {
    if (category === lastWeek) continue;
    const s = standingOf(category);
    if (s.total === 0) continue;
    const rating = profile?.typeConfidence[category];
    const nudge = rating === 'unsure' ? -0.15 : rating === 'new' ? -0.1 : rating === 'confident' ? 0.15 : 0;
    const score = s.secure / s.total + nudge;
    if (!best || score < best.score) best = { category, score };
  }
  return best?.category ?? null;
}

/**
 * The focus session's share of new structures. Higher than the daily
 * review's, because a focus week is where an area is LEARNT — the general
 * review keeps the rest of the body ticking over.
 */
export const FOCUS_NEW_SHARE = 0.4;

// ---------------------------------------------------------------------------
// The starred list
// ---------------------------------------------------------------------------

export function isStarred(profile: StudyProfile | null, structureId: string): boolean {
  return !!profile?.starred?.includes(structureId);
}

/** The profile with one structure starred or unstarred; newest first, so the list reads as recently starred. */
export function toggleStar(profile: StudyProfile, structureId: string): Omit<StudyProfile, 'updatedAt'> {
  const current = profile.starred ?? [];
  const starred = current.includes(structureId)
    ? current.filter((id) => id !== structureId)
    : [structureId, ...current].slice(0, STARRED_LIMIT);
  return { ...profile, starred };
}
