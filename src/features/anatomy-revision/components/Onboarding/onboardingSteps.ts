/**
 * The three onboarding steps, shared by the desktop and mobile screens so the
 * two breakpoints tell the same story. Step one is a real choice — the area
 * picker — not a promise of one: the previous copy said "Choose regions" and
 * then advanced, and the first session it led to drew from the whole body.
 */
export interface OnboardingStep {
  kicker: string;
  title: string;
  body: string;
  cta: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    kicker: 'Step one of three',
    title: 'Which areas are you learning?',
    body: 'Pick the areas your course examines. Every session is built from your selection, so you will never be asked about the forearm if you did not ask for the forearm. You can change this any time.',
    cta: 'Continue',
  },
  {
    kicker: 'Step two of three',
    title: 'Answer honestly, not correctly',
    body: 'After each answer you rate how it felt. Hard brings a structure back tomorrow; Easy pushes it out for over a week. A lucky guess marked Easy only hurts you.',
    cta: 'Understood',
  },
  {
    kicker: 'Step three of three',
    title: 'Ten minutes, most days',
    body: 'Short and daily beats an hour on Sunday. Your first session is eight questions from your areas, multiple choice and locate-on-the-image, and nothing harder until you have seen how it works.',
    cta: 'Start learning',
  },
];
