import { collection, doc, getDoc, getDocs, Timestamp } from 'firebase/firestore';
import { getDb } from '../../anatomy-revision/data/firebase';
import type { AdminUserProfile } from '../types/adminUser';

function toIsoOrNull(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

function toProfile(uid: string, data: Record<string, unknown>): AdminUserProfile {
  return {
    uid,
    displayName: (data.displayName as string | null) ?? null,
    email: (data.email as string | null) ?? null,
    createdAt: toIsoOrNull(data.createdAt),
    lastActiveAt: toIsoOrNull(data.lastActiveAt),
  };
}

/** Single-profile fetch for the /admin/users/:uid detail page — avoids listing every user just to view one. */
export async function getUserProfile(uid: string): Promise<AdminUserProfile | null> {
  const snapshot = await getDoc(doc(getDb(), 'users', uid));
  return snapshot.exists() ? toProfile(snapshot.id, snapshot.data()) : null;
}

/**
 * Admin-only read of every users/{uid} profile doc — see firestore.rules'
 * `request.auth.token.admin == true` exception on the users collection.
 * Per-user derived stats (attempts, accuracy, streak) are NOT computed here:
 * they're layered on top via the existing AnatomyRepository
 * (listAttempts/listSessionSummaries), reusing the same queries the
 * student-facing Progress screen already relies on rather than duplicating
 * Firestore query logic in the admin feature.
 */
export async function listUserProfiles(): Promise<AdminUserProfile[]> {
  const snapshot = await getDocs(collection(getDb(), 'users'));
  return snapshot.docs.map((d) => toProfile(d.id, d.data()));
}
