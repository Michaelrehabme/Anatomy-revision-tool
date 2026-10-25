import { describe, expect, it } from 'vitest';
import { STRUCTURE_INDEX } from '../../../anatomy-revision/data/structureIndex';
import { areasOf } from '../../../anatomy-revision/types/structure';
import type { MasteryLevel } from '../../../anatomy-revision/lib/masteryLevel';
import type { ChallengeAssignment } from '../../types/cohort';
import type { FactMastery, StructureMastery } from '../../../anatomy-revision/types/attempt';
import { buildStudentRollup } from '../studentRollup';
import {
  studentSecured,
  activeChallenge,
  areaTotal,
  challengeEnd,
  challengeWeeks,
  regionOfArea,
  securedInArea,
  suggestedTarget,
} from '../classChallenge';

const challenge = (over: Partial<ChallengeAssignment>): ChallengeAssignment => ({
  id: 'c', cohortId: 'k', kind: 'challenge', title: 'Class challenge: Knee', dueAt: '', createdAt: '2026-10-19T09:00:00Z',
  createdBy: 't', area: 'knee', targetSecure: 20, weekStart: '2026-10-19', region: 'lower-leg-foot', ...over,
});

describe('classChallenge', () => {
  it('counts only secure structures in the area — Intermediate and above', () => {
    const knee = STRUCTURE_INDEX.filter((s) => areasOf(s).includes('knee') && !areasOf(s).includes('hip')).slice(0, 4).map((s) => s.id);
    const hip = STRUCTURE_INDEX.find((s) => areasOf(s).includes('hip') && !areasOf(s).includes('knee'))!.id;
    const levels: Record<string, MasteryLevel> = {
      [knee[0]]: 'intermediate', [knee[1]]: 'master', [knee[2]]: 'novice', [knee[3]]: 'beginner', [hip]: 'master',
    };
    expect(securedInArea(levels, STRUCTURE_INDEX, 'knee')).toBe(2);
  });

  it('suggests about half the area, in fives, never more than there is', () => {
    expect(suggestedTarget(51)).toBe(25);
    expect(suggestedTarget(4)).toBe(4);
    const total = areaTotal(STRUCTURE_INDEX, 'knee');
    expect(suggestedTarget(total)).toBeLessThanOrEqual(total);
  });

  it('runs Monday to the end of Sunday', () => {
    const end = challengeEnd('2026-10-19');
    expect([end.getFullYear(), end.getMonth(), end.getDate(), end.getHours(), end.getMinutes()]).toEqual([2026, 9, 25, 23, 59]);
    expect(challengeWeeks(new Date(2026, 9, 22))).toEqual({ thisWeek: '2026-10-19', nextWeek: '2026-10-26' });
  });

  it('finds this week’s challenge, the newest when two were set', () => {
    const older = challenge({ id: 'a', area: 'hip' });
    const newer = challenge({ id: 'b', createdAt: '2026-10-20T09:00:00Z' });
    const lastWeek = challenge({ id: 'c', weekStart: '2026-10-12' });
    expect(activeChallenge([older, newer, lastWeek], new Date(2026, 9, 21))?.id).toBe('b');
    expect(activeChallenge([lastWeek], new Date(2026, 9, 21))).toBeNull();
  });

  it('gives older app versions a real region to show', () => {
    // The knee sits in both old regions; either is a real one to show.
    expect(['hip-thigh', 'lower-leg-foot']).toContain(regionOfArea('knee'));
    expect(regionOfArea('shoulder')).toBe('shoulder-arm');
    expect(regionOfArea('lumbar-spine')).toBe('back-core');
  });

  it('counts a student exactly as their teacher sees them: only what was answered since joining', () => {
    const now = new Date('2026-10-23T12:00:00Z');
    const since = '2026-10-10T00:00:00Z';
    const knee = STRUCTURE_INDEX.filter((s) => areasOf(s).includes('knee'));
    const rungs = ['typed-bare', 'typed-hinted', 'mcq'] as const;
    const mastery: StructureMastery[] = knee.slice(0, 24).map((s, i) => ({
      structureId: s.id,
      userId: 'u',
      attemptsTotal: 9,
      attemptsCorrect: 8 - (i % 3),
      recentAccuracy: 0.9,
      rung: rungs[i % 3],
      rungStreak: 3,
      // Every third one was last answered before joining the class.
      lastAttemptAt: i % 3 === 2 ? '2026-10-01T09:00:00Z' : '2026-10-20T09:00:00Z',
      dueAt: '2026-11-10T09:00:00Z',
      intervalDays: 20,
    }));
    const facts: FactMastery[] = [];
    const teacher = securedInArea(buildStudentRollup(mastery, [], now, since, facts).levels, STRUCTURE_INDEX, 'knee');
    const student = studentSecured(STRUCTURE_INDEX, mastery, facts, 'knee', since, now);
    expect(student).toBe(teacher);
    expect(student).toBeGreaterThan(0);
    // And the earlier answers do not count: counting from the start of time gives more.
    expect(studentSecured(STRUCTURE_INDEX, mastery, facts, 'knee', '2026-01-01T00:00:00Z', now)).toBeGreaterThanOrEqual(student);
  });
});
