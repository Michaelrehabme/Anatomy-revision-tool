import { effectiveTier, type Entitlement } from '../../anatomy-revision/lib/entitlement';

/**
 * WHO AN ADMIN MAY DELETE from /admin/users/:uid, decided in one place so the
 * button and the function (netlify/functions/admin-delete-account.ts) give
 * the same answer. The function is the one that counts; the screen only uses
 * this to explain, before the click, why a button is not there.
 *
 * Built for clearing out test and internal accounts. It refuses:
 *  - the admin's own account, which would lock them out mid-click;
 *  - another admin, whose access should be revoked on People first;
 *  - an account with a live Paddle subscription, because deleting the account
 *    would not stop Paddle charging it — cancel there first.
 */
export type DeleteRefusal = 'self' | 'admin' | 'paying';

export const DELETE_REFUSAL_TEXT: Record<DeleteRefusal, string> = {
  self: 'You cannot delete your own account from here.',
  admin: 'This is an admin account. Remove its admin access on People first.',
  paying: 'This account has a live Paddle subscription. Cancel it in Paddle first, or it will keep being charged.',
};

export function deleteRefusal(input: {
  actorUid: string;
  targetUid: string;
  targetIsAdmin: boolean;
  entitlement: Entitlement | null | undefined;
  now?: Date;
}): DeleteRefusal | null {
  if (input.actorUid === input.targetUid) return 'self';
  if (input.targetIsAdmin) return 'admin';
  const e = input.entitlement ?? null;
  if (e?.source === 'paddle' && effectiveTier(e, input.now ?? new Date()) !== 'free') return 'paying';
  return null;
}

/** What has to be typed to confirm: the account's email, or DELETE for a guest with none. */
export function confirmationWord(email: string | null): string {
  return email ?? 'DELETE';
}
