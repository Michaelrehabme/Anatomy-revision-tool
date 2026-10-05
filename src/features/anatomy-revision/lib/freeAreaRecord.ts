import { normaliseAreas } from '../types/region';
import { FREE_AREA_SWITCHES_ALLOWED, type FreeAreaChoice } from './entitlement';

/**
 * users/{uid}.freeArea, read into the shape the rest of the app uses
 * (docs/DESIGN-CONTENT-BEHIND-SERVER.md, step 1).
 *
 * STORED AS  { area, chosenAt, switches }  where `chosenAt` is a Firestore
 * timestamp set by the server. firestore.rules is what keeps it honest: one
 * creation, one change thirty days on, and `chosenAt` always the server's
 * clock. This file only reads.
 *
 * PURE, AND FREE OF ANY FIREBASE IMPORT, because two very different callers
 * hand it the same field: the browser, which gets the web SDK's Timestamp, and
 * the content function, which gets the Admin SDK's. Both have `toMillis()`,
 * and that is all that is asked of them here — so neither SDK is dragged into
 * the other's bundle, and the function decides from exactly the reading the
 * app shows the student.
 */

/** Milliseconds from whatever a stored `chosenAt` turns out to be, or null. */
function millisOf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const at = Date.parse(value);
    return Number.isNaN(at) ? null : at;
  }
  if (value && typeof value === 'object') {
    const v = value as { toMillis?: unknown; seconds?: unknown; _seconds?: unknown };
    if (typeof v.toMillis === 'function') {
      const at = (v as { toMillis: () => unknown }).toMillis();
      return typeof at === 'number' && Number.isFinite(at) ? at : null;
    }
    // A timestamp that has been through JSON (an export, a test fixture).
    const seconds = typeof v.seconds === 'number' ? v.seconds : typeof v._seconds === 'number' ? v._seconds : null;
    if (seconds !== null) return seconds * 1000;
  }
  return null;
}

/**
 * The stored choice, or null when there is none worth the name.
 *
 * `now` stands in for a `chosenAt` that is not there yet. The web SDK shows a
 * write it has not had confirmed with the server timestamp still empty, and
 * "chosen just now" is the truth of that moment. For anything else unreadable
 * the answer is also "just now" — the reverse of the device store, which reads
 * junk as the epoch so nobody is trapped. Here the rules cannot have let junk
 * in, so an unreadable date means a hand edit through the Admin SDK, and the
 * safe reading of a record nobody can vouch for is the one that does not open
 * a second area early.
 *
 * A missing or impossible count reads as "already changed", as it does on the
 * device (lib/preferences.ts): erring towards the paid product.
 */
export function parseStoredFreeArea(raw: unknown, now: Date = new Date()): FreeAreaChoice | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { area?: unknown; chosenAt?: unknown; switches?: unknown };
  const [area] = normaliseAreas([r.area]);
  if (!area || area !== r.area) return null;

  const at = millisOf(r.chosenAt) ?? now.getTime();
  const switches =
    typeof r.switches === 'number' && Number.isInteger(r.switches) && r.switches >= 0
      ? r.switches
      : FREE_AREA_SWITCHES_ALLOWED;

  return { area, chosenAt: new Date(at).toISOString(), switches };
}

/**
 * The count a device's old choice moves up with: 0 if its one change is still
 * unused, otherwise 1. Never more — the rules accept only those two for a
 * first write, and a count above the limit says nothing a 1 does not.
 */
export function switchesToMigrate(choice: FreeAreaChoice): 0 | 1 {
  return choice.switches >= FREE_AREA_SWITCHES_ALLOWED ? 1 : 0;
}
