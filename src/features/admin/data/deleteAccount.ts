import type { DeleteRefusal } from '../lib/deleteAccountPolicy';

/**
 * Asks netlify/functions/admin-delete-account.ts to delete an account. The
 * function checks the caller is an admin and that the account may go; this
 * only carries the request and says what came back.
 */
export type DeleteResult = { ok: true } | { ok: false; reason: DeleteRefusal | 'forbidden' | 'failed' };

export async function deleteUserAccount(uid: string): Promise<DeleteResult> {
  const { getFirebaseAuth } = await import('../../anatomy-revision/data/firebase');
  const user = getFirebaseAuth().currentUser;
  if (!user) return { ok: false, reason: 'forbidden' };
  try {
    const response = await fetch('/.netlify/functions/admin-delete-account', {
      method: 'POST',
      headers: { authorization: `Bearer ${await user.getIdToken()}`, 'content-type': 'application/json' },
      body: JSON.stringify({ uid }),
    });
    if (response.ok) return { ok: true };
    if (response.status === 401 || response.status === 403) return { ok: false, reason: 'forbidden' };
    const body = (await response.json().catch(() => null)) as { reason?: string } | null;
    const reason = body?.reason;
    return { ok: false, reason: reason === 'self' || reason === 'admin' || reason === 'paying' ? reason : 'failed' };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
