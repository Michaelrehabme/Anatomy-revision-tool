/**
 * Step-by-step tours of the main screens (owner, 28 Oct 2026): a spotlight on
 * one part of the page at a time, with a line on what it is for. Each tour
 * plays once, the first time its screen is opened, and can be replayed from
 * Account.
 *
 * A step points at an element by its `data-tour` attribute, which the desktop
 * and the mobile screen both carry — the app mounts one tree or the other, so
 * a step only has to name the part, not the component. A step whose element
 * is not on the page is skipped rather than shown pointing at nothing: much of
 * what a tour describes is conditional (the area select needs two areas, the
 * class panel needs a class, the weakest list needs a first session).
 *
 * Seen state is per device in localStorage, like the hints in
 * firstTimeHints.ts: it is about this person's familiarity with the screen,
 * and it must never cost a repository read.
 */

const PREFIX = 'anatomy-revision:v1:tour:';

export type TourKey = 'today' | 'atlas' | 'progress' | 'setup' | 'educator';

export const TOUR_KEYS: readonly TourKey[] = ['today', 'atlas', 'progress', 'setup', 'educator'];

export type TourLayout = 'desktop' | 'mobile';

export interface TourStep {
  /** The `data-tour` value of the element to spotlight. */
  target: string;
  title: string;
  body: string;
  /** Omit for both. For parts only one layout has, e.g. the desktop-only leeches list. */
  layouts?: readonly TourLayout[];
}

export const TOURS: Record<TourKey, readonly TourStep[]> = {
  today: [
    {
      target: 'today-headline',
      title: 'What is waiting for you',
      body: 'After your first session this counts the structures due for review today. Each one comes back just before you would forget it, so clearing this number is the day’s work.',
    },
    {
      target: 'today-area',
      title: 'Review one area',
      body: 'Cut today’s review down to a single area — useful in the week before a practical on one joint.',
    },
    {
      target: 'today-start',
      title: 'Start a session',
      body: 'The first button starts today’s session in one tap. Custom session lets you choose the areas, question formats and length yourself.',
    },
    {
      target: 'today-class',
      title: 'Work from your lecturer',
      body: 'Anything your class has been set appears here, with its due date.',
    },
    {
      target: 'today-weakest',
      title: 'Your weakest structures',
      body: 'The ones you get wrong most often. Open one to read its card before it comes round again.',
    },
    {
      target: 'nav',
      title: 'Find your way around',
      body: 'The Atlas holds a card for every structure. Progress shows how each region is coming along. Account has your settings, and can replay these tours.',
    },
  ],
  atlas: [
    {
      target: 'atlas-search',
      title: 'Every structure, by name',
      body: 'Search the structures in your areas. Open one for its card: the facts, where they come from, and a picture you can turn.',
    },
    {
      target: 'atlas-filters',
      title: 'Narrow the list',
      body: 'Filter by area, by kind of structure or by what is due. Sort top to bottom down the body, by name, by level or by what is due soonest.',
    },
    {
      target: 'atlas-level',
      title: 'Your level',
      body: 'Each structure runs from Beginner to Master. It climbs as you keep getting it right, slips back if you keep missing it, and a Master left too long shows as fading.',
    },
    {
      target: 'atlas-quiz',
      title: 'Quiz what you see',
      body: 'Builds a session from the structures in the list. Filter first and it becomes a focused one.',
    },
  ],
  progress: [
    {
      target: 'progress-tabs',
      title: 'Two ways to look',
      body: 'Mastery is how far through your areas you are. Accuracy is how often you have been right, and how that has moved over time.',
    },
    {
      target: 'progress-regions',
      title: 'Region by region',
      body: 'How far through each region you are: how many of its structures sit at each level, from not met to Master.',
    },
    {
      target: 'progress-forecast',
      title: 'What is coming due',
      body: 'How many reviews fall due each day for the next fortnight, so a heavy day is never a surprise.',
      layouts: ['desktop'],
    },
    {
      target: 'progress-untouched',
      title: 'Not started yet',
      body: 'Muscles that have never come up in a session. One drill on them starts them on your reviews.',
      layouts: ['desktop'],
    },
    {
      target: 'progress-leeches',
      title: 'Leeches',
      body: 'The structures you keep losing. Drill them on their own until they stick.',
      layouts: ['desktop'],
    },
    {
      target: 'progress-achievements',
      title: 'Achievements',
      body: 'Milestones and streaks, and what the next one takes.',
    },
  ],
  setup: [
    {
      target: 'setup-formats',
      title: 'Which kinds of question',
      body: 'Choose the formats that go in: multiple choice, locate on the picture, typed names and the rest. Pick the ones your exam uses.',
    },
    {
      target: 'setup-length',
      title: 'How long',
      body: 'Pick a length, or type your own.',
    },
    {
      target: 'setup-srs',
      title: 'Spaced repetition',
      body: 'On, the session puts what is due first. Off, it picks at random from what you have chosen.',
    },
    {
      target: 'setup-begin',
      title: 'Begin',
      body: 'Builds the session from your choices.',
    },
  ],
  educator: [
    {
      target: 'edu-class',
      title: 'Your class',
      body: 'Every page here is for the class shown. With more than one class, switch between them here.',
    },
    {
      target: 'edu-join',
      title: 'Bring your students in',
      body: 'Share this code. Students enter it in the app to join the class, and their results start appearing here.',
    },
    {
      target: 'edu-nav',
      title: 'What each page shows',
      body: 'Structure weakness is what the class gets wrong most. Confusion pairs are the structures they mix up. Students has each person’s record, and Assignments is where you set work.',
    },
    {
      target: 'edu-new',
      title: 'Another class',
      body: 'Start a separate class for each cohort or module.',
    },
  ],
};

/** The steps of a tour that apply to this layout, before checking what is on the page. */
export function stepsFor(key: TourKey, layout: TourLayout): TourStep[] {
  return TOURS[key].filter((step) => !step.layouts || step.layouts.includes(layout));
}

export function shouldShowTour(key: TourKey): boolean {
  try {
    return localStorage.getItem(PREFIX + key) === null;
  } catch {
    // Storage unavailable: no tour, rather than the same tour on every visit.
    return false;
  }
}

/** Finishing and skipping both count: a skipped tour is one the student chose not to see. */
export function markTourSeen(key: TourKey): void {
  try {
    localStorage.setItem(PREFIX + key, 'seen');
  } catch {
    // Storage unavailable: shouldShowTour already says no.
  }
}

/** Account's "Replay tours": each screen's tour plays again on its next visit. */
export function resetTours(): void {
  try {
    for (const key of TOUR_KEYS) localStorage.removeItem(PREFIX + key);
  } catch {
    // Nothing to reset.
  }
}
