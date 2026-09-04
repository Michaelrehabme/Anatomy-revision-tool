import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { getDb } from '../anatomy-revision/data/firebase';
import type { RoleGrant, UserRole } from './types';

/**
 * roles/{uid} reads and writes. Every write here is admin-only at the rules
 * layer (see firestore.rules) — this module cannot grant anything a signed-in
 * admin couldn't grant by hand, and a non-admin calling setRole gets a
 * permission error rather than a silent no-op.
 */

function toRole(uid: string, data: Record<string, unknown>): UserRole {
  return {
    uid,
    admin: data.admin === true,
    email: (data.email as string | null) ?? null,
    displayName: (data.displayName as string | null) ?? null,
    updatedAt: (data.updatedAt as string) ?? '',
    updatedBy: (data.updatedBy as string) ?? '',
  };
}

export async function getRole(uid: string): Promise<UserRole | null> {
  const snapshot = await getDoc(doc(getDb(), 'roles', uid));
  return snapshot.exists() ? toRole(snapshot.id, snapshot.data()) : null;
}

/** Every granted role — the /admin/people list. Users with no role doc simply aren't here. */
export async function listRoles(): Promise<UserRole[]> {
  const snapshot = await getDocs(collection(getDb(), 'roles'));
  return snapshot.docs.map((d) => toRole(d.id, d.data()));
}

export type { RoleGrant } from './types';

/**
 * Writes the whole grant, rather than merging: a role screen that could only
 * add permissions would be a poor way to run access control. Revoking is
 * setting admin/educator false, which leaves the document in place as a
 * record of who held what and who changed it.
 */
export async function setRole(uid: string, grant: RoleGrant, actorUid: string): Promise<UserRole> {
  const role: UserRole = {
    uid,
    ...grant,
    updatedAt: new Date().toISOString(),
    updatedBy: actorUid,
  };
  await setDoc(doc(getDb(), 'roles', uid), role);
  return role;
}
