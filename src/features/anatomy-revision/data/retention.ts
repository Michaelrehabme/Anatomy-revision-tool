/**
 * How long a dormant account is kept.
 *
 * ONE NUMBER, THREE READERS. The privacy policy promises it, the DPIA records
 * it as a risk with a deadline, and scripts/deleteDormantAccounts.ts enforces
 * it. Those three drifting apart is precisely the failure that made this a
 * finding in the first place: the policy said 24 months and nothing in the
 * codebase had ever heard of the number.
 *
 * So the page renders this constant rather than typing "24", and the script
 * imports it rather than declaring its own. Changing the retention period is
 * then one edit that cannot leave a published promise behind.
 *
 * Twenty-four months is deliberately long: it covers a placement year or a
 * repeated year without a student losing their history. It is not a security
 * control and there is no reason to make it aggressive.
 */
export const INACTIVITY_MONTHS = 24;

/** The same period in words, for prose that should not say "24 months" twice. */
export const INACTIVITY_LABEL = `${INACTIVITY_MONTHS} months of inactivity`;

/**
 * The cutoff: an account whose last activity predates this is due for deletion.
 *
 * Takes `now` so the script can be tested and so a dry run can be reproduced.
 */
export function dormantBefore(now: Date = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - INACTIVITY_MONTHS);
  return cutoff;
}

/** Whether an account last active at `lastActiveAt` is now due for deletion. */
export function isDormant(lastActiveAt: Date | string | null | undefined, now: Date = new Date()): boolean {
  if (!lastActiveAt) return false; // Never signed in, or a field we cannot read: never guess.
  const last = typeof lastActiveAt === 'string' ? new Date(lastActiveAt) : lastActiveAt;
  if (Number.isNaN(last.getTime())) return false;
  return last < dormantBefore(now);
}
