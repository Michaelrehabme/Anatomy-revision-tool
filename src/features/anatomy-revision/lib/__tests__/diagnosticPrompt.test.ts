import { describe, expect, it } from 'vitest';
import {
  nextDiagnosticPhase,
  promptCopy,
  BASELINE_WINDOW_DAYS,
  FOLLOW_UP_AFTER_DAYS,
} from '../diagnosticPrompt';
import { DIAGNOSTIC_VERSION, type DiagnosticResult } from '../diagnostic';

/**
 * These decide whether to interrupt somebody who opened the app to revise, so
 * the cases that matter are the ones where the answer is "leave them alone".
 */

const NOW = new Date('2026-10-15T09:00:00.000Z');

function sat(phase: 'baseline' | 'followUp', takenAt: string, cohortId = 'c1'): DiagnosticResult {
  return { userId: 'u1', cohortId, version: DIAGNOSTIC_VERSION, phase, correct: 6, total: 15, takenAt };
}

describe('nextDiagnosticPhase', () => {
  it('offers a baseline to someone who just joined a class', () => {
    expect(nextDiagnosticPhase({
      cohortId: 'c1', joinedAt: '2026-10-14T09:00:00.000Z', results: [], now: NOW,
    })).toBe('baseline');
  });

  it('never asks a student who is in no class', () => {
    // The sitting exists to show a cohort moved. One student's score answers
    // a question nobody is asking.
    expect(nextDiagnosticPhase({
      cohortId: null, joinedAt: '2026-10-14T09:00:00.000Z', results: [], now: NOW,
    })).toBeNull();
  });

  it('stops offering a baseline once it would no longer be one', () => {
    const joined = new Date(NOW.getTime() - (BASELINE_WINDOW_DAYS + 1) * 86400000).toISOString();
    // Two months of revision in, a "before" measures neither before nor after,
    // and pairing it later would understate the gain while looking authoritative.
    expect(nextDiagnosticPhase({ cohortId: 'c1', joinedAt: joined, results: [], now: NOW })).toBeNull();
  });

  it('still offers a baseline when the join date is unknown', () => {
    // A missing timestamp is a gap in our records, not evidence of a long stay.
    expect(nextDiagnosticPhase({ cohortId: 'c1', joinedAt: null, results: [], now: NOW })).toBe('baseline');
  });

  it('does not ask again the moment a baseline is done', () => {
    expect(nextDiagnosticPhase({
      cohortId: 'c1', joinedAt: '2026-10-14T09:00:00.000Z',
      results: [sat('baseline', '2026-10-14T10:00:00.000Z')], now: NOW,
    })).toBeNull();
  });

  it('offers the follow-up once a term has passed', () => {
    const baselineAt = new Date(NOW.getTime() - (FOLLOW_UP_AFTER_DAYS + 1) * 86400000).toISOString();
    expect(nextDiagnosticPhase({
      cohortId: 'c1', joinedAt: baselineAt, results: [sat('baseline', baselineAt)], now: NOW,
    })).toBe('followUp');
  });

  it('never asks again once the follow-up is done', () => {
    const baselineAt = new Date(NOW.getTime() - 200 * 86400000).toISOString();
    expect(nextDiagnosticPhase({
      cohortId: 'c1', joinedAt: baselineAt,
      results: [sat('baseline', baselineAt), sat('followUp', '2026-10-01T09:00:00.000Z')], now: NOW,
    })).toBeNull();
  });

  it('ignores sittings from a class the student has since left', () => {
    const old = new Date(NOW.getTime() - 200 * 86400000).toISOString();
    // A baseline for last year's cohort says nothing about this one.
    expect(nextDiagnosticPhase({
      cohortId: 'c2', joinedAt: '2026-10-14T09:00:00.000Z',
      results: [sat('baseline', old, 'c1')], now: NOW,
    })).toBe('baseline');
  });
});

describe('promptCopy', () => {
  it('promises the baseline is private to the student', () => {
    expect(promptCopy('baseline').body).toContain('never sees your score');
  });

  it('asks for the follow-up differently, since it is a different proposition', () => {
    const a = promptCopy('baseline');
    const b = promptCopy('followUp');
    expect(b.title).not.toBe(a.title);
    expect(b.cta).not.toBe(a.cta);
    expect(b.body).toContain('a term of revision actually did');
  });
});
