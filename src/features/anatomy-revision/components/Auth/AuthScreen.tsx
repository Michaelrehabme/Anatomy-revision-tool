import { useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthProvider';
import { Button } from '../shared/Button';

type Mode = 'sign-in' | 'sign-up';

interface AuthScreenProps {
  initialMode?: Mode;
  onClose: () => void;
}

function friendlyError(error: unknown): string {
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
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return '';
    default:
      return 'Something went wrong. Please try again.';
  }
}

/**
 * Full-screen sign-in/sign-up overlay (Onboarding-style, not a login wall —
 * anonymous visitors can always dismiss this and keep using the app). When
 * an anonymous session exists, signing up here links it so the same uid
 * (and all users/{uid}/** data) carries straight over.
 */
export function AuthScreen({ initialMode = 'sign-up', onClose }: AuthScreenProps) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  const handleGoogle = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const result = await signInWithGoogle();
      if (result.recoveredExistingAccount) {
        setConflictMessage(
          "We found an existing account for that Google sign-in and switched you into it. Progress saved only on this device could not be merged into it.",
        );
      } else {
        onClose();
      }
    } catch (err) {
      const message = friendlyError(err);
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
      if (result.recoveredExistingAccount) {
        setConflictMessage(
          'An account with this email already existed, so we signed you into it. Progress saved only on this device could not be merged into it.',
        );
      } else {
        onClose();
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'color-mix(in srgb, var(--ink) 55%, transparent)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-[3px] p-8"
        style={{ background: 'var(--sf)', boxShadow: 'var(--shadow-card)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div
            style={{
              font: '500 10px/1 var(--font-mono)',
              letterSpacing: '.16em',
              textTransform: 'uppercase',
              color: 'var(--acc)',
            }}
          >
            {mode === 'sign-up' ? 'Create your account' : 'Welcome back'}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="border-0 bg-transparent p-0 leading-none"
            style={{ color: 'var(--ink3)', fontSize: 20 }}
          >
            &times;
          </button>
        </div>

        <h2
          className="mt-2 mb-6"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 28, letterSpacing: '-.02em', color: 'var(--ink)' }}
        >
          {mode === 'sign-up' ? 'Save your progress' : 'Sign in'}
        </h2>

        {conflictMessage ? (
          <div>
            <div
              className="rounded-[3px] p-4 text-sm leading-relaxed"
              style={{ background: 'var(--acc2s)', color: 'var(--acc2d)' }}
            >
              {conflictMessage}
            </div>
            <Button onClick={onClose} className="mt-5 min-h-[46px] w-full">
              Continue
            </Button>
          </div>
        ) : (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={handleGoogle}
              disabled={submitting}
              className="min-h-[46px] w-full"
            >
              Continue with Google
            </Button>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1" style={{ background: 'var(--line)' }} />
              <span style={{ font: '400 11px/1 var(--font-mono)', color: 'var(--ink3)' }}>or</span>
              <div className="h-px flex-1" style={{ background: 'var(--line)' }} />
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-[3px] px-3.5 py-3"
                style={{ border: '1.2px solid var(--line)', background: 'var(--pg)', color: 'var(--ink)', fontFamily: 'var(--font-ui)' }}
              />
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-[3px] px-3.5 py-3"
                style={{ border: '1.2px solid var(--line)', background: 'var(--pg)', color: 'var(--ink)', fontFamily: 'var(--font-ui)' }}
              />

              {error && (
                <div className="text-sm" style={{ color: 'var(--acc2d)' }}>
                  {error}
                </div>
              )}

              <Button type="submit" disabled={submitting} className="mt-1 min-h-[46px] w-full">
                {mode === 'sign-up' ? 'Create account' : 'Sign in'}
              </Button>
            </form>

            <button
              type="button"
              onClick={() => {
                setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up');
                setError(null);
              }}
              className="mt-5 text-sm"
              style={{ color: 'var(--ink3)' }}
            >
              {mode === 'sign-up' ? 'Already have an account? Sign in' : "Need an account? Sign up"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
