import { useId, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthProvider';
import { Button } from '../shared/Button';

export type AccountFormMode = 'sign-in' | 'sign-up';

interface AccountFormProps {
  initialMode?: AccountFormMode;
  /**
   * Called once the visitor is an account: a new one made, or an existing one
   * signed in to. `recovered` is true when the sign-in turned out to belong
   * to an account that already existed, so this device's guest progress
   * could not be merged into it — the form has already said so.
   */
  onDone: (result: { recovered: boolean }) => void;
  /**
   * This visitor has progress on this device as a guest. Signing IN to
   * another account leaves that progress behind, and they are told before
   * they do it rather than after.
   */
  guestHasProgress?: boolean;
  /** Told when the form switches between creating and signing in, for a heading that follows it. */
  onModeChange?: (mode: AccountFormMode) => void;
  /**
   * Told, at once, when an existing account was signed in to instead of a new
   * one being made, with the sentence that says so. For a caller that will
   * not be on screen to show the form's own message: the screen a guest sees
   * is replaced the moment they are an account, and the message went with it.
   */
  onRecovered?: (message: string) => void;
}

export function friendlyAuthError(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: string }).code : undefined;
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Incorrect email or password.';
    case 'auth/user-not-found':
      return 'No account found with that email — try creating one instead.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists — try signing in instead.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/invalid-email':
      return "That doesn't look like a valid email address.";
    case 'auth/network-request-failed':
      return 'You seem to be offline. Connect and try again — nothing on this device has been lost.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return '';
    default:
      return 'Something went wrong. Please try again.';
  }
}

const field = {
  border: '1.2px solid var(--line)',
  background: 'var(--pg)',
  color: 'var(--ink)',
  fontFamily: 'var(--font-ui)',
} as const;

const fieldLabel = { font: '500 12.5px/1 var(--font-ui)', color: 'var(--ink2)' } as const;

/**
 * The sign-up and sign-in form, by itself: the age and terms tick, Google,
 * email and password.
 *
 * ONE FORM, THREE PLACES. It was the inside of a dismissible overlay
 * (AuthScreen), back when an account was optional. An account is now what the
 * free area and every session need, so the same form is also step one of
 * onboarding and the body of the screen an existing guest meets
 * (AccountGate) — places with no "close", where a second copy of the form
 * would be a second set of error messages and a second age gate to keep in
 * step.
 *
 * CREATING AN ACCOUNT FROM A GUEST LINKS IT: the uid is kept, so the guest's
 * progress and free area are the account's (data/firebase.ts). Signing IN to
 * an account that already exists replaces the guest, and what the guest did
 * on this device stays with the guest.
 *
 * AN EMAIL-AND-PASSWORD ACCOUNT THEN CONFIRMS ITS ADDRESS before its free
 * area (owner's decision, 7 Oct 2026). The link is emailed as the account is
 * made (context/AuthProvider signUpWithEmail), and whoever is showing this
 * form shows "Check your inbox" next (Auth/EmailConfirmPanel). Google's
 * sign-in arrives confirmed and goes straight on.
 */
export function AccountForm({ initialMode = 'sign-up', onDone, guestHasProgress = false, onModeChange, onRecovered }: AccountFormProps) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<AccountFormMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const id = useId();
  /*
   * AGE CONFIRMATION (CR-025 item 6). Under-16s in the UK bring the GDPR
   * children's provisions and Google Play's Families policy with them, and
   * this app is built for degree-level students — so the floor is declared
   * and enforced rather than assumed. It gates Google as well as email:
   * Google sign-in is one tap, and a gate only the slower route respects is
   * not a gate.
   *
   * A self-declared checkbox, not a date of birth. Collecting a birth date to
   * check one boolean would mean storing a new piece of personal data about
   * every student for no further purpose, which is the opposite of data
   * minimisation.
   */
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const blockedByAge = mode === 'sign-up' && !ageConfirmed;

  const finish = (recovered: boolean, message: string) => {
    // An existing account was signed in to instead of a new one being made:
    // said, and acknowledged, before anything moves on.
    if (recovered) {
      onRecovered?.(message);
      setConflictMessage(message);
    } else onDone({ recovered: false });
  };

  const handleGoogle = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const result = await signInWithGoogle();
      finish(
        result.recoveredExistingAccount,
        'We found an existing account for that Google sign-in and switched you into it. Progress saved only on this device could not be merged into it.',
      );
    } catch (err) {
      const message = friendlyAuthError(err);
      if (message) setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = mode === 'sign-up' ? await signUpWithEmail(email, password) : await signInWithEmail(email, password);
      finish(
        result.recoveredExistingAccount,
        'An account with this email already existed, so we signed you into it. Progress saved only on this device could not be merged into it.',
      );
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (conflictMessage) {
    return (
      <div>
        <div role="status" className="rounded-[3px] p-4 text-sm leading-relaxed" style={{ background: 'var(--acc2s)', color: 'var(--acc2d)' }}>
          {conflictMessage}
        </div>
        <Button onClick={() => onDone({ recovered: true })} className="mt-5 min-h-[46px] w-full">
          Continue
        </Button>
      </div>
    );
  }

  return (
    <>
      {mode === 'sign-up' && (
        <label className="mb-4 flex cursor-pointer items-start gap-2.5" style={{ font: '400 13px/1.5 var(--font-ui)', color: 'var(--ink2)' }}>
          <input
            type="checkbox"
            checked={ageConfirmed}
            onChange={(e) => setAgeConfirmed(e.target.checked)}
            className="mt-0.5 min-h-[18px] min-w-[18px]"
          />
          <span>
            I am 16 or over, and I agree to the{' '}
            <a href="/terms" target="_blank" rel="noreferrer" style={{ color: 'var(--accd)' }}>terms</a>{' '}
            and{' '}
            <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: 'var(--accd)' }}>privacy policy</a>.
          </span>
        </label>
      )}

      {mode === 'sign-in' && guestHasProgress && (
        <p className="mb-4 rounded-[3px] p-3" style={{ font: '400 13px/1.5 var(--font-ui)', background: 'var(--acc2s)', color: 'var(--acc2d)' }}>
          Signing in opens the account you already have. What you have done on this device as a guest stays
          behind — to keep it, create an account instead.
        </p>
      )}

      <Button
        type="button"
        variant="secondary"
        onClick={handleGoogle}
        disabled={submitting || blockedByAge}
        className="min-h-[46px] w-full"
      >
        Continue with Google
      </Button>

      <div className="my-5 flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1" style={{ background: 'var(--line)' }} />
        <span style={{ font: '400 11px/1 var(--font-mono)', color: 'var(--ink3)' }}>or</span>
        <div className="h-px flex-1" style={{ background: 'var(--line)' }} />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate={false}>
        <label htmlFor={`${id}-email`} style={fieldLabel}>Email</label>
        <input
          id={`${id}-email`}
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="-mt-1 rounded-[3px] px-3.5 py-3"
          style={field}
        />
        <label htmlFor={`${id}-password`} style={fieldLabel}>
          Password{mode === 'sign-up' && <span style={{ fontWeight: 400, color: 'var(--ink3)' }}> — at least 6 characters</span>}
        </label>
        <input
          id={`${id}-password`}
          type="password"
          required
          minLength={6}
          autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="-mt-1 rounded-[3px] px-3.5 py-3"
          style={field}
        />

        {/* Always in the page, so a screen reader is told when it fills. */}
        <div id={`${id}-error`} role="alert" className="text-sm" style={{ color: 'var(--acc2d)', minHeight: error ? undefined : 0 }}>
          {error}
        </div>

        {blockedByAge && (
          <p id={`${id}-age`} className="text-sm" style={{ color: 'var(--ink3)' }}>
            Tick the box above to continue.
          </p>
        )}

        <Button
          type="submit"
          disabled={submitting || blockedByAge}
          aria-describedby={blockedByAge ? `${id}-age` : undefined}
          className="mt-1 min-h-[46px] w-full"
        >
          {submitting ? 'One moment…' : mode === 'sign-up' ? 'Create account' : 'Sign in'}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => {
          const next = mode === 'sign-up' ? 'sign-in' : 'sign-up';
          setMode(next);
          onModeChange?.(next);
          setError(null);
          // Switching away and back must not carry a stale confirmation.
          setAgeConfirmed(false);
        }}
        className="mt-5 min-h-[44px] text-sm"
        style={{ color: 'var(--ink2)', textDecoration: 'underline', textUnderlineOffset: 3 }}
      >
        {mode === 'sign-up' ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
      </button>
    </>
  );
}
