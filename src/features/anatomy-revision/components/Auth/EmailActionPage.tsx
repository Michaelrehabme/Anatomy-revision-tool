import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthProvider';
import { Button } from '../shared/Button';

/**
 * /auth/action: where the link in the app's own "Confirm your email" leads
 * (features/auth-email/verifyEmailMessage.ts). It replaces Firebase's plain
 * page on firebaseapp.com with one on this site, in this app's look.
 *
 * NOBODY NEED BE SIGNED IN. The link is often opened in a phone's mail app or
 * another browser; the code in it confirms the account it was made for
 * either way. When the account is the one signed in here, every screen is
 * told at once and "Continue" goes straight on to choosing the free area.
 *
 * Its own file, loaded only on this path: the entry chunk has no room.
 */

type State =
  | { kind: 'working' }
  | { kind: 'confirmed'; email: string | null }
  | { kind: 'expired' }
  | { kind: 'failed'; offline: boolean };

function codeOf(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: string }).code : undefined;
}

export default function EmailActionPage() {
  const { user, loading, checkEmailConfirmed, sendConfirmationEmail } = useAuth();
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  const oobCode = params.get('oobCode');

  const [state, setState] = useState<State>({ kind: 'working' });
  const [resend, setResend] = useState<null | 'sending' | 'sent' | 'problem'>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  // Once, and only once auth has settled, so a signed-in account is known.
  const started = useRef(false);
  useEffect(() => {
    if (loading || started.current) return;
    started.current = true;
    if (mode !== 'verifyEmail' || !oobCode) {
      setState({ kind: 'expired' });
      return;
    }
    void (async () => {
      try {
        const { confirmEmailWithCode } = await import('../../data/emailConfirmation');
        const { email } = await confirmEmailWithCode(oobCode);
        if (user && !user.isAnonymous) await checkEmailConfirmed().catch(() => false);
        setState({ kind: 'confirmed', email });
      } catch (error) {
        const code = codeOf(error);
        if (code === 'auth/network-request-failed') {
          setState({ kind: 'failed', offline: true });
          return;
        }
        // A used link from an account that IS confirmed — the second tap on
        // the button, or a mail app that opened it twice — is not a failure.
        if (user && !user.isAnonymous && (await checkEmailConfirmed().catch(() => false))) {
          setState({ kind: 'confirmed', email: user.email });
          return;
        }
        setState(code === 'auth/expired-action-code' || code === 'auth/invalid-action-code' ? { kind: 'expired' } : { kind: 'failed', offline: false });
      }
    })();
  }, [loading, mode, oobCode, user, checkEmailConfirmed]);

  // No focus is moved when the result arrives: nobody pressed anything, the
  // page opened on it, and a heading that takes focus by itself wears a
  // focus ring for no reason (Onboarding.tsx says the same). The status line
  // and then the heading are what a screen reader reads first.

  const signedInUnconfirmed = !!user && !user.isAnonymous && !user.emailVerified;

  const sendNew = async () => {
    setResend('sending');
    try {
      await sendConfirmationEmail();
      setResend('sent');
    } catch {
      setResend('problem');
    }
  };

  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--pg)', color: 'var(--ink)' }}>
      <header className="flex h-14 items-center gap-2.5 px-5 md:h-16 md:px-10" style={{ borderBottom: '1px solid var(--line)' }}>
        <img src="/icons/icon-192.png" alt="" width={28} height={28} className="rounded-[7px]" />
        <Link to="/" style={{ font: '600 18px/1 var(--font-display)', letterSpacing: '-.01em', color: 'var(--ink)', textDecoration: 'none' }}>
          LocusMSK
        </Link>
      </header>

      <main className="flex flex-1 items-center px-6 pb-20 md:justify-center md:pb-16">
        <div className="w-full max-w-[460px] md:text-center" data-testid="email-action-page" data-state={state.kind}>
          {state.kind === 'working' ? (
            <p role="status" style={{ font: '400 16px/1.5 var(--font-ui)', color: 'var(--ink2)' }}>
              Confirming your email…
            </p>
          ) : state.kind === 'confirmed' ? (
            <Panel
              tone="good"
              kicker="All set"
              title="Email confirmed"
              headingRef={heading}
              body={
                <>
                  {state.email ? (
                    <strong style={{ color: 'var(--ink)', fontWeight: 600, overflowWrap: 'anywhere' }}>{state.email}</strong>
                  ) : (
                    'Your address'
                  )}{' '}
                  is confirmed. Next, pick the area you want free for good.
                </>
              }
              action={<Button onClick={() => navigate('/', { replace: true })} className="min-h-[54px] w-full md:max-w-[300px]">Continue to LocusMSK</Button>}
              foot="Signed up on another device? Go back to it. It will move on by itself."
            />
          ) : state.kind === 'expired' ? (
            <Panel
              tone="bad"
              kicker="Link expired"
              title="This link has stopped working"
              headingRef={heading}
              body="It may have been used already, or a newer one was sent after it. Send yourself a fresh link and use the newest email."
              action={
                signedInUnconfirmed ? (
                  <Button onClick={() => void sendNew()} disabled={resend === 'sending' || resend === 'sent'} className="min-h-[54px] w-full md:max-w-[300px]">
                    {resend === 'sending' ? 'Sending…' : resend === 'sent' ? 'Sent. Check your inbox' : 'Send a new link'}
                  </Button>
                ) : (
                  <Button onClick={() => navigate('/', { replace: true })} className="min-h-[54px] w-full md:max-w-[300px]">
                    Sign in to send a new link
                  </Button>
                )
              }
              foot={
                <>
                  <span role="status">{resend === 'problem' ? 'We could not send it just now. Please try again in a few minutes. ' : null}</span>
                  Already confirmed?{' '}
                  <Link to="/" replace style={{ color: 'var(--accd)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                    Open LocusMSK
                  </Link>
                </>
              }
            />
          ) : (
            <Panel
              tone="bad"
              kicker="Not confirmed yet"
              title="We could not confirm your email"
              headingRef={heading}
              body={
                state.offline
                  ? 'You seem to be offline. Connect, then open the link again.'
                  : 'Something went wrong on our side. Open the link again in a minute.'
              }
              action={<Button onClick={() => window.location.reload()} className="min-h-[54px] w-full md:max-w-[300px]">Try again</Button>}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function Panel({
  tone,
  kicker,
  title,
  body,
  action,
  foot,
  headingRef,
}: {
  tone: 'good' | 'bad';
  kicker: string;
  title: string;
  body: ReactNode;
  action: ReactNode;
  foot?: ReactNode;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const good = tone === 'good';
  return (
    <div className="flex flex-col md:items-center">
      <div
        aria-hidden="true"
        className="flex h-16 w-16 items-center justify-center rounded-full md:h-[76px] md:w-[76px]"
        style={{
          background: good ? 'var(--accs)' : 'var(--acc2s)',
          color: good ? 'var(--acc)' : 'var(--acc2d)',
          boxShadow: good ? '0 0 0 8px color-mix(in srgb, var(--acc) 8%, transparent)' : undefined,
        }}
      >
        {good ? (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
        )}
      </div>
      <div
        className="mt-7"
        style={{ font: '600 10.5px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: good ? 'var(--accd)' : 'var(--acc2d)' }}
      >
        {kicker}
      </div>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-3.5 mb-3.5 text-[38px] outline-none md:text-[52px]"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 500, lineHeight: 1.03, letterSpacing: '-.026em' }}
      >
        {title}
      </h1>
      <p className="mb-7 text-base leading-relaxed md:text-lg" style={{ color: 'var(--ink2)' }}>
        {body}
      </p>
      {action}
      {foot && (
        <p className="mt-5 text-[13.5px] leading-relaxed md:max-w-[380px] md:text-sm" style={{ color: 'var(--ink3)' }}>
          {foot}
        </p>
      )}
    </div>
  );
}
