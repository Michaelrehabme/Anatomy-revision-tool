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
