import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../anatomy-revision/context/AuthProvider';
import { useEntitlement } from '../anatomy-revision/hooks/useEntitlement';
import { hasStarted } from '../anatomy-revision/lib/entitlement';
import { AuthScreen } from '../anatomy-revision/components/Auth/AuthScreen';
import { CoolingOffWaiver } from '../legal/CoolingOffWaiver';
import { PLANS, buildCheckoutRequest, readPaddleConfig, renewalTerms, type PlanId } from './lib/checkout';

/**
 * /pricing — CR-033 item 11. Pick a plan, choose when access starts, pay.
 *
 * THE ORDER ON THE PAGE FOLLOWS THE LAW. The cooling-off choice comes BEFORE
 * the pay button, and the pay button is what records it. Consent taken after
 * payment, or inside Paddle's overlay where we cannot record it, would not
 * meet the Consumer Contracts Regulations. See CoolingOffWaiver for the
 * wording and RefundsPage for the policy it enforces.
 *
 * TWO BUTTONS, NOT ONE CHECKBOX. "Start now" needs the box ticked. "Start in
 * 14 days" works either way. The delayed start has to be a real option the
 * student can pick: if it were only something that happened when they forgot
 * the box, it would be hard to argue the waiver was freely given.
 *
 * A REAL ACCOUNT FIRST. A guest account lives in one browser. A subscription
 * attached to one is lost when the student clears their cookies, and we would
 * have taken money for something they can no longer reach.
 *
 * IN THE PUBLIC DEMO it is a sandbox test bench, for Paddle's onboarding step
 * "build your pricing page and checkout". readPaddleConfig refuses anything
 * but sandbox there. The demo account's licence is ignored so the buttons
 * show, its made-up email is not sent to Paddle, and there is no webhook, so
 * a completed payment unlocks nothing and the page says so.
 */

const CONFIG = readPaddleConfig(import.meta.env);
const DEMO = import.meta.env.VITE_PUBLIC_DEMO === '1';

const cardLabel = {
  font: '500 10px/1 var(--font-mono)',
  letterSpacing: '.12em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink3)',
};

const prose = { font: '400 14.5px/1.6 var(--font-ui)', color: 'var(--ink2)' } as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function PricingPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const justPaid = params.get('checkout') === 'done';
  const { entitlement, tier, loading, refresh } = useEntitlement(user?.uid ?? null);

  // ?plan=monthly comes from the home page's plan cards, so the choice made
  // there is not silently thrown away on arrival. Annual otherwise: it is the
  // better value and the one the page recommends.
  const [plan, setPlan] = useState<PlanId>(params.get('plan') === 'monthly' ? 'monthly' : 'annual');
  const [waived, setWaived] = useState(false);
  const [showWaiverError, setShowWaiverError] = useState(false);
  const [opening, setOpening] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  // The demo account always holds a licence, which would hide the checkout
  // this page is in the demo to test.
  const pending = !DEMO && entitlement.tier !== 'free' && !hasStarted(entitlement);
  const subscribed = !DEMO && (tier !== 'free' || pending);

  // After checkout the webhook usually lands within a few seconds. Re-read
  // for about half a minute, then stop and let the message below take over.
  const [polls, setPolls] = useState(0);
  useEffect(() => {
    if (DEMO || !justPaid || subscribed || polls >= 10) return;
    const t = setTimeout(() => { refresh(); setPolls((n) => n + 1); }, 3000);
    return () => clearTimeout(t);
  }, [justPaid, subscribed, polls, refresh]);

  const needsAccount = !user || user.isAnonymous;
  const terms = renewalTerms(plan);

  async function buy(startNow: boolean) {
    setCheckoutError(null);
    if (startNow && !waived) { setShowWaiverError(true); return; }
    if (!CONFIG || !user) return;
    setOpening(true);
    try {
      const { openCheckout } = await import('./lib/paddleClient');
      await openCheckout(CONFIG, buildCheckoutRequest({
        config: CONFIG,
        plan,
        uid: user.uid,
        email: DEMO ? null : user.email,
        coolingOffWaived: startNow,
        origin: window.location.origin,
      }));
    } catch {
      setCheckoutError('The checkout could not be opened. If you use an ad or script blocker, allow paddle.com and try again.');
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="mx-auto max-w-[760px] px-5 py-10" style={{ color: 'var(--ink)' }}>
      <Link to="/account" style={{ font: '400 12.5px/1 var(--font-ui)', color: 'var(--ink3)', textDecoration: 'none' }}>
        ← Back to your account
      </Link>

      <h1 className="mt-6" style={{ fontFamily: 'var(--font-display)', fontSize: 32, letterSpacing: '-0.02em' }}>
        Unlock every region
      </h1>
      <p className="mt-3" style={prose}>
        Your chosen area stays free, for good. A subscription opens every other region: every
        muscle, bone and landmark, with the same spaced revision behind all of it.
      </p>

      {DEMO && (
        <p className="mt-6 rounded-[4px] px-4 py-3" style={{ ...prose, fontSize: 13.5, background: 'var(--sf)', border: '1px dashed var(--line)' }}>
          Sandbox test. No real payment is taken: pay with card 4242 4242 4242 4242, any future
          expiry date and CVC 100.
        </p>
      )}

      {DEMO && justPaid && (
        <div className="mt-8 rounded-[4px] px-5 py-4" style={{ background: 'var(--accs)', border: '1px solid var(--line)' }} role="status">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>Sandbox payment completed</div>
          <p className="mt-1.5" style={prose}>
            Paddle took the test payment and sent you back here. The demo has no webhook, so nothing
            unlocks. The transaction is in the Paddle sandbox dashboard.
          </p>
        </div>
      )}

      {!loading && subscribed && (
        <div className="mt-8 rounded-[4px] px-5 py-4" style={{ background: 'var(--accs)', border: '1px solid var(--line)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>
            {pending ? 'Your subscription is set up' : 'You have full access'}
          </div>
          <p className="mt-1.5" style={prose}>
            {pending && entitlement.startsAt
              ? `Your access starts on ${formatDate(entitlement.startsAt)}, when your 14 days are up. You can cancel for a full refund until then.`
              : entitlement.expiresAt
                ? `Paid up to ${formatDate(entitlement.expiresAt)}.`
                : 'Your access does not expire.'}
            {entitlement.source === 'licence' && ' Provided by your university.'}
          </p>
        </div>
      )}

      {!DEMO && justPaid && !subscribed && (
        <div className="mt-8 rounded-[4px] px-5 py-4" style={{ background: 'var(--sf)', border: '1px solid var(--line)' }} role="status">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>Payment received</div>
          <p className="mt-1.5" style={prose}>
            {polls < 10
              ? 'Unlocking your account. This usually takes a few seconds.'
              : 'This is taking longer than usual. Your payment is safe and the receipt is in your email. Reload this page in a minute, and if nothing has changed, reply to the receipt and we will sort it out.'}
          </p>
        </div>
      )}

      {!subscribed && !justPaid && (
        <>
          <div className="mt-8 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Plan">
            {PLANS.map((p) => {
              const selected = plan === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setPlan(p.id)}
                  className="rounded-[4px] px-5 py-4 text-left"
                  style={{
                    background: selected ? 'var(--accs)' : 'var(--sf)',
                    border: `1.5px solid ${selected ? 'var(--acc)' : 'var(--line)'}`,
                  }}
                >
                  <div style={cardLabel}>{p.label}</div>
                  <div className="mt-2" style={{ fontFamily: 'var(--font-display)', fontSize: 30, letterSpacing: '-0.01em' }}>
                    {p.price}
                    <span style={{ font: '400 14px/1 var(--font-ui)', color: 'var(--ink3)' }}> {p.per}</span>
                  </div>
                  <div className="mt-1.5" style={{ font: '400 13px/1.5 var(--font-ui)', color: 'var(--ink2)' }}>{p.note}</div>
                </button>
              );
            })}
          </div>

          <p className="mt-3" style={{ font: '400 12.5px/1.5 var(--font-ui)', color: 'var(--ink3)' }}>
            Prices include VAT. Payment is handled by Paddle, who appear on your statement.
          </p>

          {needsAccount ? (
            <div className="mt-8">
              <p style={prose}>
                Create an account first, so your subscription follows you to any device and is not lost
                if this browser is cleared. Your progress so far comes with you.
              </p>
              <button
                type="button"
                onClick={() => setShowAuth(true)}
                className="mt-4 rounded-[3px] px-5 py-3"
                style={{ font: '500 14.5px/1 var(--font-ui)', background: 'var(--acc-fill)', color: 'var(--onacc)' }}
              >
                Create an account
              </button>
            </div>
          ) : (
            <div className="mt-8">
              {/*
                PRE-CONTRACT INFORMATION, and it belongs above the pay button
                rather than in the receipt. The Consumer Contracts Regulations
                2013 require the price, the duration and how to cancel before
                the customer is bound; the DMCC subscription regime adds that
                auto-renewal must be told plainly rather than inferred from the
                word "subscription". The date is the part that does the work:
                a student who knows £29.99 comes out again on a named day is
                not the student who files a chargeback a year later.
              */}
              <div className="rounded-[3px] px-4 py-3.5" style={{ background: 'var(--sf)', border: '1px solid var(--line)' }}>
                <div style={cardLabel}>What you are agreeing to</div>
                <ul className="mt-2.5 flex flex-col gap-1.5" style={{ ...prose, fontSize: 13.5, listStyle: 'none', padding: 0, margin: 0 }}>
                  <li>
                    <strong style={{ color: 'var(--ink)' }}>{terms.price} {terms.frequency}</strong>, including VAT,
                    for every region of the body. There is no minimum term.
                  </li>
                  <li>
                    It <strong style={{ color: 'var(--ink)' }}>renews by itself</strong> {terms.frequency} until you
                    stop it. The next payment after today would be taken on{' '}
                    <strong style={{ color: 'var(--ink)' }}>{formatDate(terms.nextChargeAt)}</strong>.
                  </li>
                  <li>
                    Cancel any time from <strong style={{ color: 'var(--ink)' }}>Account → Subscription → Manage
                    subscription</strong>. It takes effect at the end of the period you have paid for, and costs
                    nothing.
                  </li>
                  <li>
                    Part-used periods are not refunded. Your 14-day cancellation right is set by the box below —
                    see <Link to="/refunds" style={{ color: 'var(--accd)' }}>cancellation and refunds</Link>.
                  </li>
                </ul>
              </div>

              <div className="mt-4">
                <CoolingOffWaiver checked={waived} onChange={(v) => { setWaived(v); if (v) setShowWaiverError(false); }} showError={showWaiverError} />
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
                <button
                  type="button"
                  disabled={!CONFIG || opening}
                  onClick={() => buy(true)}
                  className="rounded-[3px] px-5 py-3 disabled:opacity-50"
                  style={{ font: '500 14.5px/1 var(--font-ui)', background: 'var(--acc-fill)', color: 'var(--onacc)' }}
                >
                  {opening ? 'Opening checkout…' : 'Subscribe and start now'}
                </button>
                <button
                  type="button"
                  disabled={!CONFIG || opening}
                  onClick={() => buy(false)}
                  className="disabled:opacity-50"
                  style={{ font: '400 13.5px/1.4 var(--font-ui)', color: 'var(--accd)', textDecoration: 'underline' }}
                >
                  Subscribe and start in 14 days instead
                </button>
              </div>

              {!CONFIG && (
                <p className="mt-3" style={{ font: '400 13px/1.5 var(--font-ui)', color: 'var(--ink3)' }}>
                  Subscriptions are not open yet. Your free region stays free in the meantime.
                </p>
              )}
              {checkoutError && (
                <p className="mt-3" role="alert" style={{ font: '400 13.5px/1.5 var(--font-ui)', color: 'var(--acc2d)' }}>
                  {checkoutError}
                </p>
              )}
            </div>
          )}
        </>
      )}

      <p className="mt-10 border-t pt-5" style={{ ...prose, fontSize: 13, borderColor: 'var(--line)' }}>
        Cancel whenever you like, at no cost, and keep access until the end of the period you have
        paid for. Studying through your university? Ask your lecturer: if they have a licence, you
        will not need to pay. Full details:{' '}
        <Link to="/refunds" style={{ color: 'var(--accd)' }}>cancellation and refunds</Link>,{' '}
        <Link to="/terms" style={{ color: 'var(--accd)' }}>terms</Link>.
      </p>

      {showAuth && <AuthScreen onClose={() => setShowAuth(false)} />}
    </div>
  );
}

export default PricingPage;
