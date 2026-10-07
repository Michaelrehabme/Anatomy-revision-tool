import { useEffect, useRef, useState } from 'react';
import type { Area } from '../../types/region';
import { AREA_LABELS } from '../../types/region';
import { freeAreaIsOnTheAccount, type UseEntitlement } from '../../hooks/useEntitlement';
import { CONFIRM_BODY, CONFIRM_TITLE } from '../Auth/emailConfirmCopy';

/**
 * The onboarding steps, shared by the desktop and mobile screens so the two
 * breakpoints tell the same story.
 *
 *   account  create a free account. Only for a visitor who is still a guest:
 *            the free area and every session need an account (owner's
 *            decision, 6 Oct 2026), so it comes FIRST — nothing after it can
 *            be kept without one.
 *            An account made with an email and password then CONFIRMS ITS
 *            ADDRESS before it goes on ("Check your inbox": owner's decision,
 *            7 Oct 2026, lib/emailVerification.ts). That is the second half
 *            of this step, not a step of its own: it keeps the step's number,
 *            and a Google account, which arrives confirmed, never sees it.
 *   areas    the real choice. On a free account, which ONE area is free.
 *   rating   how to answer the confidence question.
 *   rhythm   what a first session is.
 *
 * The same screen is also used with `areas` alone, for an account that has
 * been using the app and holds no free area yet (it skipped the choice when
 * skipping still gave it the shoulder).
 */
export type OnboardingStepKind = 'account' | 'areas' | 'rating' | 'rhythm';

export interface OnboardingStep {
  kind: OnboardingStepKind;
  kicker: string;
  title: string;
  body: string;
  cta: string;
}

const COUNT_WORDS = ['one', 'two', 'three', 'four'];

/** The words on each step. `free` is whether this account is on the free tier. */
function copyFor(kind: OnboardingStepKind, free: boolean): Omit<OnboardingStep, 'kind' | 'kicker'> {
  switch (kind) {
    case 'account':
      return {
        title: 'Create your free account',
        body: 'It is free and takes a minute. Your account keeps your free area and your progress, on any device you sign in on.',
        cta: 'Create account',
      };
    case 'areas':
      return free
        ? {
            title: 'Pick your free area',
            body: 'One area is yours for good: every structure in it, and every kind of question. Pick the one your course starts with. You can change it once, 30 days from now. A subscription opens the rest.',
            cta: 'Continue',
          }
        : {
            title: 'Which areas are you learning?',
            body: 'Pick the areas your course examines. Every session is built from your selection, so you will never be asked about the forearm if you did not ask for the forearm.',
            cta: 'Continue',
          };
    case 'rating':
      return {
        title: 'Answer honestly, not correctly',
        body: 'After each answer you rate how it felt. Hard brings a structure back tomorrow; Easy pushes it out for over a week. A lucky guess marked Easy only hurts you.',
        cta: 'Understood',
      };
    case 'rhythm':
      return {
        title: 'Ten minutes, most days',
        body: 'Short and daily beats an hour on Sunday. Your first session is eight questions from your area, multiple choice and locate-on-the-image, and nothing harder until you have seen how it works.',
        cta: 'Start learning',
      };
  }
}

export function onboardingSteps(kinds: readonly OnboardingStepKind[], free: boolean): OnboardingStep[] {
  return kinds.map((kind, i) => ({
    kind,
    kicker:
      kinds.length === 1
        ? 'One thing first'
        : `Step ${COUNT_WORDS[i] ?? i + 1} of ${COUNT_WORDS[kinds.length - 1] ?? kinds.length}`,
    ...copyFor(kind, free),
  }));
}

/**
 * What the screen is showing, which is not always the step's own content:
 *
 *   account-form  the sign-up / sign-in form.
 *   setting-up    the account exists and what it holds is being read.
 *   confirm       "Check your inbox": the account must confirm its address.
 *   step          the step itself (the areas, the two explanations).
 */
export type OnboardingStage = 'account-form' | 'setting-up' | 'confirm' | 'step';

export interface OnboardingFlowInput {
  access: UseEntitlement;
  initialAreas: readonly Area[];
  /** Which steps to show. Left out: every step this visitor needs. */
  only?: readonly OnboardingStepKind[];
  /**
   * Called with the areas chosen, or with null when the visitor turned out
   * to have an account that is already set up (they signed in at the account
   * step): there is nothing to choose and nothing to explain again.
   */
  onDone: (areas: Area[] | null) => void;
}

/**
 * Everything the two onboarding screens share: which step is showing, what
 * has been picked, and what the buttons do.
 */
export function useOnboardingFlow({ access, initialAreas, only, onDone }: OnboardingFlowInput) {
  // Decided ONCE, as the screen opens. A guest stops being a guest half way
  // through the account step, and a list of steps that shrank under them
  // would skip the next one.
  const [kinds] = useState<readonly OnboardingStepKind[]>(
    () => only ?? [...(access.guest ? (['account'] as const) : []), 'areas', 'rating', 'rhythm'],
  );
  const [index, setIndex] = useState(0);
  const free = access.tier === 'free';
  // One free area, so one choice: picking another replaces it. An account
  // with every area may tick as many as it is studying.
  const single = free;
  const [selected, setSelected] = useState<Set<Area>>(() => new Set(single ? initialAreas.slice(0, 1) : initialAreas));

  const steps = onboardingSteps(kinds, free);
  const step = steps[index];
  const [firstPick] = [...selected];

  const toggle = (area: Area) => {
    setSelected((prev) => {
      if (single) return new Set(prev.has(area) ? [] : [area]);
      const next = new Set(prev);
      if (next.has(area)) next.delete(area);
      else next.add(area);
      return next;
    });
  };

  /**
   * Leaving the choice unmade. Only where that leaves the student with
   * something: an account with every area (skip keeps them all in play), or a
   * build with no accounts, where the free area still defaults. A free
   * account must choose — there is no default any more.
   */
  const canSkipAreas = !free || !freeAreaIsOnTheAccount();

  const next = () => {
    if (index >= steps.length - 1) onDone([...selected]);
    else setIndex((i) => i + 1);
  };

  // THE ACCOUNT STEP ENDS BY ITSELF. The form creates the account (or signs
  // in to one); what happens next depends on what that account already has,
  // which is known only once its entitlement has been read. An account that
  // is already set up — a free area chosen, or every area — is somebody
  // returning on a new device: straight in. Otherwise, on to the choice.
  const [accountMade, setAccountMade] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;

  // WHAT IS ON SCREEN. Before the choice of area can be made the visitor
  // must be an account, and a free account must have confirmed its address;
  // whichever of those is missing is shown in place of the step, whether the
  // step is "account" (a new visitor) or "areas" (somebody who reloaded the
  // page half way through, or took their address off to use another one).
  const beforeTheChoice = step.kind === 'account' || step.kind === 'areas';
  const guestHere = (access.guest ?? false) && freeAreaIsOnTheAccount();
  const stage: OnboardingStage = !beforeTheChoice
    ? 'step'
    : guestHere
      ? (accountMade ? 'setting-up' : 'account-form')
      : access.needsEmailConfirmation
        ? 'confirm'
        : step.kind === 'account'
          ? (accountMade ? 'setting-up' : 'account-form')
          : 'step';
  // What stands in for a step keeps the step's number and takes its own
  // words: the confirmation's, or — for an account that took its address off
  // again on the "areas" step, and is a guest once more — the account step's.
  const current: OnboardingStep =
    stage === 'confirm'
      ? { ...step, title: CONFIRM_TITLE, body: CONFIRM_BODY }
      : stage !== 'step' && step.kind !== 'account'
        ? { ...step, ...copyFor('account', free) }
        : step;

  useEffect(() => {
    if (current.kind !== 'account' || !accountMade) return;
    if (access.guest || access.loading || access.freeAreaSaving) return;
    // An unconfirmed address: the step waits on "Check your inbox". When the
    // address is confirmed the entitlement is read again, and this runs again.
    if (access.needsEmailConfirmation) return;
    if (access.freeArea || access.tier !== 'free') done.current(null);
    else setIndex((i) => i + 1);
  }, [current.kind, accountMade, access.guest, access.loading, access.freeAreaSaving, access.needsEmailConfirmation, access.freeArea, access.tier]);

  // AN ACCOUNT THAT HAS ALREADY CHOSEN IS NOT ASKED AGAIN. Onboarding can be
  // met a second time by an account that is signed in (the device's
  // "onboarded" flag was cleared and the sign-in was not). Its free area is
  // on the account; asking "pick your free area" would either be ignored or,
  // thirty days on, quietly spend its one change. The step is passed over
  // with the area it has. Never while the choice is being made HERE: the
  // account is given nothing until the last step is done.
  // Nor before the address is confirmed: until then the account holds nothing,
  // and a choice waiting on the device has not been moved up to it.
  const settled =
    single && freeAreaIsOnTheAccount() && !access.guest && !access.loading && !access.needsEmailConfirmation && !access.freeAreaSaving
      ? (access.freeArea?.area ?? null)
      : null;
  useEffect(() => {
    if (current.kind !== 'areas' || !settled) return;
    setSelected(new Set([settled]));
    if (index >= kinds.length - 1) done.current([settled]);
    else setIndex((i) => i + 1);
  }, [current.kind, settled, index, kinds.length]);

  return {
    steps,
    index,
    current,
    selected,
    firstPick,
    single,
    toggle,
    next,
    canSkipAreas,
    /** The areas step may only be left with something chosen. */
    canContinue: current.kind !== 'areas' || selected.size > 0,
    /** Skip: past the explanations with what has been chosen, or past the choice where that is allowed. */
    skip: () => onDone(current.kind === 'areas' ? [] : [...selected]),
    canSkip: current.kind !== 'account' && (current.kind !== 'areas' || canSkipAreas),
    /** The line under the buttons on the areas step. */
    areaNote:
      current.kind !== 'areas' || stage !== 'step'
        ? null
        : free
          ? firstPick
            ? `${AREA_LABELS[firstPick]} will be your free area.`
            : canSkipAreas
              ? 'Skip keeps the shoulder as your free area.'
              : null
          : 'Skip keeps every area in play.',
    onAccountMade: () => setAccountMade(true),
    /** The account exists and its details are being read. */
    settingUp: accountMade,
    /** What to draw: the form, the wait, "Check your inbox", or the step. */
    stage,
    /** "Use a different email" has made them a guest again: back to the form. */
    onDifferentEmail: () => setAccountMade(false),
  };
}
