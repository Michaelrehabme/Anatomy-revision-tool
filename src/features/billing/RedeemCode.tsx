import { useState, type FormEvent } from 'react';
import { refreshEntitlementEverywhere } from '../anatomy-revision/hooks/useEntitlement';

/**
 * "Have an access or discount code?" — on the pricing page and the account screen.
 *
 * An access code gives full access, free, until a fixed date: no card, and
 * nothing charged when it ends. It is NOT a class join code, which is why
 * every word here says "access code" and the join-code box says "join code".
 *
 * THE CODE IS CHECKED ON THE SERVER, and this file knows no codes. It sends
 * what was typed with the account's ID token, and says what came back
 * (netlify/functions/redeem-code.ts; the decisions are billing/lib/accessCode.ts,
 * which the app must never import).
 *
 * The Firebase import is dynamic, like every other Firebase touch outside the
 * data layer, so the public demo bundle never gains the SDK through this file.
 */

/** One sentence per answer the function gives. Keyed by its `reason`. */
const REFUSALS: Record<string, string> = {
  guest: 'Create a free account or sign in first, then enter your code.',
  unconfirmed: 'Confirm your email address first: follow the link we emailed you, then enter your code again.',
  'unknown-code': 'That is not a code we recognise. Check the spelling and try again.',
  ended: 'That code has ended.',
  'all-used': 'Every place on that code has been taken.',
  'has-access': 'This account already has full access, so it does not need a code.',
};

const FAILED = 'The code could not be checked. Try again in a moment.';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

interface Props {
  /** A code to start with: /pricing?code=… from a shared link. */
  prefill?: string;
  /** Nobody is signed in to an account. Called instead of asking the server, which would only refuse. */
  onNeedsAccount?: () => void;
}

export function RedeemCode({ prefill = '', onNeedsAccount }: Props) {
  const [code, setCode] = useState(prefill);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function redeem(event: FormEvent) {
    event.preventDefault();
    if (busy || !code.trim()) return;
    setError(null);
    if (onNeedsAccount) {
      setError(REFUSALS.guest);
      onNeedsAccount();
      return;
    }
    setBusy(true);
    try {
      const { getFirebaseAuth } = await import('../anatomy-revision/data/firebase');
      const user = getFirebaseAuth().currentUser;
      if (!user) { setError(REFUSALS.guest); return; }

      const response = await fetch('/.netlify/functions/redeem-code', {
        method: 'POST',
        headers: { authorization: `Bearer ${await user.getIdToken()}`, 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; reason?: string; accessUntil?: string }
        | null;

      if (response.ok && body?.ok && body.accessUntil) {
        setDone(`You have full access until ${formatDate(body.accessUntil)}, free. Nothing is charged when it ends.`);
        // Every screen that gates on the entitlement reads it again, so the
        // regions unlock without a reload.
        refreshEntitlementEverywhere();
        return;
      }
      setError((body?.reason && REFUSALS[body.reason]) || FAILED);
    } catch {
      setError(FAILED);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="mt-4" role="status" style={{ font: '400 14px/1.5 var(--font-ui)', color: 'var(--ink)' }}>
        {done}
      </p>
    );
  }

  return (
    <form onSubmit={redeem} className="mt-4" style={{ maxWidth: 400 }}>
      <label
        htmlFor="access-code"
        className="block"
        style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink3)' }}
      >
        Have an access or discount code?
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="access-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Access or discount code"
          maxLength={40}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1"
          style={{
            font: '500 14px/1 var(--font-mono)',
            color: 'var(--ink)',
            background: 'var(--pg)',
            border: '1.2px solid var(--line)',
            borderRadius: 3,
            padding: '9px 10px',
          }}
        />
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="rounded-[3px] px-3 disabled:opacity-50"
          style={{ font: '500 12.5px/1 var(--font-ui)', background: 'var(--accs)', color: 'var(--accd)', border: 0 }}
        >
          {busy ? 'Checking…' : 'Use code'}
        </button>
      </div>
      {error && (
        <p className="mt-2" role="alert" style={{ font: '400 12.5px/1.5 var(--font-ui)', color: 'var(--acc2d)' }}>
          {error}
        </p>
      )}
    </form>
  );
}

export default RedeemCode;
