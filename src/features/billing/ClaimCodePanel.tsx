import { Suspense, lazy } from 'react';
import { RedeemCode } from './RedeemCode';
import { CODE_OFFER } from './lib/codeOffer';

/**
 * The top of /pricing when a visitor arrives to claim a code (/pricing?code=…,
 * from the home page's "Claim" buttons, or a code kept on this device while
 * they confirmed their email).
 *
 * THE CODE COMES FIRST. Before 28 October 2026 the box sat below the plans
 * and below "Create an account", on a page headed "Unlock every region", and
 * a student holding a free code had to work out for themselves that the page
 * was for them. Now the page opens on what the code gives and the one thing
 * standing between them and it.
 *
 * THREE STATES, one at a time:
 *  - no account yet: make one (Google first: its addresses arrive confirmed);
 *  - an account whose email is not confirmed: the "check your inbox" step,
 *    in place, with the code kept (the server refuses unconfirmed accounts);
 *  - a confirmed account: the code is sent by itself.
 * Once the code is in, the page's own "You have full access" takes over.
 */

const EmailConfirmPanel = lazy(() => import('../anatomy-revision/components/Auth/EmailConfirmPanel'));

const label = {
  font: '500 10px/1 var(--font-mono)',
  letterSpacing: '.12em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink3)',
};

const prose = { font: '400 14.5px/1.6 var(--font-ui)', color: 'var(--ink2)' } as const;

interface Props {
  /** The code being claimed, as it was typed or linked. */
  code: string;
  needsAccount: boolean;
  /** The account's access is still being read: nothing is sent until it is known the code is wanted. */
  loading: boolean;
  /** The account's email is confirmed, so the server will take the code. */
  confirmed: boolean;
  onCreateAccount: () => void;
  onSignIn: () => void;
}

export function ClaimCodePanel({ code, needsAccount, loading, confirmed, onCreateAccount, onSignIn }: Props) {
  // Only the advertised code is described by what it gives. Any other code
  // the server knows still works through the box; the page just does not
  // promise what it does.
  const advertised = code.replace(/\s+/g, '').toUpperCase() === CODE_OFFER.code.toUpperCase();

  return (
    <>
      <div className="mt-6 rounded-[4px] px-5 py-5" style={{ background: 'var(--accs)', border: '1.5px solid var(--acc)' }}>
        <div className="flex flex-wrap items-center gap-2.5" style={label}>
          Your code
          <span
            style={{
              font: '600 13px/1 var(--font-ui)',
              letterSpacing: '.06em',
              color: 'var(--ink)',
              background: 'var(--pg)',
              border: '1.2px dashed var(--acc)',
              borderRadius: 3,
              padding: '5px 8px',
            }}
          >
            {code.toUpperCase()}
          </span>
        </div>
        <h1 className="mt-3" style={{ fontFamily: 'var(--font-display)', fontSize: 30, lineHeight: 1.12, letterSpacing: '-0.02em' }}>
          {advertised ? `Every region, free until ${CODE_OFFER.untilLabel}` : 'Use your access code'}
        </h1>
        {advertised && (
          <ul className="mt-3 flex flex-col gap-1" style={{ ...prose, color: 'var(--ink)', listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
            <li>✓ All muscles, bones, landmarks, joints and ligaments</li>
            <li>✓ No card, and nothing is charged when it ends</li>
            <li>✓ Your progress stays after it ends</li>
          </ul>
        )}
      </div>

      <div className="mt-4 rounded-[4px] px-5 py-5" style={{ background: 'var(--sf)' }}>
        {needsAccount ? (
          <>
            <div style={label}>Step 1 of 2 · Your account</div>
            <h2 className="mt-2.5" style={{ fontFamily: 'var(--font-display)', fontSize: 21, letterSpacing: '-0.01em' }}>
              Create a free account and the code is applied for you
            </h2>
            <p className="mt-2" style={prose}>
              Continuing with Google is quickest. There is no email to confirm, so you are in straight away.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
              <button
                type="button"
                onClick={onCreateAccount}
                className="rounded-[3px] px-5 py-3"
                style={{ font: '500 14.5px/1 var(--font-ui)', background: 'var(--acc-fill)', color: 'var(--onacc)' }}
              >
                Create my account
              </button>
              <button
                type="button"
                onClick={onSignIn}
                style={{ font: '400 13.5px/1.4 var(--font-ui)', color: 'var(--accd)', textDecoration: 'underline' }}
              >
                I already have an account
              </button>
            </div>
          </>
        ) : !confirmed ? (
          <>
            <div style={label}>Step 2 of 2 · Confirm your email</div>
            <h2 className="mt-2.5 mb-3" style={{ fontFamily: 'var(--font-display)', fontSize: 21, letterSpacing: '-0.01em' }}>
              Check your inbox
            </h2>
            <p className="mb-4" style={prose}>
              Your code is saved. It is applied by itself as soon as you confirm, so there is nothing to type again.
            </p>
            <Suspense fallback={null}>
              <EmailConfirmPanel purpose="free-area" />
            </Suspense>
          </>
        ) : loading ? (
          <div style={label}>One moment…</div>
        ) : (
          <>
            <div style={label}>Applying your code</div>
            <RedeemCode prefill={code} autoSubmit />
          </>
        )}
      </div>
    </>
  );
}
