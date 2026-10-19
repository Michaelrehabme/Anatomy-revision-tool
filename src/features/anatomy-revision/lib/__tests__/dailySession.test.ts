import { describe, expect, it } from 'vitest';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import { buildDailySession, type DailySessionInput } from '../dailySession';
import { emptyStudyProfile, type StudyProfile } from '../studyProfile';
import { AREAS } from '../../types/region';
import { areasOf } from '../../types/structure';

const structuresById = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
const content = { structures: ALL_STRUCTURES, images: ALL_IMAGES, sources: undefined, structuresById };
const profile = (over: Partial<StudyProfile>): StudyProfile => ({ ...emptyStudyProfile(1), ...over });

const input = (over: Partial<DailySessionInput>): DailySessionInput => ({
  content,
  entitledAreas: AREAS,
  areas: ['hip', 'knee'],
  only: null,
  firstRun: false,
  reviewItems: [],
  spreadItems: [],
  // An empty history, not none: the ladder and the "new" share both need one to work from.
  mastery: [],
  facts: [],
  learnCardAttempts: 0,
  profile: null,
  style: 'continue',
  seed: 11,
  ...over,
});

const structureOf = (id: string) => structuresById.get(id)!;

describe('buildDailySession', () => {
  it('keeps a focus session inside its area', () => {
    const { questions, params } = buildDailySession(
      input({ style: 'focus', focus: { area: 'knee', weekStart: '2026-10-19' }, entitledAreas: ['hip', 'knee', 'shoulder'] }),
    );
    expect(questions.length).toBeGreaterThan(0);
    expect(params.areas).toEqual(['knee']);
    for (const q of questions) expect(areasOf(structureOf(q.structureId))).toContain('knee');
  });

  it('keeps a free account’s focus to one kind of structure in its one area', () => {
    const { questions } = buildDailySession(
      input({ style: 'focus', focus: { category: 'bone', weekStart: '2026-10-19' }, entitledAreas: ['knee'], areas: ['knee'] }),
    );
    expect(questions.length).toBeGreaterThan(0);
    for (const q of questions) {
      const s = structureOf(q.structureId);
      expect(s.category).toBe('bone');
      expect(areasOf(s)).toContain('knee');
    }
  });

  it('never focuses on an area the account cannot reach', () => {
    const { questions } = buildDailySession(
      input({ style: 'focus', focus: { area: 'shoulder', weekStart: '2026-10-19' }, entitledAreas: ['knee'], areas: ['knee'] }),
    );
    for (const q of questions) expect(areasOf(structureOf(q.structureId))).toContain('knee');
  });

  it('is unchanged by a skipped questionnaire', () => {
    const plain = buildDailySession(input({}));
    const skipped = buildDailySession(input({ profile: profile({ skipped: true, minutesPerDay: 30, areaConfidence: { knee: 'unsure' } }) }));
    expect(skipped.questions.map((q) => q.id)).toEqual(plain.questions.map((q) => q.id));
  });

  it('draws new structures from the area the student is unsure of', () => {
    const p = profile({ areaConfidence: { knee: 'unsure', hip: 'confident' } });
    let knee = 0;
    let hip = 0;
    for (let seed = 1; seed <= 8; seed++) {
      for (const q of buildDailySession(input({ profile: p, seed })).questions) {
        const areas = areasOf(structureOf(q.structureId));
        if (areas.includes('knee')) knee++;
        else if (areas.includes('hip')) hip++;
      }
    }
    expect(knee).toBeGreaterThan(hip * 1.5);
  });

  it('sizes the review by the minutes a day', () => {
    expect(buildDailySession(input({ profile: profile({ minutesPerDay: 5 }) })).questions.length).toBeLessThanOrEqual(10);
    expect(buildDailySession(input({ profile: profile({ minutesPerDay: 30 }) })).questions.length).toBeGreaterThan(20);
  });

  it('opens never-seen structures on multiple choice, not flashcards, for a student two years in', () => {
    const plain = buildDailySession(input({}));
    const experienced = buildDailySession(input({ profile: profile({ studyLength: '2yplus' }) }));
    expect(plain.questions.some((q) => q.type === 'flashcard')).toBe(true);
    expect(experienced.questions.some((q) => q.type === 'flashcard')).toBe(false);
    // ...and never skips past multiple choice to typed recall.
    expect(experienced.questions.some((q) => q.type === 'identify-typed')).toBe(false);
  });

  it('starts a first session in the least confident area', () => {
    const p = profile({ areaConfidence: { hip: 'confident', knee: 'new' } });
    const { questions } = buildDailySession(input({ firstRun: true, profile: p }));
    expect(questions.length).toBeGreaterThan(0);
    for (const q of questions) expect(areasOf(structureOf(q.structureId))).toContain('knee');
  });
});
