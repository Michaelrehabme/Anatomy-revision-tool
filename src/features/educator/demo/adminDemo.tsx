import type { ReactNode } from 'react';
import { DEMO_COHORTS, DEMO_EDUCATOR_UID, demoStudentsInCohort } from './demoData';
import type { AdminUserProfile } from '../../admin/types/adminUser';
import type { CurrentRole, RoleGrant, UserRole } from '../../roles/types';

/**
 * Demo-mode stand-ins for the admin-side role screens (README "Educator demo
 * mode"): an always-allow /admin guard, a synthetic signed-in admin, and
 * in-memory people + roles, so /admin/people can be reviewed without a
 * Firebase project or a real grant.
 *
 * One file rather than four, because each piece is a handful of lines and
 * they are only meaningful together — the roles here refer to the people
 * here.
 */

const STAFF: AdminUserProfile[] = [
  { uid: DEMO_EDUCATOR_UID, displayName: 'Rory Neary', email: 'nearyomichael@gmail.com', createdAt: '2026-01-05T09:00:00.000Z', lastActiveAt: new Date().toISOString() },
  { uid: 'demo-staff-2', displayName: 'Helen Adeyemi', email: 'h.adeyemi@riverside.ac.uk', createdAt: '2026-01-20T09:00:00.000Z', lastActiveAt: new Date().toISOString() },
  { uid: 'demo-staff-3', displayName: 'Marcus Doyle', email: 'm.doyle@riverside.ac.uk', createdAt: '2026-02-11T09:00:00.000Z', lastActiveAt: new Date().toISOString() },
];

const PEOPLE: AdminUserProfile[] = [
  ...STAFF,
  ...DEMO_COHORTS.flatMap((cohort) =>
    demoStudentsInCohort(cohort.id).map((student) => ({
      uid: student.uid,
      displayName: student.displayName,
      email: student.email,
      createdAt: student.joinedAt,
      lastActiveAt: student.lastActiveAt,
    })),
  ),
];

const roles = new Map<string, UserRole>([
  [
    'demo-staff-2',
    {
      uid: 'demo-staff-2',
      admin: true,
      email: 'h.adeyemi@riverside.ac.uk',
      displayName: 'Helen Adeyemi',
      updatedAt: '2026-02-01T10:00:00.000Z',
      updatedBy: DEMO_EDUCATOR_UID,
    },
  ],
]);

// --- usersRepository ---------------------------------------------------

export async function listUserProfiles(): Promise<AdminUserProfile[]> {
  return PEOPLE;
}

export async function getUserProfile(uid: string): Promise<AdminUserProfile | null> {
  return PEOPLE.find((p) => p.uid === uid) ?? null;
}

// --- rolesRepository ---------------------------------------------------

export async function listRoles(): Promise<UserRole[]> {
  return [...roles.values()];
}

export async function getRole(uid: string): Promise<UserRole | null> {
  return roles.get(uid) ?? null;
}

export async function setRole(uid: string, grant: RoleGrant, actorUid: string): Promise<UserRole> {
  const role: UserRole = { uid, ...grant, updatedAt: new Date().toISOString(), updatedBy: actorUid };
  roles.set(uid, role);
  return role;
}

// --- useCurrentRole / RequireAdmin -------------------------------------

export function useCurrentRole(): CurrentRole {
  return { uid: DEMO_EDUCATOR_UID, isAdmin: true, loading: false };
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
