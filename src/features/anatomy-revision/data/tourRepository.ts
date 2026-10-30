import { deleteField, doc, setDoc } from 'firebase/firestore';
import { getDb, getFirebaseAuth } from './firebase';
import { absorbSeenTours, type TourKey } from '../lib/tours';

/**
 * Which tours this account has seen, kept on users/{uid} as `toursSeen`
 * (owner, 30 Oct 2026: a tour seen on a phone should not play again on a
 * laptop). Written here; read back for free with the profile the app already
 * fetches on open (entitlementRepository.readAccess hands it to syncSeenTours),
 * so it costs one small write per tour and no reads at all.
 *
 * Fire and forget. A tour is a nicety: a write that fails, or waits for a
 * connection, leaves the local record in charge, which is what happened
 * before this existed. Nothing here is awaited by the screen.
 *
 * Only against the real database. Local mode and the educator demo keep the
 * record on the device alone.
 */
const USES_FIRESTORE = (import.meta.env.VITE_PERSISTENCE ?? 'local') === 'firestore';

function currentUid(): string | null {
  if (!USES_FIRESTORE) return null;
  try {
    return getFirebaseAuth().currentUser?.uid ?? null;
  } catch {
    return null;
  }
}

/** Merged, so nothing else on the profile is touched, and so it creates the profile if none exists yet. */
export function saveSeenTour(key: TourKey): void {
  const uid = currentUid();
  if (!uid) return;
  setDoc(doc(getDb(), 'users', uid), { toursSeen: { [key]: true } }, { merge: true }).catch(() => undefined);
}

/**
 * Called with the profile's `toursSeen` as the app opens: the account's record
 * comes down, and anything this device saw before the account kept one goes up.
 */
export function syncSeenTours(stored: unknown): void {
  const missing = absorbSeenTours(stored);
  const uid = currentUid();
  if (!uid || missing.length === 0) return;
  const toursSeen = Object.fromEntries(missing.map((key) => [key, true]));
  setDoc(doc(getDb(), 'users', uid), { toursSeen }, { merge: true }).catch(() => undefined);
}

/** Account's "Replay the tours": cleared on the account too, or the next device would read them back as seen. */
export function clearSeenTours(): void {
  const uid = currentUid();
  if (!uid) return;
  setDoc(doc(getDb(), 'users', uid), { toursSeen: deleteField() }, { merge: true }).catch(() => undefined);
}
