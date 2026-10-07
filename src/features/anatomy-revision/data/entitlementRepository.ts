import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDb } from './firebase';
import type { Area } from '../types/region';
import type { Entitlement, FreeAreaChoice } from '../lib/entitlement';
import { accessRecord, cohortIdOf, entitlementForDisplay, type StoredAccess } from '../lib/entitlementRecord';
import { ownFullAccess } from '../../educator/lib/teachingAccess';
import { parseStoredFreeArea } from '../lib/freeAreaRecord';

/**
 * Reading what an account may reach off users/{uid} — and writing the ONE
 * thing about it a student decides for themselves: which area is free.
 *
 * THE ENTITLEMENT IS READ ONLY HERE, and permanently so. firestore.rules
 * requires `entitlement` to be byte-identical across any client update, so a
 * write from this file would be refused — but the more important reason is
 * that somebody looking for "where do we grant access" should find nothing in
 * the client at all. Granting happens in a payment webhook through the Admin
 * SDK, which bypasses rules, and that is the only place it happens.
 *
 * THE FREE AREA IS A CHOICE, NOT A GRANT, which is why it may be written from
 * here (saveFreeArea). What it may be written TO is the rules' business, not
 * this file's: once, then once more thirty days later, stamped by the server's
 * clock. A write the rules refuse is refused whatever this file intended.
 *
 * How the documents are read into an answer is lib/entitlementRecord.ts, which
 * the content function shares, so the app and the server cannot disagree.
 */

/**
 * What users/{uid} — and the student's class, if it is licensed — say.
 *
 * Throws on a failed read rather than returning nothing, so the caller can
 * tell "no entitlement" from "could not find out". useEntitlement treats both
 * as free, but it does so knowingly — a repository that swallowed the
 * difference would take that choice away from every future caller.
 */
export async function readAccess(uid: string): Promise<StoredAccess> {
  const snapshot = await getDoc(doc(getDb(), 'users', uid));
  // No profile yet: nothing held, and not an account from before a confirmed
  // address was asked for (lib/emailVerification.ts).
  if (!snapshot.exists()) return { entitlement: null, freeArea: null, predatesVerification: false };

  // 'estimate' so a choice written a moment ago, and not yet confirmed by the
  // server, reads with a date rather than with none.
  const user = snapshot.data({ serverTimestamps: 'estimate' }) as Record<string, unknown>;

  // A student can hold both: their own subscription and a seat on their
  // university's licence. The licence is two documents the student is already
  // allowed to read; see licenceEntitlement for why it is derived, not stored.
  const cohortId = cohortIdOf(user);
  const cohortSnap = cohortId ? await getDoc(doc(getDb(), 'cohorts', cohortId)) : null;
  const cohort = cohortSnap?.exists() ? (cohortSnap.data() as Record<string, unknown>) : null;

  const record = accessRecord(user, cohort);
  return { entitlement: entitlementForDisplay(record), freeArea: record.freeArea, predatesVerification: record.predatesVerification };
}

/**
 * Whether the entitlement stored ON THIS ACCOUNT is in force: what teaching
 * needs (educator/lib/teachingAccess.ts). Not the same question as
 * readAccess answers — a member of a licensed class holds every area through
 * the class, and nothing on their own account.
 *
 * Throws on a failed read, for the same reason readAccess does.
 */
export async function readOwnFullAccess(uid: string): Promise<boolean> {
  const snapshot = await getDoc(doc(getDb(), 'users', uid));
  return snapshot.exists() && ownFullAccess(snapshot.data() as Record<string, unknown>);
}

/** The entitlement in force for this user, or null when they have none. */
export async function readEntitlement(uid: string): Promise<Entitlement | null> {
  return (await readAccess(uid)).entitlement;
}

/**
 * Stores the free area and returns it as the server now holds it.
 *
 * `switches` is the count AFTER this write: 0 for a first pick, 1 for the one
 * change (or for a first pick moved up from a device that had already used
 * it). The date is the server's — a client date would be refused by the rules,
 * which is the point of them.
 *
 * Merged, so nothing else on the profile is touched, and so it creates the
 * profile if a guest picks before one exists.
 *
 * Rejects if the rules refuse it (chosen already, thirty days not up, the
 * change already used) and does not resolve while the device is offline —
 * Firestore holds the write until it can ask.
 */
export async function saveFreeArea(uid: string, area: Area, switches: 0 | 1): Promise<FreeAreaChoice> {
  const ref = doc(getDb(), 'users', uid);
  await setDoc(ref, { freeArea: { area, chosenAt: serverTimestamp(), switches } }, { merge: true });
  const stored = parseStoredFreeArea((await getDoc(ref)).data({ serverTimestamps: 'estimate' })?.freeArea);
  if (!stored) throw new Error('The free area was written but could not be read back.');
  return stored;
}
