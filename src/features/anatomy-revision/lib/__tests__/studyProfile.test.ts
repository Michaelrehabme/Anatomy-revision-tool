import { describe, expect, it } from 'vitest';
import {
  asStudyProfile,
  currentFocus,
  dailyGoalFor,
  parseReminderTime,
  emptyStudyProfile,
  hasAnswers,
  isStarred,
  newerProfile,
  newShareFor,
  newStructureBias,
  previousFocus,
  sessionCountFor,
  skipsFlashcard,
  starterAreaOrder,
  starterCategories,
  suggestFocusArea,
  suggestFocusCategory,
  toggleStar,
  typeWeightsFor,
  weekStartOf,
  type FocusStanding,
  type StudyProfile,
} from '../studyProfile';

const profile = (over: Partial<StudyProfile>): StudyProfile => ({ ...emptyStudyProfile(1), ...over });
const knee = { areas: ['knee' as const], subregion: undefined, category: 'ligament' as const };

describe('asStudyProfile', () => {
  it('keeps what is readable and drops what is not, field by field', () => {
    const p = asStudyProfile({
      updatedAt: 5,
      studyLength: '1to2y',
      level: 'nonsense',
      areaConfidence: { knee: 'unsure', hip: 'very', mars: 'new' },
      typeConfidence: { bone: 'confident' },
      minutesPerDay: 7,
      preferredFormats: ['locate', 'locate', 'tarot'],
      examDate: '2026-12-01',
      weeklyFocus: { area: 'knee', weekStart: '2026-10-19' },
    })!;
    expect(p.studyLength).toBe('1to2y');
    expect(p.level).toBeUndefined();
    expect(p.areaConfidence).toEqual({ knee: 'unsure' });
    expect(p.typeConfidence).toEqual({ bone: 'confident' });
    expect(p.minutesPerDay).toBeUndefined();
    expect(p.preferredFormats).toEqual(['locate']);
    expect(p.weeklyFocus).toEqual({ area: 'knee', weekStart: '2026-10-19' });
  });

  it('reads nothing as no profile', () => {
    expect(asStudyProfile(null)).toBeNull();
    expect(asStudyProfile('x')).toBeNull();
    expect(asStudyProfile([])).toBeNull();
  });

  it('never writes undefined, which Firestore refuses', () => {
    const p = asStudyProfile({ updatedAt: 1 })!;
    expect(Object.values(p).includes(undefined)).toBe(false);
  });
});

describe('newerProfile', () => {
  it('keeps the copy changed last', () => {
    const a = profile({ updatedAt: 10 });
    const b = profile({ updatedAt: 20 });
    expect(newerProfile(a, b)).toBe(b);
    expect(newerProfile(b, a)).toBe(b);
    expect(newerProfile(null, a)).toBe(a);
  });
});

describe('a skipped or empty questionnaire changes nothing', () => {
  const skipped = profile({ skipped: true, areaConfidence: { knee: 'unsure' } });
  it.each([null, emptyStudyProfile(), skipped])('%#', (p) => {
    expect(hasAnswers(p)).toBe(false);
    expect(newStructureBias(p, knee)).toBe(1);
    expect(skipsFlashcard(p, knee)).toBe(false);
    expect(sessionCountFor(p)).toBe(20);
    expect(typeWeightsFor(p)).toBeUndefined();
    expect(starterCategories(p)).toEqual(['muscle']);
    expect(starterAreaOrder(p, ['hip', 'knee'])).toEqual(['hip', 'knee']);
  });
});

describe('newStructureBias', () => {
  it('multiplies the area rating by the kind rating', () => {
    const p = profile({ areaConfidence: { knee: 'unsure' }, typeConfidence: { ligament: 'confident' } });
    expect(newStructureBias(p, knee)).toBe(2 * 0.5);
  });

  it('takes the strongest rating of a structure in several areas', () => {
    const p = profile({ areaConfidence: { 'cervical-spine': 'confident', 'lumbar-spine': 'unsure' } });
    expect(newStructureBias(p, { areas: ['cervical-spine', 'lumbar-spine'], subregion: undefined, category: 'bone' })).toBe(2);
  });
});

describe('learn first or test first', () => {
  it('follows the student’s own choice over anything inferred, answers or none', () => {
    expect(skipsFlashcard(profile({ skipped: true, newStructures: 'ask' }), knee)).toBe(true);
    expect(skipsFlashcard(profile({ studyLength: '2yplus', newStructures: 'show' }), knee)).toBe(false);
  });
});

describe('daily goal and reminder time', () => {
  it('makes the goal one daily review', () => {
    expect(dailyGoalFor(null)).toBe(20);
    expect(dailyGoalFor(profile({ minutesPerDay: 30 }))).toBe(40);
  });

  it('reads a reminder time, and keeps only a real one', () => {
    expect(parseReminderTime('07:30')).toEqual({ hour: 7, minute: 30 });
    expect(parseReminderTime('24:00')).toBeNull();
    expect(asStudyProfile({ updatedAt: 1, reminderTime: '19:45' })!.reminderTime).toBe('19:45');
    expect(asStudyProfile({ updatedAt: 1, reminderTime: '7pm' })!.reminderTime).toBeUndefined();
  });
});

describe('the starred list', () => {
  it('stars newest first and unstars', () => {
    const one = toggleStar(profile({}), 'deltoid') as StudyProfile;
    const two = toggleStar(one, 'femur') as StudyProfile;
    expect(two.starred).toEqual(['femur', 'deltoid']);
    expect(isStarred(two, 'deltoid')).toBe(true);
    expect(toggleStar(two, 'deltoid').starred).toEqual(['femur']);
  });

  it('keeps only readable ids from storage', () => {
    expect(asStudyProfile({ updatedAt: 1, starred: ['deltoid', 'deltoid', 7, 'Bad Id', 'femur'] })!.starred).toEqual(['deltoid', 'femur']);
  });
});

describe('skipsFlashcard', () => {
  it('skips only for a confident kind or a year or more of study, and never for a kind called new', () => {
    expect(skipsFlashcard(profile({ typeConfidence: { ligament: 'confident' } }), knee)).toBe(true);
    expect(skipsFlashcard(profile({ studyLength: '2yplus' }), knee)).toBe(true);
    expect(skipsFlashcard(profile({ studyLength: 'lt6m' }), knee)).toBe(false);
    expect(skipsFlashcard(profile({ studyLength: '2yplus', typeConfidence: { ligament: 'new' } }), knee)).toBe(false);
  });
});

describe('session length and pace', () => {
  it('maps minutes a day to a session length', () => {
    expect([5, 10, 20, 30].map((m) => sessionCountFor(profile({ minutesPerDay: m as 5 })))).toEqual([10, 20, 30, 40]);
  });

  it('paces new material so everything is met a week before the exam', () => {
    const now = new Date(2026, 9, 19);
    // 21 days to the exam, 14 of them for new material: 280 unseen in 20-question sessions is 1.0 a day — capped.
    expect(newShareFor(profile({ examDate: '2026-11-09' }), now, undefined, { unseen: 280, count: 20 })).toBe(0.7);
    // 140 unseen over 14 days at 20 a session: half of each session.
    expect(newShareFor(profile({ examDate: '2026-11-09' }), now, undefined, { unseen: 140, count: 20 })).toBeCloseTo(0.5);
    // Plenty of time: the share is left alone.
    expect(newShareFor(profile({ examDate: '2027-06-01' }), now, undefined, { unseen: 100, count: 20 })).toBeUndefined();
    // Inside the review week, or after the exam: nothing changes.
    expect(newShareFor(profile({ examDate: '2026-10-24' }), now, 0.5, { unseen: 300, count: 20 })).toBe(0.5);
    expect(newShareFor(profile({ examDate: '2026-10-01' }), now, 0.5, { unseen: 300, count: 20 })).toBe(0.5);
    // Never lower than a share the session already asks for.
    expect(newShareFor(profile({ examDate: '2026-11-09' }), now, 0.6, { unseen: 70, count: 20 })).toBe(0.6);
  });

  it('leans towards preferred formats without removing the others', () => {
    expect(typeWeightsFor(profile({ preferredFormats: ['typed'] }))).toEqual({ 'identify-typed': 1.5, 'fill-blank': 1.5 });
  });
});

describe('the first session', () => {
  it('starts in the least confident area', () => {
    const p = profile({ areaConfidence: { hip: 'confident', knee: 'new', shoulder: 'unsure' } });
    expect(starterAreaOrder(p, ['hip', 'shoulder', 'knee', 'elbow'])).toEqual(['knee', 'shoulder', 'elbow', 'hip']);
  });

  it('asks the kinds the student has met, not the ones called new', () => {
    expect(starterCategories(profile({ typeConfidence: { muscle: 'new', bone: 'confident', ligament: 'unsure' } }))).toEqual(['bone', 'ligament']);
    expect(starterCategories(profile({ typeConfidence: { muscle: 'new' } }))).toEqual(['muscle']);
  });
});

describe('the week', () => {
  it('starts on Monday, every day of the week', () => {
    // Monday 19 Oct 2026 to Sunday 25 Oct.
    for (let d = 19; d <= 25; d++) expect(weekStartOf(new Date(2026, 9, d, 23, 30))).toBe('2026-10-19');
    expect(weekStartOf(new Date(2026, 9, 26, 0, 5))).toBe('2026-10-26');
  });

  it('is not thrown by the clocks going back (UK, Sunday 25 Oct 2026)', () => {
    expect(weekStartOf(new Date(2026, 9, 25, 12))).toBe('2026-10-19');
    expect(weekStartOf(new Date(2026, 9, 27, 1))).toBe('2026-10-26');
  });

  it('treats last week’s focus as a prompt, not a standing order', () => {
    const p = profile({ weeklyFocus: { area: 'knee', weekStart: '2026-10-12' } });
    const now = new Date(2026, 9, 20);
    expect(currentFocus(p, now, ['knee', 'hip'])).toBeNull();
    expect(previousFocus(p, now)?.area).toBe('knee');
    const thisWeek = profile({ weeklyFocus: { area: 'knee', weekStart: '2026-10-19' } });
    expect(currentFocus(thisWeek, now, ['knee', 'hip'])?.area).toBe('knee');
    // An area no longer reachable is no focus.
    expect(currentFocus(thisWeek, now, ['hip'])).toBeNull();
  });
});

describe('suggestions', () => {
  const standing: Record<string, FocusStanding> = {
    knee: { total: 40, seen: 30, secure: 20 },
    hip: { total: 40, seen: 10, secure: 4 },
    shoulder: { total: 40, seen: 20, secure: 8 },
    elbow: { total: 0, seen: 0, secure: 0 },
  };
  const of = (a: string) => standing[a];

  it('suggests the area with the fewest structures secure', () => {
    expect(suggestFocusArea(['knee', 'hip', 'shoulder', 'elbow'], of, null)).toBe('hip');
  });

  it('is nudged by the questionnaire', () => {
    const p = profile({ areaConfidence: { hip: 'confident', shoulder: 'unsure' } });
    expect(suggestFocusArea(['knee', 'hip', 'shoulder'], of, p)).toBe('shoulder');
  });

  it('does not suggest last week’s area again while there is another', () => {
    expect(suggestFocusArea(['knee', 'hip', 'shoulder'], of, null, 'hip')).toBe('shoulder');
    expect(suggestFocusArea(['hip'], of, null, 'hip')).toBe('hip');
  });

  it('suggests a kind of structure for the free tier, skipping kinds the area has none of', () => {
    const byKind: Record<string, FocusStanding> = {
      muscle: { total: 20, seen: 20, secure: 15 },
      bone: { total: 5, seen: 0, secure: 0 },
      landmark: { total: 0, seen: 0, secure: 0 },
      joint: { total: 3, seen: 3, secure: 3 },
      ligament: { total: 10, seen: 2, secure: 1 },
    };
    expect(suggestFocusCategory((c) => byKind[c], null)).toBe('bone');
    expect(suggestFocusCategory((c) => byKind[c], null, 'bone')).toBe('ligament');
  });
});
