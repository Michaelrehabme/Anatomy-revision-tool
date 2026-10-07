import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthProvider';
import { readConfirmationRecord, resendWaitLeft } from '../../lib/emailVerification';
import { Button } from '../shared/Button';

interface EmailConfirmPanelProps {
  /**
   * `free-area`: a new account, which confirms before it can choose its free
   * area. The email is sent as the panel opens if none has been, and "Use a
   * different email" is offered.
   *
   * `change-area`: an account from before the rule, which keeps its area and
   * confirms only to change it. Nothing is sent until it asks, and its
   * sign-in is never taken off: it has an area and progress to keep.
   */
  purpose: 'free-area' | 'change-area';
  /** Called when "Use a different email" has put the visitor back to a guest. */
  onDifferentEmail?: () => void;
}

/** Firebase's code for an error, if it has one. */
function codeOf(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: string }).code : undefined;
}

const OFFLINE = 'You seem to be offline. Connect and try again. Nothing on this device has been lost.';

/** Why an email could not be sent, in words. */
function sendProblem(error: unknown): string {
  switch (codeOf(error)) {
    case 'auth/too-many-requests':
      // Firebase's own limit, which it does not publish. The earlier link is still good.
      return 'Too many emails have been sent to this address for now. Wait a few minutes, then try again. The last link we sent still works.';
    case 'auth/network-request-failed':
      return `We could not send the email. ${OFFLINE}`;
    default:
      return 'We could not send the email. Please try again in a moment.';
  }
}

/** How often coming back to the tab asks Firebase whether the address is confirmed. */
const QUIET_CHECK_MS = 3000;

/**
 * "Check your inbox": the buttons and messages of the step where an account
 * confirms its email address (lib/emailVerification.ts says why it must).
 *
 * Its own file, loaded when it is needed: almost nobody opening the app
 * sees it, and the entry chunk has no room to spare.
 *
 * WHAT IT DOES WITHOUT BEING ASKED. The link is usually followed somewhere
 * else — another tab, the mail app, a phone — so nothing on this page changes
 * when it is. Whenever this tab is come back to (focus, becoming visible,
 * the connection returning) it asks Firebase quietly whether the address is
 * confirmed now, and if it is, the app moves on by itself. "I've confirmed —
 * continue" asks the same question out loud, and says so if the answer is
 * still no.
 *
 * MESSAGES. What happened is said in a `status` region and what went wrong
 * in an `alert`, both in the page from the start so that a screen reader is
 * told when they fill. No message blames: the email may simply not have
 * arrived yet.
 */
export default function EmailConfirmPanel({ purpose, onDifferentEmail }: EmailConfirmPanelProps) {
  const { user, sendConfirmationEmail, checkEmailConfirmed, removeUnconfirmedEmail } = useAuth();
  const uid = user?.uid ?? null;
  const email = user?.email ?? null;
  const id = useId();

  const [busy, setBusy] = useState<null | 'check' | 'send' | 'different'>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  /** Whether an email has gone to this address from this device. Decides the wording above the buttons. */
  const [sent, setSent] = useState(() => {
    const record = uid ? readConfirmationRecord(uid) : null;
    return !!record && record.sentAt !== null && record.email === email;
  });

  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);

  const send = useCallback(
    async (again: boolean) => {
      setProblem(null);
      setStatus(null);
      setBusy('send');
      try {
        await sendConfirmationEmail();
        setSent(true);
        setStatus(again ? `Sent again to ${email ?? 'your address'}. It can take a minute or two to arrive.` : `Sent to ${email ?? 'your address'}. It can take a minute or two to arrive.`);
      } catch (error) {
        setProblem(sendProblem(error));
      } finally {
        setBusy(null);
      }
    },
    [sendConfirmationEmail, email],
  );

  // A new account whose email has not gone yet (the sign-up could not send
  // it, or the account was made on another device): sent as the panel opens.
  // Once per panel, and never for an account that only wants to change area.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    if (purpose === 'free-area' && !sent && uid) void send(false);
  }, [purpose, sent, uid, send]);

  // Coming back to this tab asks, quietly. A failure says nothing: nobody
  // pressed anything, and the button is there for asking out loud.
  const lastQuiet = useRef(0);
  const checking = useRef(false);
  useEffect(() => {
    const quiet = () => {
      if (document.visibilityState !== 'visible' || checking.current) return;
      if (Date.now() - lastQuiet.current < QUIET_CHECK_MS) return;
      lastQuiet.current = Date.now();
      checking.current = true;
      checkEmailConfirmed()
        .catch(() => false)
        .finally(() => { checking.current = false; });
    };
    const on = () => { setOnline(true); quiet(); };
    const off = () => setOnline(false);
    window.addEventListener('focus', quiet);
    document.addEventListener('visibilitychange', quiet);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('focus', quiet);
      document.removeEventListener('visibilitychange', quiet);
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [checkEmailConfirmed]);

  const check = async () => {
    setProblem(null);
    setStatus(null);
    setBusy('check');
    try {
      const confirmed = await checkEmailConfirmed();
      // Confirmed: every screen has been told, and this panel is about to be
      // replaced by what it was standing in for. Nothing more to say here.
      if (!confirmed) {
        setStatus(`That address is not confirmed yet. Open the link in the email we sent to ${email ?? 'you'}, then try again.`);
      }
    } catch (error) {
      setProblem(codeOf(error) === 'auth/network-request-failed' ? `We could not check. ${OFFLINE}` : 'We could not check just now. Please try again in a moment.');
    } finally {
      setBusy(null);
    }
  };

  const resend = () => {
    // The app's own wait, said rather than hidden behind a disabled button.
    // Firebase has a limit of its own on top (sendProblem says so).
    if (uid && resendWaitLeft(readConfirmationRecord(uid), email) > 0) {
      setProblem(null);
      setStatus('We sent one less than a minute ago. Give it a moment to arrive, then try again.');
      return;
    }
    void send(true);
  };

  const different = async () => {
    setProblem(null);
    setStatus(null);
    setBusy('different');
    try {
      await removeUnconfirmedEmail();
      onDifferentEmail?.();
    } catch (error) {
      setProblem(codeOf(error) === 'auth/network-request-failed' ? `We could not change the address. ${OFFLINE}` : 'We could not change the address just now. Please try again in a moment.');
      setBusy(null);
    }
  };

  const textLink = { color: 'var(--ink2)', textDecoration: 'underline', textUnderlineOffset: 3 } as const;

  return (
    <div data-testid="email-confirm-panel">
      {!online && (
        <p role="status" className="mb-4" style={{ font: '400 13.5px/1.5 var(--font-ui)', color: 'var(--acc2d)' }}>
          You are offline. Confirming your email address needs a connection. Everything you have done is still on
          this device.
        </p>
      )}

      <p data-testid="email-confirm-lead" className="mb-4" style={{ font: '400 15px/1.55 var(--font-ui)', color: 'var(--ink)' }}>
        {sent ? (
          <>
            We sent a link to <strong style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{email}</strong>. Open it to
            confirm your email address, then come back here.
          </>
        ) : busy === 'send' ? (
          <>Sending a link to <strong style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{email}</strong>…</>
        ) : purpose === 'change-area' ? (
          <>
            We will send a link to <strong style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{email}</strong>. Open it
            to confirm your email address, then come back here.
          </>
        ) : (
          <>
            We have not been able to send the link to{' '}
            <strong style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{email}</strong> yet.
          </>
        )}
      </p>

      {purpose === 'change-area' && !sent ? (
        <Button onClick={() => void send(false)} disabled={busy !== null} className="min-h-[46px] w-full">
          {busy === 'send' ? 'One moment…' : 'Send me the link'}
        </Button>
      ) : (
        <Button onClick={() => void check()} disabled={busy !== null} aria-describedby={`${id}-help`} className="min-h-[46px] w-full">
          {busy === 'check' ? 'Checking…' : 'I’ve confirmed — continue'}
        </Button>
      )}

      {/* Both always in the page, so a screen reader is told when they fill. */}
      <div role="status" className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--ink2)', minHeight: status ? undefined : 0 }}>
        {status}
      </div>
      <div role="alert" className="text-sm leading-relaxed" style={{ color: 'var(--acc2d)', minHeight: problem ? undefined : 0 }}>
        {problem}
      </div>

      <p id={`${id}-help`} className="mt-4" style={{ font: '400 13px/1.55 var(--font-ui)', color: 'var(--ink3)' }}>
        {purpose === 'free-area'
          ? 'If it does not arrive, check your spam or junk folder, resend it, or use a different address.'
          : 'If it does not arrive, check your spam or junk folder, or resend it.'}
      </p>

      {(purpose === 'free-area' || sent) && (
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
          <button type="button" onClick={resend} disabled={busy !== null} className="min-h-[44px] text-sm disabled:opacity-60" style={textLink}>
            {busy === 'send' ? 'Sending…' : sent ? 'Resend the email' : 'Send the email'}
          </button>
          {purpose === 'free-area' && (
            <button type="button" onClick={() => void different()} disabled={busy !== null} className="min-h-[44px] text-sm disabled:opacity-60" style={textLink}>
              Use a different email
            </button>
          )}
        </div>
      )}
    </div>
  );
}
