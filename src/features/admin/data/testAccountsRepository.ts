import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDb } from '../../anatomy-revision/data/firebase';

/**
 * adminTestAccounts/{uid} — accounts the owner has marked as test or internal,
 * so they can be left out of the Users counts and the Analytics figures.
 *
 * Admin-only at the rules layer (firestore.rules), like changeRequests. It is
 * kept apart from users/{uid} on purpose: an admin may not write a student's
 * profile document, and a student should not be able to mark themselves.
 *
 * A document exists only while the account is marked; unmarking deletes it.
 * The email and name are a convenience for reading the collection in the
 * console, not something the app relies on.
 */
const COLLECTION = 'adminTestAccounts';

export async function listTestAccountIds(): Promise<Set<string>> {
  const snapshot = await getDocs(collection(getDb(), COLLECTION));
  return new Set(snapshot.docs.map((d) => d.id));
}

export async function setTestAccount(
  uid: string,
  marked: boolean,
  who: { email: string | null; displayName: string | null },
): Promise<void> {
  const ref = doc(getDb(), COLLECTION, uid);
  if (marked) {
    await setDoc(ref, { email: who.email, displayName: who.displayName, markedAt: serverTimestamp() });
  } else {
    await deleteDoc(ref);
  }
}
