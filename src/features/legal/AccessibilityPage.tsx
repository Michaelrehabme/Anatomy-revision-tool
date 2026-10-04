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
 *
 * REVISED 5 OCTOBER 2026 from docs/ACCESSIBILITY-AUDIT-2026-10-04.md. Three
 * rules were applied to every sentence, and should be applied to the next
 * edit:
 *
 *  1. IT SAYS WHAT WAS TESTED AND HOW, NOT WHAT STANDARD IS MET. An automated
 *     scan with axe-core's WCAG rule sets is a fact about a scan. "Tested
 *     against WCAG 2.1 AA" reads as a conformance claim, and nobody qualified
 *     to make one has looked at this app.
 *  2. NOTHING IS "ANNOUNCED" OR "READ". No screen reader has been run. The
 *     app marks things up for one; what NVDA or VoiceOver does with that is
 *     not known, and the page says so wherever it would otherwise imply it.
 *  3. LOCATE IS DESCRIBED AS IT IS TODAY. Alternatives are being worked on
 *     and are not promised here. When one ships, describe it then.
 *
 * The person who tests this app is the person who builds it: a student, not
 * an accessibility specialist. The page says that too.
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

const strong = { color: 'var(--ink)' } as const;

export function AccessibilityPage() {
  return (
    <LegalLayout title="Accessibility statement" updated="5 October 2026">
      <p className="mt-4" style={legalProse}>
        This statement applies to LocusMSK, an anatomy revision web application. The standard we are
        working towards is WCAG 2.2 level AA. We do not claim to meet it. This page says what we
        tested, how we tested it, and what we know fails.
      </p>

      <Section title="How accessible this app is">
        <p>
          <strong style={strong}>Partially compliant, on our own testing only.</strong> Every screen we
          tested can be used with a keyboard. The app is marked up for a screen reader, but we have not
          yet tested it with one, so we cannot tell you what a screen reader will actually say. One
          question type — locate, where you find a structure on an anatomical image — has no equivalent
          for someone who cannot see the image. The known problems are listed below rather than
          summarised, because a list you can check is worth more than a grade you cannot.
        </p>
      </Section>

      <Section title="What works">
        <p>
          Every question format the app offers can be answered from the keyboard alone, at desktop and
          phone width. On 4 October 2026 we worked through a whole session of each format — multiple
          choice, typed answers, flashcards, multi-select, locate and OINA cards, in study and in exam
          mode — in a browser using only the keyboard, through to the results page. Options are buttons
          reached by Tab, moved between with the arrow keys and chosen with Enter or Space. A chosen
          option is marked as chosen for a screen reader, and the focused control is outlined.
        </p>
        <p>
          When you check an answer, reveal a card, finish a session or open a page that has a main
          heading, focus moves to what has just appeared — the result, the answer, the score, the page's
          heading — rather than back to the top. In exam mode the app says an answer was recorded and nothing more, which is the
          same information a sighted student gets.
        </p>
        <p>
          Each page has its own title and a heading, and the navigation is marked as navigation with the
          current page identified.
        </p>
        <p>
          Pictures in a session have a text description: the view, what is in frame, what is
          highlighted, where it lies and what it attaches to. While a question is open the description
          leaves out whatever would answer it, and is given in full once you have answered.
        </p>
        <p>
          Ending a session asks first. If you have answered anything, the{' '}
          <strong style={strong}>End session</strong> control shows a short question in the page, not a
          pop-up, with focus on <strong style={strong}>Keep going</strong>; Escape also keeps the
          session, and focus returns to where it was. We checked this with the keyboard at both widths
          on 4 October 2026.
        </p>
        <p>
          Locate questions can be answered without a pointer. The{' '}
          <strong style={strong}>Answer from a list instead</strong> control replaces the image with a
          list of the structures on it, as ordinary buttons in alphabetical order. For landmarks and
          joints that list has a single name in it — see below.
        </p>
        <p>
          Text resizes with the browser. Right and wrong answers are marked in words as well as in
          colour. If you have asked your system to reduce motion, the app's animations do not run: on
          the three screens where we counted them, none was running with that setting on.
        </p>
      </Section>

      <Section title="What does not work yet">
        <p>
          <strong style={strong}>
            Locate has no equivalent without sight, and its keyboard route is weaker than it should be.
          </strong>{' '}
          The picture itself cannot be operated from a keyboard; the keyboard route is a list of names.
          That is a different and easier exercise than finding a structure on an image, because the
          options are given to you. On landmark and joint pictures — about a third of locate questions —
          the list contains only the answer, so the question answers itself. A student who cannot see
          the picture is not offered the same exercise in another form. That is how it is today, and we
          are not going to describe it as solved before it is.
        </p>
        <p>
          <strong style={strong}>
            Picture descriptions are generated, cover sessions only, and have not been heard on a
            screen reader.
          </strong>{' '}
          They are written from the app's own data, not by hand, for every picture a question shows. The
          pictures on a structure card and in the Atlas have only a name. A description places a
          structure roughly — &ldquo;upper middle of the picture, the clavicle above it&rdquo; — which
          is enough to orient by and not a substitute for seeing it.
        </p>
        <p>
          <strong style={strong}>We have not tested with a screen reader.</strong> No session has been
          run with NVDA or VoiceOver. Anything this page says about what a screen reader is given is
          what the app exposes to one, read back by a script, not what we have heard one say.
        </p>
        <p>
          <strong style={strong}>No independent audit has been carried out.</strong> This is our own
          testing, done by the person who builds the app, who is a student and not an accessibility
          specialist. On 28 and 29 September 2026 we ran an automated checker (axe-core, using its WCAG
          2.0 and 2.1 level A and AA rules) over eleven screens and a live question, at desktop and
          phone width, in light and dark, and worked through a session with the keyboard on a desktop.
          On 4 October 2026 we repeated the keyboard pass at phone width, extended it to every question
          format, and ran the checker on each. What those found is fixed or listed here. An automated
          checker finds only some kinds of problem, and passing it is not the same as meeting the
          standard.
        </p>
        <p>
          <strong style={strong}>Some screens were checked by reading the code, not by using them.</strong>{' '}
          The update prompt, the starting diagnostic, the confirmation before deleting an account, and
          the signed-in half of checkout could not be reached in the build we tested. Fill-the-blank
          questions are not offered in any session at present.
        </p>
        <p>
          <strong style={strong}>Smaller keyboard problems we know about.</strong> The theme and plan
          choices are presented to a screen reader as radio buttons but are separate Tab stops and do
          not answer to the arrow keys. On Today, the area picker, session setup and sign-in the top heading
          is a second-level heading, not a main one, so focus is not moved to it when you arrive: after
          you end a session, focus is left on the page as a whole. The area picker offers each body region twice, once on
          the figure and once in the list. There is no skip link past the navigation. When focus moves
          to a result heading there is no visible outline until the next Tab.
        </p>
        <p>
          <strong style={strong}>Contrast is measured for the palette, not every state.</strong>{' '}
          Every text and background pairing in all four themes (light, dark, and both high-contrast
          versions) is measured by the app's test suite, which also fails if the lighter accent is ever
          used for text. That cannot see text dimmed by other means: the October check found
          achievements not yet earned dimmed below 4.5:1. The dimming has been removed and that text now
          uses a measured colour. The focus outline on a selected option is about 3.1:1 against its pale
          background, just above the minimum for an outline, and is being checked by eye.
        </p>
      </Section>

      <Section title="What we are doing about it">
        <p>
          Before the first pilot cohort completes a term: a full revision session with NVDA and with
          VoiceOver, and an independent pass if a pilot institution can provide one, with the findings
          published here.
        </p>
        <p>Descriptions for the pictures on structure cards and in the Atlas.</p>
        <p>
          The same automated check repeated before each release, so a fixed problem cannot quietly
          return.
        </p>
        <p>
          Locate without sight is being worked on. This page will describe what is built when it is
          built.
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
          First prepared on 18 September 2026 and last revised on 5 October 2026, based on our own
          testing. It will be reviewed when the items above are addressed, and at least once a year.
        </p>
      </Section>
    </LegalLayout>
  );
}

export default AccessibilityPage;
