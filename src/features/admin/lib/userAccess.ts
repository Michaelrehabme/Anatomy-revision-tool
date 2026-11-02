import { effectiveTier, type Entitlement } from '../../anatomy-revision/lib/entitlement';
import type { AdminUserProfile } from '../types/adminUser';

/**
 * What the /admin/users table says about an account: whether it signed up,
 * whether it has full access now, and whether it redeemed an access code.
 *
 * SIGNED UP means an email on the profile. Every visitor is given an
 * anonymous account the moment they open the app, and those profiles have no
 * email; an account made with Google or an email address does.
 *
 * REDEEMED is kept apart from FULL ACCESS on purpose: a code's access ends on
 * its date for everyone, and the row should still say the code was used.
 */
export interface UserAccess {
  signedUp: boolean;
  fullAccess: boolean;
  /** The access code redeemed, or null. */
  accessCode: string | null;
  /** Short words for the Access column. */
  label: string;
}

export function userAccess(profile: AdminUserProfile, now: Date = new Date()): UserAccess {
  const signedUp = Boolean(profile.email);
  const entitlement = profile.entitlement ?? null;
  const fullAccess = effectiveTier(entitlement, now) !== 'free';
  const accessCode = entitlement?.accessCode ?? null;

  return { signedUp, fullAccess, accessCode, label: accessLabel(entitlement, fullAccess) };
}

const SOURCE_LABEL: Record<string, string> = { paddle: 'Paid', complimentary: 'Complimentary' };

function accessLabel(entitlement: Entitlement | null, fullAccess: boolean): string {
  if (entitlement?.accessCode) return fullAccess ? `Code ${entitlement.accessCode}` : `Code ${entitlement.accessCode} (ended)`;
  if (fullAccess) return SOURCE_LABEL[entitlement?.source ?? ''] ?? `Full (${entitlement?.source ?? entitlement?.tier})`;
  return entitlement && entitlement.tier !== 'free' ? 'Ended' : 'Free';
}

export type UsersFilter = 'all' | 'signed-up' | 'full-access' | 'redeemed';

export function matchesFilter(access: UserAccess, filter: UsersFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'signed-up':
      return access.signedUp;
    case 'full-access':
      return access.fullAccess;
    case 'redeemed':
      return access.accessCode !== null;
  }
}

export interface UsersCounts {
  all: number;
  signedUp: number;
  fullAccess: number;
  redeemed: number;
}

export function countUsers(accesses: readonly UserAccess[]): UsersCounts {
  return {
    all: accesses.length,
    signedUp: accesses.filter((a) => a.signedUp).length,
    fullAccess: accesses.filter((a) => a.fullAccess).length,
    redeemed: accesses.filter((a) => a.accessCode !== null).length,
  };
}
