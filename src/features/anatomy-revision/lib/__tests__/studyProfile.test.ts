import { describe, expect, it } from 'vitest';
import {
  asStudyProfile,
  currentFocus,
  emptyStudyProfile,
  hasAnswers,
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

  it('brings in new material faster only inside six weeks of an exam', () => {
    const now = new Date(2026, 9, 19);
    expect(newShareFor(profile({ examDate: '2026-11-10' }), now)).toBe(0.4);
    expect(newShareFor(profile({ examDate: '2027-03-01' }), now)).toBeUndefined();
    expect(newShareFor(profile({ examDate: '2026-10-01' }), now, 0.5)).toBe(0.5);
    // Never lower than a share the session already asks for.
    expect(newShareFor(profile({ examDate: '2026-11-10' }), now, 0.5)).toBe(0.5);
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
