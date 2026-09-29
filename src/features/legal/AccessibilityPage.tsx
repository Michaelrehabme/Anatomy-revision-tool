import { Link } from 'react-router-dom';
import { LegalLayout, legalHeading, legalProse } from './LegalLayout';

/**
 * /accessibility — CR-033 item 6.
 *
 * Written for a university's procurement or information governance reviewer as
 * much as for a student. Institutions bound by the public sector accessibility
 * regulations increasingly ask a supplier for a statement at procurement, and
 * the thing that loses the contract is not an admitted gap — it is silence, or
 * a claim the reviewer can disprove in five minutes with a keyboard.
 *
 * So this says "partially compliant" and names what fails. Every unfixed item
 * below carries a date. Do not soften this copy without fixing the thing it
 * describes; a statement that overstates is worse than none, because the first
 * thing an assessor does is test one claim.
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

export function AccessibilityPage() {
  return (
    <LegalLayout title="Accessibility statement" updated="29 September 2026">
      <p className="mt-4" style={legalProse}>
        This statement applies to LocusMSK, an anatomy revision web application. It is written against
        WCAG 2.2 level AA.
      </p>

      <Section title="How accessible this app is">
        <p>
          <strong style={{ color: 'var(--ink)' }}>Partially compliant.</strong> Most of the app can be
          used with a keyboard and a screen reader. One question type — locate, where you identify a
          structure on an anatomical image — is inherently visual, and while it has a non-visual route,
          that route gives a different experience rather than an equivalent one. The known problems are
          listed below rather than summarised, because a list you can check is worth more than a grade
          you cannot.
        </p>
      </Section>

      <Section title="What works">
        <p>
          Every question format can be answered from the keyboard alone. Options are ordinary buttons
          reachable by Tab and activated by Enter or Space, and the focused element is always outlined.
        </p>
        <p>
          When you check an answer, focus moves to the result, so a screen reader reads it straight away
          — whether it was right and, where the app reveals it, what the correct answer was. Before 28
          September 2026 the result was only read out after you rated your confidence, and not at all on
          a phone; that is fixed. In assessment mode the app tells you an answer was recorded and nothing
          more, which is the same information a sighted student gets.
        </p>
        <p>
          Each page has its own title and a main heading, the navigation is marked as navigation with the
          current page identified, and in multiple choice the option you have chosen is announced as
          selected. The arrow keys move between options without choosing one.
        </p>
        <p>
          Locate questions can be answered without a pointer. The{' '}
          <strong style={{ color: 'var(--ink)' }}>Answer from a list instead</strong> control replaces
          the image with the named structures visible on it, as ordinary buttons.
        </p>
        <p>
          Text resizes with the browser, colour is never the only way information is given, and the app
          works without JavaScript animations for anyone who has asked their system to reduce motion.
        </p>
      </Section>

      <Section title="What does not work yet">
        <p>
          <strong style={{ color: 'var(--ink)' }}>The locate list is not equivalent.</strong> Choosing a
          name from a list is an easier question than finding a structure on an image: the options are
          given to you. A student using it is not doing quite the same exercise. We have not found an
          honest way to close that gap and are not going to pretend otherwise.
        </p>
        <p>
          <strong style={{ color: 'var(--ink)' }}>Anatomical images have no long descriptions.</strong>{' '}
          A screen reader is told that an image is there and that the list route exists; it is not told
          what the image shows. Writing useful alternative text for 1,000 anatomical plates is a
          substantial content project, not a code change.
        </p>
        <p>
          <strong style={{ color: 'var(--ink)' }}>No independent audit has been carried out.</strong> On
          28 and 29 September 2026 we ran an automated scan against the WCAG 2.1 AA rules (axe-core) over
          eleven screens and a live question, at desktop and phone width, in light and dark, and worked
          through a revision session with the keyboard alone on a desktop. We fixed what it found and
          list what remains here. We have not yet repeated the keyboard pass on a phone, or tested with
          NVDA or VoiceOver end to end. This is our own testing, not an assessment, and we will say so to
          anyone who asks.
        </p>
        <p>
          <strong style={{ color: 'var(--ink)' }}>Contrast is measured for the palette, not every
          state.</strong>{' '}
          Every text and background pairing in all four themes (light, dark, and both high-contrast
          versions) is measured by the app's test suite, which also fails if the lighter accent is ever
          used for text. The September scan found small labels and filter counts below the minimum; both
          were fixed. The focus outline on a selected option is about 3.1:1 against its pale background,
          just above the minimum for an outline, and is being checked by eye.
        </p>
      </Section>

      <Section title="What we are doing about it">
        <p>
          Before the first pilot cohort completes a term: a keyboard pass on a phone, a full revision
          session with NVDA and with VoiceOver, and an independent pass if a pilot institution can
          provide one, with the findings published here.
        </p>
        <p>
          Alternative text for the most-used anatomical plates, starting with those a first session
          shows, rather than attempting all of them at once.
        </p>
        <p>
          The same automated scan repeated before each release, so a fixed problem cannot quietly
          return.
        </p>
      </Section>

      <Section title="Telling us about a problem">
        <p>
          If something here stops you using the app, email{' '}
          <a href={`mailto:${EMAIL}`} style={{ color: 'var(--accd)' }}>
            {EMAIL}
          </a>
          . Say what you were trying to do and what happened, and you will get a reply within one month
          — usually much sooner. If you need something in a different format, ask and we will do what we
          can.
        </p>
        <p>
          If you are unhappy with the response, the Equality Advisory and Support Service can help:{' '}
          <a href="https://www.equalityadvisoryservice.com/" target="_blank" rel="noreferrer noopener" style={{ color: 'var(--accd)' }}>
            equalityadvisoryservice.com
          </a>
          .
        </p>
      </Section>

      <Section title="For institutions assessing this app">
        <p>
          We are a sole trader and hold no formal conformance report, ISO certification or third-party
          audit. What we can give you is this statement, a walkthrough of any flow you want to see, and
          straight answers about what does not work. If your process requires something we do not have,
          tell us what it is rather than assuming we have it.
        </p>
        <p>
          See also the <Link to="/privacy" style={{ color: 'var(--accd)' }}>privacy policy</Link> and{' '}
          <Link to="/terms" style={{ color: 'var(--accd)' }}>terms</Link>.
        </p>
      </Section>

      <Section title="This statement">
        <p>
          Prepared on 18 September 2026, based on our own testing of the live application. It will be
          reviewed when the items above are addressed, and at least once a year.
        </p>
      </Section>
    </LegalLayout>
  );
}

export default AccessibilityPage;
