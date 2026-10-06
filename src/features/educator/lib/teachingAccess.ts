import { resolveEntitlement } from '../../anatomy-revision/lib/entitlement';
import { storedEntitlements } from '../../anatomy-revision/lib/entitlementRecord';

/**
 * Who may teach (owner's decision, 6 Oct 2026): creating a class, and the
 * educator screens, need the educator's OWN account to have full access.
 *
 * WHAT COUNTS, and it is the same reading the paywall makes of the same
 * document (lib/entitlement.ts `resolveEntitlement`):
 *
 *   - a paid subscription that has started and not run out — the three days
 *     of grace after a failed payment included, because the webhook stores
 *     them as part of the expiry;
 *   - a complimentary or institutional grant on the account;
 *   - admin.
 *
 * WHAT DOES NOT: being a MEMBER of a licensed class. A class licence gives
 * the class's students every area; it is derived from membership and is not
 * on their accounts, and a student is not an educator.
 *
 * AND ONE THING THAT DOES, FOR ONE CLASS: OWNING a class that is itself
 * licensed. The licence is granted to the class by the owner of LocusMSK,
 * through the admin script, for exactly that teaching — so while it runs, the
 * class's owner can go on running that class even if their own account has
 * no entitlement. It does not let them start another.
 *
 * firestore.rules holds the same lines (mayTeach, mayRunCohort) and is the
 * boundary; this decides what to draw. The two differ only where the rules
 * note it: a stored date they cannot read refuses there, and reads as "not
 * expired" here.
 *
 * AN EDUCATOR WHOSE ACCESS LAPSES LOSES NOTHING BUT THE TOOLS. Their classes,
 * their students' membership and every figure stay where they were, and the
 * rules go on letting them read it all. They are shown a panel in place of
 * the screens (components/TeachingAccessPanel.tsx), not an empty state.
 */
export interface TeachingAccess {
  /** The account's own entitlement is in force. */
  own: boolean;
  admin: boolean;
}

type Fields = Record<string, unknown> | null | undefined;

/** Whether the entitlement STORED ON THIS ACCOUNT is in force. A class licence is not stored on it. */
export function ownFullAccess(user: Fields, now: Date = new Date()): boolean {
  return resolveEntitlement(storedEntitlements(user), now).tier !== 'free';
}

/** May start teaching: create a class. */
export function mayTeach(access: TeachingAccess): boolean {
  return access.own || access.admin;
}

/** Whether a class's own licence is still running. */
export function cohortIsLicensed(cohort: { licensedUntil?: string | null } | null | undefined, now: Date = new Date()): boolean {
  if (!cohort || typeof cohort.licensedUntil !== 'string') return false;
  const until = Date.parse(cohort.licensedUntil);
  return !Number.isNaN(until) && until > now.getTime();
}

/** May go on teaching a class they own: see its screens, set work, invite. */
export function mayRunCohort(
  access: TeachingAccess,
  cohort: { licensedUntil?: string | null } | null | undefined,
  now: Date = new Date(),
): boolean {
  return mayTeach(access) || cohortIsLicensed(cohort, now);
}
