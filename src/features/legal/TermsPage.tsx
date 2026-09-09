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
  return (
    <LegalLayout title="Terms of use" updated="9 September 2026">
      <p className="mt-4" style={legalProse}>
        LocusMSK is provided by {CONTROLLER}. Using it means accepting these terms.
      </p>

      <Section title="This is a revision tool, not a clinical resource">
        <p>
          <strong style={{ color: 'var(--ink)' }}>
            LocusMSK is an educational revision aid. It is not a clinical, diagnostic or treatment resource, and no
            warranty is given that its anatomical content is accurate or complete for clinical decision-making.
          </strong>
        </p>
        <p>
          Do not use it as a source of authority when assessing or treating a patient. Anatomical content is drawn from
          published teaching material and open anatomical models and may contain errors; some illustrations are
          computer-generated and are being replaced. For clinical practice, use a current textbook, your professional
          body&rsquo;s guidance and your supervisor.
        </p>
        <p>Nothing here creates a clinical relationship or constitutes medical advice.</p>
      </Section>

      <Section title="Your account">
        <p>
          You need to be 16 or over. Keep your sign-in details to yourself and do not share an account — a class
          owner&rsquo;s view of a shared account is misleading to them and unfair to you.
        </p>
        <p>You can delete your account at any time, which removes your data as described in the privacy policy.</p>
      </Section>

      <Section title="Classes">
        <p>
          Entering a join code adds you to that class and lets its owner see your performance, as set out in the{' '}
          <Link to="/privacy" style={{ color: 'var(--accd)' }}>privacy policy</Link>. Only join a class run by someone
          you intend to share that with. Leaving is immediate and always available.
        </p>
        <p>
          If you create a class, you are responsible for what you do with what you see. Use it to teach, not to single
          anyone out.
        </p>
      </Section>

      <Section title="Fair use">
        <p>
          Use LocusMSK for your own study or teaching. Do not attempt to extract the question bank in bulk, scrape the
          content, resell access, or interfere with how the service runs for other people.
        </p>
        <p>
          Access may be suspended for behaviour that damages the service or other users. Where that happens you can
          still export and delete your own data.
        </p>
      </Section>

      <Section title="Content and licensing">
        <p>
          Most anatomical imagery derives from Z-Anatomy and remains under Creative Commons Attribution-ShareAlike 4.0.
          You may reuse those images under that licence. The question bank, scheduling, analytics and the software
          itself are not covered by it and remain the property of {CONTROLLER}.
        </p>
        <p>
          Full credits are on the <Link to="/attributions" style={{ color: 'var(--accd)' }}>attributions page</Link>.
        </p>
      </Section>

      <Section title="Availability and liability">
        <p>
          The service is provided as it is. No promise is made that it will be uninterrupted, error-free, or available
          at any particular time — including during an exam period.
        </p>
        <p>
          Liability is not excluded for death or personal injury caused by negligence, for fraud, or for anything else
          the law does not permit to be excluded. Beyond that, and to the extent the law allows, no liability is
          accepted for indirect or consequential loss, or for academic outcomes arising from use of the app.
        </p>
      </Section>

      <Section title="Changes, and the law that applies">
        <p>
          These terms may change; material changes will be shown in the app before they take effect. They are governed
          by the law of England and Wales, and the courts of England and Wales have exclusive jurisdiction.
        </p>
        <p>
          Questions:{' '}
          <a href={`mailto:${EMAIL}`} style={{ color: 'var(--accd)' }}>
            {EMAIL}
          </a>
          .
        </p>
      </Section>
    </LegalLayout>
  );
}

export default TermsPage;
