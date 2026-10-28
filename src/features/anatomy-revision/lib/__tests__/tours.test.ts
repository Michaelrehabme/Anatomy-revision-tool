import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOURS, TOUR_KEYS, markTourSeen, resetTours, shouldShowTour, stepsFor, type TourKey, type TourLayout } from '../tours';

/**
 * The tours (lib/tours.ts): what each layout is shown, how "seen" is kept, and
 * — because the app mounts a desktop OR a mobile tree — that every step's
 * target is actually marked in the files each layout renders. A step whose
 * target is missing is skipped silently at runtime, so without this check a
 * renamed attribute would quietly shorten a tour.
 */

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('seen state', () => {
  it('shows each tour until it is marked seen, and again after a reset', () => {
    expect(TOUR_KEYS.every(shouldShowTour)).toBe(true);
    markTourSeen('atlas');
    expect(shouldShowTour('atlas')).toBe(false);
    expect(shouldShowTour('today')).toBe(true);
    resetTours();
    expect(shouldShowTour('atlas')).toBe(true);
  });

  it('shows nothing, and does not throw, when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(shouldShowTour('today')).toBe(false);
    expect(() => markTourSeen('today')).not.toThrow();
    expect(() => resetTours()).not.toThrow();
  });
});

describe('stepsFor', () => {
  // The phone Progress screen gained the fortnight, untouched and leeches (28 Oct 2026), so its tour is the whole tour.
  it('gives the phone the whole Progress tour', () => {
    expect(stepsFor('progress', 'mobile')).toEqual(stepsFor('progress', 'desktop'));
    expect(stepsFor('progress', 'mobile').map((s) => s.target)).toContain('progress-leeches');
  });
});

const C = 'src/features/anatomy-revision/components/';
const E = 'src/features/educator/components/';
/** Educator pages are one component for both layouts; only the shell differs. */
const both = (...files: string[]) => ({ desktop: files, mobile: files });
/** The files each layout renders for a screen, shells and shared parts included. */
const FILES: Record<TourKey, Record<TourLayout, string[]>> = {
  today: {
    desktop: [`${C}Today/Today.tsx`, `${C}shared/ClassAssignments.tsx`, `${C}shell/NavSidebar.tsx`],
    mobile: [`${C}mobile/MobileToday.tsx`, `${C}shared/ClassAssignments.tsx`, `${C}mobile/MobileTabBar.tsx`],
  },
  atlas: { desktop: [`${C}Atlas/Atlas.tsx`], mobile: [`${C}mobile/MobileAtlas.tsx`] },
  progress: {
    desktop: [`${C}Progress/Progress.tsx`, `${C}shared/ProgressTabs.tsx`],
    mobile: [`${C}mobile/MobileProgress.tsx`, `${C}shared/ProgressTabs.tsx`],
  },
  setup: { desktop: [`${C}RevisionSetup/RevisionSetup.tsx`], mobile: [`${C}mobile/MobileRevisionSetup.tsx`] },
  educator: {
    desktop: [`${E}Overview/CohortOverviewScreen.tsx`, `${E}shell/EducatorSidebar.tsx`],
    mobile: [`${E}Overview/CohortOverviewScreen.tsx`, `${E}shell/EducatorMobileShell.tsx`],
  },
  'educator-classes': {
    desktop: [`${E}EducatorHome.tsx`, `${E}shell/EducatorSidebar.tsx`],
    mobile: [`${E}EducatorHome.tsx`, `${E}shell/EducatorMobileShell.tsx`],
  },
  'educator-weakness': both(`${E}Weakness/StructureWeaknessScreen.tsx`, 'src/features/admin/components/Analytics/StructureWeaknessTable.tsx'),
  'educator-confusion': both(`${E}Confusion/ConfusionPairsScreen.tsx`),
  'educator-students': both(`${E}Students/StudentsListScreen.tsx`, `${E}Students/InviteStudentsPanel.tsx`),
  'educator-student': both(`${E}Students/StudentDetailScreen.tsx`),
  'educator-assignments': both(`${E}Assignments/AssignmentsScreen.tsx`, `${E}Assignments/ChallengeSection.tsx`, `${E}Assignments/CreateAssignmentForm.tsx`),
};

describe('every step is marked on the page, at both breakpoints', () => {
  for (const key of TOUR_KEYS) {
    for (const layout of ['desktop', 'mobile'] as const) {
      it(`${key} · ${layout}`, () => {
        const source = FILES[key][layout].map((f) => readFileSync(resolve(process.cwd(), f), 'utf8')).join('\n');
        // Written out, or chosen in code (the weakness table tags one of its generated column headers).
        const missing = stepsFor(key, layout).filter((s) => !source.includes(`data-tour="${s.target}"`) && !source.includes(`'${s.target}'`));
        expect(missing.map((s) => s.target)).toEqual([]);
        expect(source).toContain(`<Tour tourKey="${key}"`);
      });
    }
  }

  it('gives every step a title and a body', () => {
    for (const steps of Object.values(TOURS)) {
      for (const s of steps) {
        expect(s.title.trim()).not.toBe('');
        expect(s.body.trim()).not.toBe('');
      }
    }
  });
});
