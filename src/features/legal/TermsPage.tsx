import { Link } from 'react-router-dom';
import { LegalLayout, legalHeading, legalProse } from './LegalLayout';

/**
 * /terms — CR-025 item 2.
 *
 * The clause that matters is the clinical one. This app teaches attachments
 * and innervation to people who will go on to treat patients, and 14 of its
 * images are still AI-generated (CR-026). Saying plainly that it is a revision
 * aid and not a clinical reference is both honest and the thing that stops a
 * student citing it as authority for a decision about a real person.
 *
 * NOT legal advice, and worth a solicitor's eye before signing an
 * institutional contract.
 */

const CONTROLLER = 'Michael Neary, trading as Neary’s Sport Rehab';
const EMAIL = 'michael@rehabme.uk';
// A geographic address is required for a trader selling online (Consumer Contracts Regulations 2013).
const ADDRESS = 'Marsh House, Marsh Road, Little Kimble, Aylesbury, Buckinghamshire HP22 5XS';

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

export function TermsPage() {
  const link = { color: 'var(--accd)' };
  const strong = { color: 'var(--ink)' };
  return (
    <LegalLayout title="Terms of use" updated="22 November 2026">
      <p className="mt-4" style={legalProse}>
        LocusMSK is provided by {CONTROLLER}, {ADDRESS}. You can contact us at{' '}
        <a href={`mailto:${EMAIL}`} style={link}>{EMAIL}</a>. Creating an account, or using LocusMSK, means you accept
        these terms. Nothing in them affects your legal rights as a consumer.
      </p>

      <Section title="This is a revision tool, not a clinical resource">
        <p>
          <strong style={strong}>
            LocusMSK is an educational revision aid. It is not a clinical, diagnostic or treatment resource, and it must
            not be relied on for decisions about a real patient.
          </strong>
        </p>
        <p>
          Do not use it as a source of authority when assessing or treating a patient. Anatomical content is drafted
          with AI assistance and checked against published works family by family; some of it has not been checked yet,
          and it may contain errors. The <Link to="/sources" style={link}>sources page</Link> says which is which. For
          clinical practice, use a current textbook, your professional body&rsquo;s guidance and your supervisor.
        </p>
        <p>Nothing here creates a clinical relationship or constitutes medical advice.</p>
      </Section>

      <Section title="If you find an error">
        <p>
          Use <strong style={strong}>Report a problem</strong> in the app, or email{' '}
          <a href={`mailto:${EMAIL}?subject=LocusMSK%20content%20correction`} style={link}>{EMAIL}</a>. We check every
          report against a published source, aim to look at it within 14 days, and correct confirmed errors for
          everyone. Please don&rsquo;t include personal or patient information in a report. Every correction is listed on
          the <Link to="/corrections" style={link}>corrections page</Link>.
        </p>
        <p>
          If you send us feedback, error reports or suggestions, you allow us to use them to improve LocusMSK without
          payment.
        </p>
      </Section>

      <Section title="Your account">
        <p>
          You need to be 16 or over. Keep your sign-in details to yourself and do not share an account — a class
          owner&rsquo;s view of a shared account is misleading to them and unfair to you.
        </p>
        <p>
          You can delete your account at any time, which removes your data as described in the{' '}
          <Link to="/privacy" style={link}>privacy policy</Link>.
        </p>
      </Section>

      <Section title="Paid plans">
        <p>
          Some features need a paid plan. Prices, including VAT, are shown before you pay. Monthly and yearly plans
          renew automatically at the end of each period until you cancel.
        </p>
        <p>
          You can cancel at any time from your account screen. You keep access until the end of the period you have
          paid for, and it will not renew. If we change the price, we will tell you at least 30 days before the new
          price applies, and you can cancel before it does.
        </p>
        <p>
          Payments are processed by Paddle, which acts as the seller (merchant of record) for the transaction. Your
          cancellation and refund rights, including your 14-day right to cancel, are set out on the{' '}
          <Link to="/refunds" style={link}>cancellation and refunds page</Link>.
        </p>
        <p>
          If you got LocusMSK from an app store, that store&rsquo;s own terms and refund process also apply to purchases
          made there, and the store is not responsible for the app itself.
        </p>
      </Section>

      <Section title="Classes">
        <p>
          Entering a join code adds you to that class and lets its owner see your performance, as set out in the{' '}
          <Link to="/privacy" style={link}>privacy policy</Link>. Only join a class run by someone you intend to share
          that with. Leaving is immediate and always available.
        </p>
        <p>
          If you create a class, you are responsible for what you do with what you see. Use it to teach, not to single
          anyone out. Educators remain responsible for their own curriculum, teaching and assessment.
        </p>
        <p>
          If your class is provided through your university or college, your institution&rsquo;s agreement with us also
          applies.
        </p>
      </Section>

      <Section title="Fair use">
        <p>
          Use LocusMSK for your own study or teaching. Do not:
        </p>
        <ul className="ml-5 list-disc">
          <li>extract the question bank in bulk, scrape the content, or use bots or other automated access;</li>
          <li>resell or share access;</li>
          <li>copy, decompile or reverse-engineer the software;</li>
          <li>
            use the question bank or images to train AI models or to build a competing product (other than reusing
            Creative Commons images under their licence);
          </li>
          <li>interfere with how the service runs for other people.</li>
        </ul>
        <p>
          Access may be suspended or ended for serious or repeated breaches of these terms, including account sharing.
          Where that happens you can still export and delete your own data.
        </p>
      </Section>

      <Section title="Content and licensing">
        <p>
          While your account is active, we give you a personal, non-transferable licence to use LocusMSK for your own
          study or teaching.
        </p>
        <p>
          Most anatomical imagery derives from Z-Anatomy and remains under Creative Commons Attribution-ShareAlike 4.0.
          You may reuse those images under that licence. The question bank, scheduling, analytics and the software
          itself are not covered by it and remain the property of {CONTROLLER}.
        </p>
        <p>
          Full credits are on the <Link to="/attributions" style={link}>attributions page</Link>.
        </p>
      </Section>

      <Section title="Changes to LocusMSK, and if we close it">
        <p>
          We may change the content and features, for example to correct errors, add structures or meet legal
          requirements. If a change significantly reduces what you have paid for, we will tell you in advance and you can
          cancel and get a refund for any time you have paid for but not used.
        </p>
        <p>
          If we stop providing LocusMSK, we will give you at least one month&rsquo;s notice where we can, let you export
          your data, and refund any time you have paid for but not used. The same refund applies if we end your paid
          plan for a reason that is not your fault.
        </p>
      </Section>

      <Section title="Availability">
        <p>
          We take reasonable care to keep LocusMSK accurate and available, but we cannot promise it will be free of
          errors or interruptions, including during exam periods.
        </p>
        <p>
          We are not responsible for delays or failures caused by events outside our reasonable control, such as
          outages at our hosting or payment providers. If that stops you using a paid plan for more than 7 days in a
          row, you can cancel and get a refund for the unused time.
        </p>
      </Section>

      <Section title="Your rights and our liability">
        <p>
          If you pay for LocusMSK, the Consumer Rights Act 2015 entitles you to content that is as described, of
          satisfactory quality and fit for purpose, and to a repair, replacement or refund if it is not. These terms do
          not take those rights away.
        </p>
        <p>
          If we break these terms or fail to use reasonable care and skill, we are responsible for loss you suffer that
          was a foreseeable result. We are not responsible for loss that was not foreseeable. LocusMSK is for personal
          study and teaching; it is not supplied for business use or as a clinical, diagnostic or treatment service, so
          we are not responsible for loss of profit, business or opportunity, for decisions about patients, or for exam
          results and other academic outcomes.
        </p>
        <p>
          We do not exclude or limit liability for death or personal injury caused by our negligence, for fraud, or for
          anything else the law does not allow us to exclude.
        </p>
      </Section>

      <Section title="Complaints">
        <p>
          Please contact us first at <a href={`mailto:${EMAIL}`} style={link}>{EMAIL}</a>; we will reply within 14 days.
          If we can&rsquo;t resolve it between us, Citizens Advice can help at{' '}
          <a href="https://www.citizensadvice.org.uk/consumer/" style={link}>citizensadvice.org.uk/consumer</a>.
        </p>
      </Section>

      <Section title="Changes to these terms, and the law that applies">
        <p>
          We may update these terms. We will show material changes in the app at least 30 days before they take effect,
          and if you don&rsquo;t accept them you can cancel before then.
        </p>
        <p>
          These terms are governed by the law of England and Wales. You can bring legal proceedings about them in the
          courts of England and Wales. If you live in Scotland, you can also bring them in Scotland; if you live in
          Northern Ireland, you can also bring them in Northern Ireland.
        </p>
        <p>
          If any part of these terms is found to be unenforceable, the rest still applies. If we don&rsquo;t enforce a
          term straight away, we can still enforce it later. We may transfer this agreement to someone else, for example
          if the business is sold, without reducing your rights; you may not transfer it.
        </p>
      </Section>
    </LegalLayout>
  );
}

export default TermsPage;
