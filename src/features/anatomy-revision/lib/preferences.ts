import type { Area } from '../types/region';
import type { FreeAreaChoice } from './entitlement';
import { normaliseAreas } from '../types/region';
import {
  CONTRAST_KEY,
  THEME_KEY,
  asContrastPreference,
  asThemePreference,
  type ContrastPreference,
  type ThemePreference,
} from './theme';

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
 * WHERE THE CHOICE LIVES DEPENDS ON THE BUILD. With accounts
 * (VITE_PERSISTENCE=firestore) it lives on users/{uid}.freeArea, where
 * firestore.rules holds it to one choice and one change, and this key is a
 * COPY of it: there so the first paint and an offline start show the right
 * area, and — for a choice made before the move — the value that is moved up
 * on the next load (hooks/useEntitlement.ts). Editing the copy changes what
 * this device draws until the account is next read; it changes nothing the
 * server will serve.
 *
 * Without accounts (the demo, the tests, a dev server with no Firebase
 * project) this key is the choice itself, as it always was.
 */
export function getFreeAreaChoice(): FreeAreaChoice | null {
  const raw = read(FREE_AREA_KEY);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as { area?: unknown; chosenAt?: unknown; switches?: unknown };
    const [area] = normaliseAreas([parsed.area]);
    if (!area) return null;
    // A missing or junk timestamp reads as "chosen at the epoch", which makes
    // the area switchable now rather than trapping the student.
    const chosenAt = typeof parsed.chosenAt === 'string' ? parsed.chosenAt : new Date(0).toISOString();
    // A missing count reads as "already switched", not "never switched": the
    // only records without one were written before the limit existed, and
    // erring towards the paid product beats handing out an extra free area.
    const switches = typeof parsed.switches === 'number' ? parsed.switches : 1;
    return { area, chosenAt, switches };
  } catch {
    return null;
  }
}

export function setFreeAreaChoice(area: Area, switches: number, now: Date = new Date()): void {
  write(FREE_AREA_KEY, JSON.stringify({ area, chosenAt: now.toISOString(), switches }));
}

/** Keeps a copy of the choice as the account holds it, date and count included. */
export function storeFreeAreaChoice(choice: FreeAreaChoice): void {
  write(FREE_AREA_KEY, JSON.stringify({ area: choice.area, chosenAt: choice.chosenAt, switches: choice.switches }));
}

/**
 * Appearance. The keys and the resolution rules live in lib/theme.ts, because
 * the bootstrap script in index.html has to read the same keys before any
 * module loads — see the note there.
 */
export function getThemePreference(): ThemePreference {
  return asThemePreference(read(THEME_KEY));
}

export function setThemePreference(preference: ThemePreference): void {
  write(THEME_KEY, preference);
}

export function getContrastPreference(): ContrastPreference {
  return asContrastPreference(read(CONTRAST_KEY));
}

export function setContrastPreference(preference: ContrastPreference): void {
  write(CONTRAST_KEY, preference);
}

const SHOW_LATIN_KEY = `${PREFIX}showLatin`;

/**
 * Whether structure cards show the Latin (Terminologia Anatomica 2) name
 * under the English one. Off by default: most students learn and are
 * examined in English, and a second name on every card is noise to them.
 */
export function getShowLatin(): boolean {
  return read(SHOW_LATIN_KEY) === 'true';
}

export function setShowLatin(show: boolean): void {
  write(SHOW_LATIN_KEY, show ? 'true' : 'false');
}

const ATLAS_SORT_KEY = `${PREFIX}atlasSort`;
const ATLAS_PANEL_KEY = `${PREFIX}atlasPanelOpen`;

/**
 * How this person likes the atlas ordered, as one of the ids in
 * lib/atlasList.ts ATLAS_SORTS.
 *
 * The sort persists but the filters do not, and the split is deliberate: a
 * sort is a reading preference that stays true across visits, where a filter
 * is a question being asked right now. Coming back to the atlas tomorrow
 * still narrowed to "unseen knee ligaments" would look like a bug. The one
 * filter worth remembering — which areas this student studies — already has a
 * durable home in preferredAreas above.
 *
 * Returned raw rather than validated against ATLAS_SORTS, which would make
 * this module depend on atlasList: sortById() there resolves a stale or
 * hand-edited id to the default, so the validation lives with the list of
 * ids it has to agree with.
 */
export function getAtlasSortId(): string | null {
  return read(ATLAS_SORT_KEY);
}

export function setAtlasSortId(id: string): void {
  write(ATLAS_SORT_KEY, id);
}

/**
 * Whether the desktop filter column is open. Desktop only — the mobile
 * equivalent is a modal drawer, and restoring it open over the list on
 * arrival would mean every visit starts behind something to dismiss.
 *
 * Defaults to open: a filter panel nobody can see is a filter panel nobody
 * uses, and the point of making it collapsible is reclaiming the width on
 * demand, not hiding the feature.
 */
export function getAtlasPanelOpen(): boolean {
  return read(ATLAS_PANEL_KEY) !== 'false';
}

export function setAtlasPanelOpen(open: boolean): void {
  write(ATLAS_PANEL_KEY, String(open));
}

const IMAGE_VARIANT_KEY = `${PREFIX}imageVariant`;

/**
 * Whether the SECOND render of a picture is the one to show, per kind of
 * variant ('hidden': the covering bone gone rather than ghosted; 'solid': the
 * bones solid rather than see-through). See ImageViewer.
 *
 * False — the ghosted render — until the student says otherwise. One key holds
 * every kind as a small object, and anything unreadable in it reads as "no
 * choice made" rather than as a choice.
 */
function readImageVariants(): Record<string, boolean> {
  try {
    const parsed: unknown = JSON.parse(read(IMAGE_VARIANT_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function getImageVariantChoice(kind: string): boolean {
  return readImageVariants()[kind] === true;
}

export function setImageVariantChoice(kind: string, on: boolean): void {
  write(IMAGE_VARIANT_KEY, JSON.stringify({ ...readImageVariants(), [kind]: on }));
}

const LOCATE_WITHOUT_PICTURE_KEY = `${PREFIX}locateWithoutPicture`;

/**
 * Whether locate questions open on the route that needs no picture — the
 * question asked in words, or a list of names where it cannot be — instead of
 * on the plate (docs/accessibility-locate.md).
 *
 * For someone who cannot see the plate, the plate is a control they have to
 * get past on every locate question; this saves them pressing "Answer without
 * the picture" each time. Off unless chosen: the picture is the exercise, and
 * the words are a different one. It changes only which route a question OPENS
 * on — the question set is the same either way, and the other route stays one
 * button away.
 */
export function getLocateWithoutPicture(): boolean {
  return read(LOCATE_WITHOUT_PICTURE_KEY) === 'true';
}

export function setLocateWithoutPicture(on: boolean): void {
  write(LOCATE_WITHOUT_PICTURE_KEY, on ? 'true' : 'false');
}
