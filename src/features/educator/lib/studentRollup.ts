import type { RevisionSessionSummary, StructureMastery, UserAttempt } from '../../anatomy-revision/types/attempt';
import { skillOf } from '../../anatomy-revision/lib/factMastery';
import { ALL_STRUCTURES } from '../../anatomy-revision/data/seed';

const STRUCTURES_BY_ID = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
import type { FactMastery } from '../../anatomy-revision/types/attempt';
import type { Region } from '../../anatomy-revision/types/region';
import { REGIONS } from '../../anatomy-revision/types/region';
import { MASTERY_LEVELS, factsIndex, masteryLevel, structureLevel, type MasteryLevel } from '../../anatomy-revision/lib/masteryLevel';
import { markSeen, rungOfQuestion } from '../../anatomy-revision/lib/ladder';
import { updateMasteryAfterAttempt } from '../../anatomy-revision/lib/mastery';
import { toDayKey } from '../../anatomy-revision/lib/streak';

/**
 * The part of a student's cohort summary that is REBUILT, not counted.
 *
 * The attempt counters in studentStats are increments, written per answer.
 * What lives here cannot be: a mastery level goes down as well as up, and a
 * best assignment score is a maximum. So the student's device rebuilds the
 * whole block from its own mastery rows and session summaries — after each
 * session and once when the app opens — and writes it over the old one. It
 * is idempotent, so a missed write heals on the next, and the first write for
 * a long-standing student backfills their whole history.
 *
 * WHY IT EXISTS. The dashboard's session figures (count, completion, length),
 * a student's streak and every assignment's completion used to come from
 * reading each student's session summaries directly. The rules stopped
 * educators reading those on 18 Sep (cf5a934) because a summary carries the
 * structures missed and the exact start and finish times — the two things the
 * privacy policy promises an educator never sees. This block is what they get
 * instead: totals, day keys and scores, never a timestamp finer than a day
 * and never a missed structure.
 *
 * WHAT AN EDUCATOR SEES from it, which the privacy policy and the join notice
 * state: each structure's mastery level for this student, their session
 * totals, which days they studied, and their assignment scores.
 *
 * ONLY SINCE JOINING. The DPIA promises the educator nothing from before the
 * student joined their class. `since` is the join time: sessions that started
 * earlier are left out, and a level is only reported for a structure answered
 * since — a structure last touched before joining is not part of what the
 * student has done in this class.
 */
export interface StudentRollup {
  /** Mastery level per structure the student has met. Unmet structures are absent. */
  levels: Record<string, MasteryLevel>;
  sessions: {
    total: number;
    finished: number;
    /** Summed length of finished sessions, for a mean across the class. */
    finishedMinutes: number;
  };
  /** Local day keys a session started on, oldest first — the streak. */
  sessionDays: string[];
  /** Scoped assignments: every finished attempt stamped with the assignment id. */
  assignments: Record<string, { taken: number; questions: number; correct: number; bestPct: number | null }>;
  /**
   * Graded totals per local day per region, for first-generation region
   * assignments, which count work in a region since the day they were set.
   */
  regionDays: Record<string, Partial<Record<Region, { total: number; correct: number }>>>;
}

export function emptyStudentRollup(): StudentRollup {
  return { levels: {}, sessions: { total: 0, finished: 0, finishedMinutes: 0 }, sessionDays: [], assignments: {}, regionDays: {} };
}

/** Same rule as assignmentCompletion.sessionScorePct: unanswered questions count as wrong. */
function scorePct(summary: RevisionSessionSummary): number | null {
  return summary.totalQuestions > 0 ? Math.round((summary.correctCount / summary.totalQuestions) * 100) : null;
}

export function buildStudentRollup(
  mastery: readonly StructureMastery[],
  allSummaries: readonly RevisionSessionSummary[],
  now: Date = new Date(),
  since?: string,
  facts: readonly FactMastery[] = [],
): StudentRollup {
  const rollup = emptyStudentRollup();
  // A structure's level averages its question types (lib/masteryLevel.ts), so
  // the facts count as well as naming — and a structure met only through its
  // facts is still met.
  const factsByKey = factsIndex(facts);
  const masteryById = new Map(mastery.map((m) => [m.structureId, m]));
  const sinceMs = since ? Date.parse(since) : -Infinity;
  const summaries = allSummaries.filter((s) => Date.parse(s.startedAt) >= sinceMs);

  const touched = new Set<string>();
  for (const row of [...mastery, ...facts]) {
    if (Date.parse(row.lastAttemptAt) >= sinceMs) touched.add(row.structureId);
  }
  for (const structureId of touched) {
    const structure = STRUCTURES_BY_ID.get(structureId);
    const row = masteryById.get(structureId);
    const state = structure ? structureLevel(structure, row, factsByKey, now) : masteryLevel(row, now);
    if (state.seen) rollup.levels[structureId] = state.level;
  }

  const days = new Set<string>();
  for (const s of summaries) {
    rollup.sessions.total += 1;
    const day = toDayKey(s.startedAt);
    days.add(day);

    if (s.finishedAt) {
      rollup.sessions.finished += 1;
      rollup.sessions.finishedMinutes += Math.max(0, (Date.parse(s.finishedAt) - Date.parse(s.startedAt)) / 60000);

      if (s.assignmentId) {
        const a = (rollup.assignments[s.assignmentId] ??= { taken: 0, questions: 0, correct: 0, bestPct: null });
        a.taken += 1;
        a.questions += s.totalQuestions;
        a.correct += s.correctCount;
        const pct = scorePct(s);
        if (pct !== null && (a.bestPct === null || pct > a.bestPct)) a.bestPct = pct;
      }
    }

    for (const region of REGIONS) {
      const bucket = s.breakdownByRegion[region];
      if (!bucket || bucket.total === 0) continue;
      const byRegion = (rollup.regionDays[day] ??= {});
      const cell = (byRegion[region] ??= { total: 0, correct: 0 });
      cell.total += bucket.total;
      cell.correct += bucket.correct;
    }
  }
  rollup.sessions.finishedMinutes = Math.round(rollup.sessions.finishedMinutes * 10) / 10;
  rollup.sessionDays = [...days].sort();
  return rollup;
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A stored rollup, read defensively: it is written from students' devices, and
 * a row from before it existed has none. Absent reads as empty, never throws.
 */
export function parseStudentRollup(raw: unknown): StudentRollup | undefined {
  if (!isRecord(raw)) return undefined;
  const rollup = emptyStudentRollup();

  if (isRecord(raw.levels)) {
    for (const [id, level] of Object.entries(raw.levels)) {
      if ((MASTERY_LEVELS as readonly unknown[]).includes(level)) rollup.levels[id] = level as MasteryLevel;
    }
  }
  if (isRecord(raw.sessions)) {
    rollup.sessions = {
      total: num(raw.sessions.total),
      finished: num(raw.sessions.finished),
      finishedMinutes: num(raw.sessions.finishedMinutes),
    };
  }
  if (Array.isArray(raw.sessionDays)) {
    rollup.sessionDays = raw.sessionDays.filter((d): d is string => typeof d === 'string').sort();
  }
  if (isRecord(raw.assignments)) {
    for (const [id, a] of Object.entries(raw.assignments)) {
      if (!isRecord(a)) continue;
      rollup.assignments[id] = {
        taken: num(a.taken),
        questions: num(a.questions),
        correct: num(a.correct),
        bestPct: typeof a.bestPct === 'number' ? a.bestPct : null,
      };
    }
  }
  if (isRecord(raw.regionDays)) {
    for (const [day, regions] of Object.entries(raw.regionDays)) {
      if (!isRecord(regions)) continue;
      const out: Partial<Record<Region, { total: number; correct: number }>> = {};
      for (const region of REGIONS) {
        const cell = regions[region];
        if (isRecord(cell)) out[region] = { total: num(cell.total), correct: num(cell.correct) };
      }
      rollup.regionDays[day] = out;
    }
  }
  return rollup;
}

/**
 * Mastery rows rebuilt from an attempt log, answer by answer, the way the
 * session hook writes them. Only the demo needs this — a real student's
 * device has its rows — but it keeps the demo's levels computed rather than
 * typed in, like the rest of the demo's figures.
 */
export function replayMastery(userId: string, attempts: readonly UserAttempt[]): StructureMastery[] {
  const rows = new Map<string, StructureMastery>();
  const ordered = [...attempts].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  for (const a of ordered) {
    const existing = rows.get(a.structureId);
    const at = new Date(a.timestamp);
    if (a.graded === false) {
      if (!existing) rows.set(a.structureId, markSeen(a.structureId, userId, at));
      continue;
    }
    // Only naming answers move this row; facts have their own (2 Oct 2026).
    if (skillOf(a.questionType, a.promptKind) !== 'identify') continue;
    rows.set(
      a.structureId,
      updateMasteryAfterAttempt(
        existing,
        {
          structureId: a.structureId,
          userId,
          correct: a.correct,
          confidence: a.confidence,
          durationMs: a.durationMs,
          askedRung: rungOfQuestion(a.questionType, a.hints, a.promptKind),
        },
        at,
      ),
    );
  }
  return [...rows.values()];
}
