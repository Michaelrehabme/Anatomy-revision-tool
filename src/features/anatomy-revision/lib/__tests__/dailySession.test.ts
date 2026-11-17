import { describe, expect, it } from 'vitest';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import { buildDailySession, type DailySessionInput } from '../dailySession';
import { emptyStudyProfile, type StudyProfile } from '../studyProfile';
import { AREAS } from '../../types/region';
import { areasOf } from '../../types/structure';
import { buildReviewQueue } from '../reviewQueue';
import type { StructureMastery } from '../../types/attempt';

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
    // Questions answered: flashcards ride along outside the budget, a new
    // structure's in front of its first question (owner, 17 Nov 2026).
    const answered = (minutesPerDay: StudyProfile['minutesPerDay']) =>
      buildDailySession(input({ profile: profile({ minutesPerDay }) })).questions.filter((q) => q.type !== 'flashcard').length;
    expect(answered(5)).toBeLessThanOrEqual(10);
    expect(answered(30)).toBeGreaterThan(20);
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

  it('gives a quarter of the questions answered to new structures, each introduced by its flashcard (owner, 17 Nov 2026)', () => {
    // A long history: everything in the hip and knee met and due but ten.
    const now = new Date('2026-11-17T12:00:00Z');
    const inAreas = ALL_STRUCTURES.filter((s) => areasOf(s).some((a) => a === 'hip' || a === 'knee'));
    const unmet = new Set(inAreas.slice(0, 10).map((s) => s.id));
    const mastery: StructureMastery[] = inAreas
      .filter((s) => !unmet.has(s.id))
      .map((s) => ({
        structureId: s.id, userId: 'u', attemptsTotal: 3, attemptsCorrect: 1, lastAttemptAt: '2026-11-15T12:00:00Z',
        rung: 'mcq', intervalDays: 1, recentAccuracy: 0.4, dueAt: '2026-11-16T00:00:00Z',
      }));
    const { due, forward } = buildReviewQueue(mastery, [], new Set(ALL_STRUCTURES.map((s) => s.id)), now);
    for (let seed = 1; seed <= 4; seed++) {
      const { questions } = buildDailySession(input({ mastery, reviewItems: [...due, ...forward], now, seed }));
      const answered = questions.filter((q) => q.type !== 'flashcard');
      const newAnswered = answered.filter((q) => unmet.has(q.structureId));
      expect(answered.length).toBe(20);
      expect(newAnswered.length).toBe(5);
      expect(new Set(newAnswered.map((q) => q.structureId)).size).toBe(5);
      // A new structure's flashcard comes straight before its question, never after.
      for (const q of newAnswered) {
        const at = questions.indexOf(q);
        const card = questions.findIndex((c) => c.type === 'flashcard' && c.structureId === q.structureId);
        if (card !== -1) expect(card).toBe(at - 1);
      }
    }
  });
});
