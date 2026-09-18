import { Link } from 'react-router-dom';
import { LegalLayout, legalHeading, legalProse } from './LegalLayout';

/**
 * /refunds — CR-033 item 12, and the thing gating the Paddle application.
 *
 * THE POLICY THE OWNER ASKED FOR, MADE LAWFUL. The intent was: no refunds,
 * cancel any time for free, keep access to the end of the paid period. The
 * middle and last of those are straightforward. A flat "no refunds" is not:
 * the Consumer Contracts Regulations 2013 give a consumer buying digital
 * content online fourteen days to cancel for a full refund, and a term
 * purporting to remove that is simply unenforceable.
 *
 * The regulations do allow exactly what was wanted, through one mechanism:
 * where the customer expressly consents to the content being supplied
 * immediately AND acknowledges that they thereby lose the cancellation right,
 * the right is lost. That consent has to be taken at checkout, actively, and
 * recorded — which is why this page and the checkout waiver are one job.
 *
 * DO NOT SIMPLIFY THIS PAGE INTO "no refunds". It would be a term that cannot
 * be relied on, in a document a merchant of record reviews before approving
 * the account, about a right the customer keeps whatever the page says.
 */

const EMAIL = 'michael@rehabme.uk';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 style={legalHeading}>{title}</h2>
      <div className="mt-2 flex flex-col gap-3" style={legalProse}>
        {children}
      </div>
    </section>
  );
}

export function RefundsPage() {
  return (
    <LegalLayout title="Cancellation and refunds" updated="18 September 2026">
      <p className="mt-4" style={legalProse}>
        The short version: you can cancel whenever you like, it costs nothing, and you keep access
        until the period you have already paid for runs out. Beyond that we do not refund part-used
        subscriptions. The longer version explains the one exception the law gives you, and how to
        use it.
      </p>

      <Section title="Cancelling">
        <p>
          Cancel at any time from your account screen. There is no fee, no notice period, no form to
          fill in and nobody to ask.
        </p>
        <p>
          <strong style={{ color: 'var(--ink)' }}>You keep access until the end of the period you
          have paid for.</strong> Cancelling on day three of a month does not cut you off on day
          three — it stops the next payment. Your subscription simply does not renew.
        </p>
        <p>
          We do not refund the unused remainder of a period you have already paid for. That is the
          trade for there being no minimum term and no cancellation fee.
        </p>
      </Section>

      <Section title="Your 14-day right to cancel, and what happens to it">
        <p>
          Buying digital content online in the UK normally gives you{' '}
          <strong style={{ color: 'var(--ink)' }}>14 days to change your mind</strong> and get a full
          refund, under the Consumer Contracts (Information, Cancellation and Additional Charges)
          Regulations 2013.
        </p>
        <p>
          There is one exception, and it applies here. If you ask for the subscription to start
          immediately — which is the point of buying it — and you confirm at checkout that you
          understand this ends your right to cancel, then that right ends when your access begins.
          You will be asked to tick a box saying exactly that. It is not buried, and the checkout
          will not proceed until you have.
        </p>
        <p>
          <strong style={{ color: 'var(--ink)' }}>If you would rather keep the 14 days, do not tick
          it.</strong> Your access then starts after the 14 days have passed, and you can cancel for
          a full refund at any point before it does. Nothing is withheld from you for choosing that;
          it simply delays the start.
        </p>
      </Section>

      <Section title="When we will refund you anyway">
        <p>
          Policies are for the ordinary case. These are the ones where we will refund without
          argument:
        </p>
        <p>
          <strong style={{ color: 'var(--ink)' }}>You were charged twice</strong>, or charged after
          cancelling. Always refunded in full.
        </p>
        <p>
          <strong style={{ color: 'var(--ink)' }}>The app was unusable for a meaningful stretch</strong>{' '}
          of what you paid for, because something was broken at our end. Tell us what happened and
          when; we will not make you prove it.
        </p>
        <p>
          <strong style={{ color: 'var(--ink)' }}>You were charged for a renewal you did not
          expect</strong> and had not used since it renewed. Ask, and we will refund it.
        </p>
        <p>
          Asking costs nothing and we would rather refund somebody than have them feel stuck. Email{' '}
          <a href={`mailto:${EMAIL}`} style={{ color: 'var(--accd)' }}>
            {EMAIL}
          </a>{' '}
          and you will get a reply within one month, and realistically within a few days.
        </p>
      </Section>

      <Section title="Who you are actually buying from">
        <p>
          Payments are handled by <strong style={{ color: 'var(--ink)' }}>Paddle</strong>, which acts
          as the merchant of record. Paddle is the seller for the transaction, appears on your bank
          statement, issues your receipt and handles VAT. Your subscription and your account are with
          us, and everything on this page applies whichever of us you contact first.
        </p>
        <p>
          If you bought through the Apple App Store, Apple is the seller instead, and Apple&rsquo;s
          own refund process applies — we cannot refund an App Store purchase even when we would
          like to. Apple&rsquo;s terms are not ours to set.
        </p>
      </Section>

      <Section title="Free use, and classes">
        <p>
          A substantial part of LocusMSK is free and always will be, and joining a class costs
          nothing. Nothing on this page applies to either — there is no payment to refund.
        </p>
      </Section>

      <Section title="Your rights either way">
        <p>
          Nothing here reduces your statutory rights. If the app is not as described, not of
          satisfactory quality, or not fit for purpose, the Consumer Rights Act 2015 gives you
          remedies regardless of what this page says.
        </p>
        <p>
          If we cannot resolve something between us, Citizens Advice can help at{' '}
          <a href="https://www.citizensadvice.org.uk/consumer/" target="_blank" rel="noreferrer noopener" style={{ color: 'var(--accd)' }}>
            citizensadvice.org.uk/consumer
          </a>
          .
        </p>
        <p>
          See also the <Link to="/terms" style={{ color: 'var(--accd)' }}>terms</Link> and the{' '}
          <Link to="/privacy" style={{ color: 'var(--accd)' }}>privacy policy</Link>.
        </p>
      </Section>
    </LegalLayout>
  );
}

export default RefundsPage;
