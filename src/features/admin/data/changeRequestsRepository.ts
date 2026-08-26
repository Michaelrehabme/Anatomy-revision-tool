import { collection, doc, getDocs, query, orderBy, setDoc } from 'firebase/firestore';
import { getDb } from '../../anatomy-revision/data/firebase';
import type { ChangeRequest, ChangeStatus, NewChangeRequestInput } from '../types/changeRequest';

/**
 * Admin-only collection — see firestore.rules for the request.auth.token.admin
 * == true rule that actually enforces this; nothing client-side does.
 * `ref` (e.g. "CR-004") is used as the Firestore document id, which is what
 * makes the seed script idempotent for free: creating a doc whose id already
 * exists is a no-op check away, not a query.
 */
const COLLECTION = 'changeRequests';

export async function listChangeRequests(): Promise<ChangeRequest[]> {
  const snapshot = await getDocs(query(collection(getDb(), COLLECTION), orderBy('ref', 'asc')));
  return snapshot.docs.map((d) => d.data() as ChangeRequest);
}

export async function createChangeRequest(input: NewChangeRequestInput, now: Date = new Date()): Promise<void> {
  const record: ChangeRequest = {
    ...input,
    status: 'new',
    createdAt: now.toISOString(),
    startedAt: null,
    completedAt: null,
  };
  await setDoc(doc(getDb(), COLLECTION, record.ref), record);
}

export interface StatusUpdate {
  status: ChangeStatus;
  startedAt: string | null;
  completedAt: string | null;
}

export async function updateChangeRequestStatus(ref: string, update: StatusUpdate): Promise<void> {
  await setDoc(doc(getDb(), COLLECTION, ref), update, { merge: true });
}

export async function updateChangeRequestNotes(ref: string, notes: string): Promise<void> {
  await setDoc(doc(getDb(), COLLECTION, ref), { notes }, { merge: true });
}
