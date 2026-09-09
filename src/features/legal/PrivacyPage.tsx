import { Link } from 'react-router-dom';
import { LegalLayout, legalHeading, legalProse } from './LegalLayout';

/**
 * /privacy — CR-025 item 1.
 *
 * This is the document that decides whether a pilot can run. A university will
 * not let named students generate performance data visible to a course leader
 * without a published policy, a stated lawful basis and a deletion route, and
 * that applies to a free pilot exactly as it does to a paid product.
 *
 * Written to be read rather than to be survived: short sentences, the
 * educator-visibility section stated plainly, and no claim the system does not
 * keep. In particular it does NOT say educators cannot see individual answers
 * — they technically can, until CR-031 removes that access — so it says what
 * the app shows instead. See CohortMembership.tsx for the same wording.
 *
 * NOT legal advice, and not a substitute for review before signing an
 * institutional contract.
 */

const CONTROLLER = 'Michael Neary, trading as Neary’s Sport Rehab';
const ADDRESS = '24 Hithercroft Road, HP13 5LS, United Kingdom';
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

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy policy" updated="9 September 2026">
      <p className="mt-4" style={legalProse}>
        LocusMSK is an anatomy revision app for musculoskeletal students. This policy explains what it collects, why,
        how long it keeps it, and what you can do about it.
      </p>

      <Section title="Who is responsible">
        <p>
          The data controller is <strong style={{ color: 'var(--ink)' }}>{CONTROLLER}</strong>, {ADDRESS}. For anything
          in this policy, including a request about your data, contact{' '}
          <a href={`mailto:${EMAIL}`} style={{ color: 'var(--accd)' }}>
            {EMAIL}
          </a>
          .
        </p>
        <p style={{ color: 'var(--acc2d)' }}>
          {/* Replace once registered — see the ICO tier 1 fee. */}
          ICO registration: pending. This will be updated with the registration number once issued.
        </p>
      </Section>

      <Section title="What is collected">
        <p>
          <strong style={{ color: 'var(--ink)' }}>Account details.</strong> Your email address and display name, from
          the sign-in method you choose (Google, or email and password). If you use the app without an account, a
          random identifier is stored on your device instead and no email is collected.
        </p>
        <p>
          <strong style={{ color: 'var(--ink)' }}>Revision activity.</strong> Every question you answer: which
          structure, which question type, whether you were right, the answer you gave, how long you took, and when. This
          is what the app is for — the scheduling that decides what you see next is computed from it.
        </p>
        <p>
          <strong style={{ color: 'var(--ink)' }}>Technical data.</strong> Standard information your browser or device
          sends when it connects, including an IP address, handled by the services listed below.
        </p>
        <p>
          No special category data is collected. LocusMSK is a study tool: it holds no health information about you, and
          asks for none.
        </p>
      </Section>

      <Section title="Why, and on what legal basis">
        <p>
          <strong style={{ color: 'var(--ink)' }}>To provide the app</strong> — your account and revision history exist
          so the app can work across your devices and schedule your reviews. Lawful basis: performance of a contract,
          being the terms you accept by using it.
        </p>
        <p>
          <strong style={{ color: 'var(--ink)' }}>To show your work to a class you join</strong> — see below. Lawful
          basis: your consent, given by entering a join code and withdrawn by leaving the class.
        </p>
        <p>
          <strong style={{ color: 'var(--ink)' }}>To keep the app working and improve it</strong> — aggregate usage,
          error rates and which questions are answered badly. Lawful basis: legitimate interests, being the interest in
          a product that works. This never involves reading an individual&rsquo;s history to profile them.
        </p>
      </Section>

      <Section title="Classes, and what your educator can see">
        <p>
          You are never added to a class automatically. A class exists only after you enter its join code, and it is
          the one part of this app where another person sees your work.
        </p>
        <p>
          While you are in a class, its owner — normally your module leader — can see your name, your overall accuracy,
          how recently you were active, and which structures you get wrong most. It is meant to tell them what the
          group finds hard, in time to reteach it.
        </p>
        <p>
          The app does not show them a question-by-question record of your answers. It is honest to add that your answer
          history is stored under your account and the current permissions covering a class owner extend to it, even
          though nothing in the app presents it. Work is underway to remove that access entirely; this policy will be
          updated when it is done.
        </p>
        <p>
          Leaving a class is a single action on your account screen, takes effect immediately, and stops any further
          visibility.
        </p>
      </Section>

      <Section title="Who else processes it">
        <p>
          <strong style={{ color: 'var(--ink)' }}>Google Firebase</strong> (Google Ireland Limited) provides
          authentication and the database. <strong style={{ color: 'var(--ink)' }}>Netlify</strong> hosts the site. Both
          act as processors on documented terms and use your data only to provide those services. Data may be
          transferred outside the UK under the safeguards those providers operate.
        </p>
        <p>Your data is not sold, and there is no advertising in this app and no advertising SDK in it.</p>
      </Section>

      <Section title="How long it is kept">
        <p>
          Account and revision data is kept while your account is active, and deleted after{' '}
          <strong style={{ color: 'var(--ink)' }}>24 months of inactivity</strong>. That is deliberately long enough to
          cover a placement year or a repeated year without losing your history.
        </p>
        <p>Delete your account at any time and it goes sooner — see below.</p>
      </Section>

      <Section title="Your rights">
        <p>
          You can ask for a copy of your data, correct it, delete it, take it elsewhere in a portable format, restrict
          how it is used, or object to that use. Email{' '}
          <a href={`mailto:${EMAIL}`} style={{ color: 'var(--accd)' }}>
            {EMAIL}
          </a>{' '}
          and you will get a response within one month.
        </p>
        <p>
          If you are unhappy with how that goes, you can complain to the Information Commissioner&rsquo;s Office at{' '}
          <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noreferrer noopener" style={{ color: 'var(--accd)' }}>
            ico.org.uk/make-a-complaint
          </a>
          , or on 0303 123 1113.
        </p>
      </Section>

      <Section title="Age">
        <p>
          LocusMSK is for students aged <strong style={{ color: 'var(--ink)' }}>16 or over</strong>. It is not designed
          for children and accounts should not be created for anyone younger.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          Material changes will be shown in the app before they take effect. The date at the top of this page is when
          it was last revised.
        </p>
        <p>
          See also the <Link to="/terms" style={{ color: 'var(--accd)' }}>terms</Link> and the{' '}
          <Link to="/attributions" style={{ color: 'var(--accd)' }}>attributions</Link> for the licensing of the
          anatomical imagery.
        </p>
      </Section>
    </LegalLayout>
  );
}

export default PrivacyPage;
