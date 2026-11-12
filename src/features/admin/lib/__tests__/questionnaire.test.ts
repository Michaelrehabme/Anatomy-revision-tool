import { describe, expect, it } from 'vitest';
import { questionnaireBreakdown, summariseQuestionnaire, trainingGroup } from '../questionnaire';
import { lastSessionAt } from '../lastSession';

describe('summariseQuestionnaire', () => {
  it('reads the answers that say who someone is', () => {
    expect(summariseQuestionnaire({ version: 1, updatedAt: 1, level: 'ug-later', course: 'physio', areaConfidence: {}, typeConfidence: {}, preferredFormats: [] }))
      .toEqual({ status: 'answered', level: 'ug-later', course: 'physio' });
  });
  it('tells skipped from never answered', () => {
    expect(summariseQuestionnaire({ skipped: true }).status).toBe('skipped');
    expect(summariseQuestionnaire(undefined).status).toBe('none');
    expect(summariseQuestionnaire({ areaConfidence: {} }).status).toBe('none');
  });
});

describe('trainingGroup', () => {
  it('counts only "qualified" as qualified, and every study level as training', () => {
    expect(trainingGroup({ status: 'answered', level: 'qualified' })).toBe('qualified');
    for (const level of ['school', 'ug-year1', 'ug-later', 'postgrad'] as const) {
      expect(trainingGroup({ status: 'answered', level })).toBe('training');
    }
    expect(trainingGroup({ status: 'answered', level: 'other' })).toBe('other');
    expect(trainingGroup({ status: 'answered', course: 'physio' })).toBe('none');
  });
  it('adds up to the total', () => {
    const b = questionnaireBreakdown([{ status: 'answered', level: 'qualified' }, { status: 'skipped' }, { status: 'none' }]);
    expect(b.groups.reduce((n, g) => n + g.count, 0)).toBe(3);
  });
});

describe('lastSessionAt', () => {
  it('takes the newest finish, or start if unfinished', () => {
    expect(lastSessionAt([])).toBeNull();
    expect(lastSessionAt([
      { startedAt: '2026-11-01T10:00:00Z', finishedAt: '2026-11-01T10:10:00Z' },
      { startedAt: '2026-11-05T09:00:00Z' },
    ])).toBe('2026-11-05T09:00:00Z');
  });
});
