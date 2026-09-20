import type { Area } from '../types/region';
import type { FreeAreaChoice } from './entitlement';
import { normaliseAreas } from '../types/region';

/**
 * Small per-device study preferences, kept in localStorage alongside the
 * onboarding flag in App.tsx rather than in the repository. These are
 * settings, not progress: they describe how this person likes to study, they
 * are cheap to re-pick if a device changes, and putting them in Firestore
 * would mean a read before a session could start.
 */

const PREFIX = 'anatomy-revision:v1:';
const LEARN_CARD_ATTEMPTS_KEY = `${PREFIX}oinaLearnCardAttempts`;

/**
 * How many attempts at an OINA fact are preceded by its teaching flashcard.
 * 0 turns the cards off entirely; otherwise the card also comes back after a
 * wrong answer, however well known the fact was.
 *
 * The default is 3 rather than 1 because it is the safer setting for someone
 * meeting a muscle for the first time — a student who already knows the
 * material finds repeats tedious, but one who does not cannot recall an
 * attachment they have been shown once.
 */
export const LEARN_CARD_ATTEMPT_OPTIONS = [0, 1, 3, 5] as const;
export const DEFAULT_LEARN_CARD_ATTEMPTS = 3;

export const LEARN_CARD_ATTEMPT_LABELS: Record<number, string> = {
  0: 'Never',
  1: 'Once',
  3: '3 times',
  5: '5 times',
};

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // Private browsing / storage disabled — fall back to the default rather than crashing setup.
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage full or unavailable; the choice just won't persist past this session.
  }
}

export function getLearnCardAttempts(): number {
  const raw = read(LEARN_CARD_ATTEMPTS_KEY);
  if (raw === null) return DEFAULT_LEARN_CARD_ATTEMPTS;
  const parsed = Number.parseInt(raw, 10);
  // A hand-edited or stale value must not silently disable teaching.
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : DEFAULT_LEARN_CARD_ATTEMPTS;
}

export function setLearnCardAttempts(value: number): void {
  write(LEARN_CARD_ATTEMPTS_KEY, String(Math.max(0, Math.trunc(value))));
}

const PREFERRED_AREAS_KEY = `${PREFIX}preferredAreas`;

/**
 * The areas the student said they are studying, chosen during onboarding and
 * editable from the area picker. Empty means no preference — every area. This
 * is what "Start review" and the custom-session picker default to, so a
 * first-year revising the shoulder is not asked about the tarsals.
 */
export function getPreferredAreas(): Area[] {
  const raw = read(PREFERRED_AREAS_KEY);
  if (raw === null) return [];
  try {
    // normaliseAreas keeps only real areas, in canonical order, without duplicates —
    // a stale or hand-edited value must never produce an unfilterable session — and
    // expands one that has since been split, so a student who chose Back & Core before
    // CR-032 keeps the whole spine rather than silently getting every area.
    return normaliseAreas(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function setPreferredAreas(areas: readonly Area[]): void {
  write(PREFERRED_AREAS_KEY, JSON.stringify(normaliseAreas([...areas])));
}

const FREE_AREA_KEY = `${PREFIX}freeArea`;

/**
 * Which area this device's free tier opens, and when it was chosen.
 *
 * Client-side, like every other preference here, and deliberately so: it is a
 * CHOICE, not a grant. The grant is the entitlement, which only the server
 * writes (see lib/entitlement.ts). Someone who edits this key swaps which one
 * area is free, which is the same thing the app offers them every 30 days
 * anyway — they cannot give themselves a second one.
 */
export function getFreeAreaChoice(): FreeAreaChoice | null {
  const raw = read(FREE_AREA_KEY);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as { area?: unknown; chosenAt?: unknown };
    const [area] = normaliseAreas([parsed.area]);
    if (!area) return null;
    // A missing or junk timestamp reads as "chosen at the epoch", which makes
    // the area switchable now rather than trapping the student.
    const chosenAt = typeof parsed.chosenAt === 'string' ? parsed.chosenAt : new Date(0).toISOString();
    return { area, chosenAt };
  } catch {
    return null;
  }
}

export function setFreeAreaChoice(area: Area, now: Date = new Date()): void {
  write(FREE_AREA_KEY, JSON.stringify({ area, chosenAt: now.toISOString() }));
}
