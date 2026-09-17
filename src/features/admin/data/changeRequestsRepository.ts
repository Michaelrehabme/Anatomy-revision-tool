import { collection, doc, getDocs, query, orderBy, setDoc } from 'firebase/firestore';
import { getDb } from '../../anatomy-revision/data/firebase';
import { CHANGE_REQUESTS_SEED } from './changeRequests.seed';
import { overlayChangeRequests } from '../lib/changeRequestOverlay';
import type { ChangeRequest, ChangeStatus, NewChangeRequestInput } from '../types/changeRequest';
import type { ChecklistDone } from '../lib/checklist';

/**
 * Admin-only collection — see firestore.rules for the request.auth.token.admin
 * == true rule that actually enforces this; nothing client-side does.
 * `ref` (e.g. "CR-004") is used as the Firestore document id, which is what
 * makes the seed script idempotent for free: creating a doc whose id already
 * exists is a no-op check away, not a query.
 */
const COLLECTION = 'changeRequests';

export interface ChangeRegisterRead {
  items: ChangeRequest[];
  /**
   * The Firestore read failed, so these are the git definitions with no stored
   * state on them — right status for a fresh register, but any status, notes or
   * ticks an admin has saved are missing, and writing from this view would
   * overwrite them. The caller must say so and disable the controls.
   */
  stateUnavailable: boolean;
  /** Why, for the message — the Firebase error, not something invented here. */
  stateError?: string;
}

/**
 * DEFINITIONS come from git, STATE from Firestore — see lib/changeRequestOverlay
 * for the field-by-field split and why the register no longer depends on the
 * seed script having been run. The seed script still writes whole documents
 * (they stay self-describing for anyone reading the Firestore console); reads
 * just don't rely on it having happened.
 *
 * A failed read is degraded, never fatal. The backlog is version-controlled, so
 * there is always something correct to render, and a blank screen is the worst
 * possible answer to "is Firestore reachable?" — it looks identical to an empty
 * register and names no cause. Offline, unconfigured, or signed in without the
 * admin claim, you get the list plus a line saying which.
 */
export async function listChangeRequests(): Promise<ChangeRegisterRead> {
  const fromSeed = () => overlayChangeRequests(CHANGE_REQUESTS_SEED, []);

  try {
    const snapshot = await getDocs(query(collection(getDb(), COLLECTION), orderBy('ref', 'asc')));
    const stored = snapshot.docs.map((d) => d.data() as ChangeRequest);
    return { items: overlayChangeRequests(CHANGE_REQUESTS_SEED, stored), stateUnavailable: false };
  } catch (error) {
    return {
      items: fromSeed(),
      stateUnavailable: true,
      stateError: error instanceof Error ? error.message : String(error),
    };
  }
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

/**
 * Writes the whole tick record rather than a single field path, because
 * unticking has to REMOVE a key and a merge write cannot delete one. The
 * record is a handful of short strings, so replacing it wholesale costs
 * nothing and keeps "only what is done is stored" true.
 */
export async function updateChangeRequestChecklist(ref: string, checklistDone: ChecklistDone): Promise<void> {
  await setDoc(doc(getDb(), COLLECTION, ref), { checklistDone }, { merge: true });
}
