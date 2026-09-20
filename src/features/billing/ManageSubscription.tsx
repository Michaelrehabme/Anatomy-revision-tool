import { useState } from 'react';

/**
 * "Manage or cancel" on the account screen: fetches a one-time link to
 * Paddle's customer portal and opens it.
 *
 * WHY THIS EXISTS. /refunds promises a student can cancel whenever they like.
 * Until now that meant emailing us and waiting for somebody to do it by hand,
 * which is a promise kept by memory rather than by the product — and the kind
 * of friction that turns "I'll cancel" into a chargeback.
 *
 * THE LINK IS FETCHED ON CLICK, NEVER STORED. Paddle's portal sessions are
 * short-lived and single-use; a link cached at render would be dead by the
 * time anybody pressed it, and a stale billing link is worse than none.
 *
 * The Firebase import is dynamic, like every other Firebase touch outside the
 * data layer, so the public demo bundle never gains the SDK through this file.
 */

export function ManageSubscription() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setError(null);
    setLoading(true);
    try {
      const { getFirebaseAuth } = await import('../anatomy-revision/data/firebase');
      const user = getFirebaseAuth().currentUser;
      if (!user) throw new Error('not signed in');

      // The ID token is what proves to the function that this really is the
      // account being asked about — see netlify/functions/paddle-portal.ts.
      const response = await fetch('/.netlify/functions/paddle-portal', {
        method: 'POST',
        headers: { authorization: `Bearer ${await user.getIdToken()}` },
      });
      if (!response.ok) throw new Error(`portal responded ${response.status}`);

      const { url } = (await response.json()) as { url: string | null };
      if (!url) {
        setError('We could not find a payment record for this account. Reply to your receipt and we will sort it out.');
        return;
      }
      window.location.href = url;
    } catch {
      setError('The billing portal could not be opened. Try again in a moment, or reply to your receipt.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={open}
        disabled={loading}
        className="disabled:opacity-50"
        style={{ font: '400 13.5px/1.4 var(--font-ui)', color: 'var(--accd)', textDecoration: 'underline' }}
      >
        {loading ? 'Opening…' : 'Manage or cancel your subscription'}
      </button>
      {error && (
        <p className="mt-1.5" role="alert" style={{ font: '400 12.5px/1.5 var(--font-ui)', color: 'var(--acc2d)' }}>
          {error}
        </p>
      )}
    </div>
  );
}

export default ManageSubscription;
