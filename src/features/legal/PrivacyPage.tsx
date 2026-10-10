import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LegalLayout, legalHeading, legalProse } from './LegalLayout';
import { INACTIVITY_LABEL } from '../anatomy-revision/data/retention';
import { DIAGNOSTIC_SIZE, MIN_PAIRED } from '../anatomy-revision/lib/diagnostic';

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
 * keep. The educator-visibility claim is now the strong one — a class owner
 * cannot read individual answers, and that is enforced by firestore.rules
 * rather than by what the UI renders (CR-031). See CohortMembership.tsx for
 * the same wording, and the warning there about never shipping this sentence
 * against rules that do not back it.
 *
 * NOT legal advice, and not a substitute for review before signing an
 * institutional contract.
 */

const CONTROLLER = 'Michael Neary, trading as Neary’s Sport Rehab';
const ADDRESS = '24 Hithercroft Road, HP13 5LS, United Kingdom';
const EMAIL = 'michael@rehabme.uk';
/**
 * The ICO registration reference, issued 14 September 2026.
 *
 * This paragraph used to link to https://ico.org.uk/ESDWebPages/Entry/<ref> so
 * a reader — realistically a university's DPO — could verify the number rather
 * than take it on trust. The link is deliberately NOT here yet: at the time of
 * writing the ICO still reports the entry as "will be published soon", and a
 * verification link that lands on a not-yet-published page raises the exact
 * doubt it exists to settle.
 *
 * Restore the link once the entry resolves in a browser. Keep the reference in
 * this constant when you do — the paragraph would then render it twice, and a
 * policy stating one number while linking to another is worse than stating none.
 */
const ICO_REGISTRATION = 'ZC247309';

/**
 * The fewest students who must have sat both tests before a class figure is
 * used OUTSIDE the course. docs/CLAIMS.md, "What a pilot needs before an
 * outcome claim goes public", condition 1. Stating it here binds it: lowering
 * it there means changing this page first, and telling the classes already
 * sitting. privacyPage.test.tsx holds the two together.
 */
export const PUBLIC_FIGURE_MIN_STUDENTS = 20;

/** Where the baseline and follow-up cards send "How this is used". */
export const DIAGNOSTIC_SECTION_ID = 'before-and-after-test';

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section className="mt-9" id={id} style={id ? { scrollMarginTop: 16 } : undefined}>
      <h2 style={legalHeading}>{title}</h2>
      <div className="mt-2 flex flex-col gap-3" style={legalProse}>
        {children}
      </div>
    </section>
  );
}

export function PrivacyPage() {
  // The page is loaded lazily, so a link to one of its sections arrives
  // before the section exists and the browser has nothing to scroll to.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView?.();
  }, []);

  return (
    <LegalLayout title="Privacy policy" updated="11 October 2026">
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
        <p>
          Registered with the Information Commissioner&rsquo;s Office, registration number{' '}
          <strong style={{ color: 'var(--ink)' }}>{ICO_REGISTRATION}</strong>.
        </p>
      </Section>

      <Section title="What is collected">
        <p>
          <strong style={{ color: 'var(--ink)' }}>Account details.</strong> Your email address and display name, from
          the sign-in method you choose (Google, or email and password). Until you create an account, a random
          identifier is stored on your device instead and no email is collected; revising needs an account.
        </p>
        <p>
          <strong style={{ color: 'var(--ink)' }}>Whether your email address is confirmed.</strong> The free area
          needs an email address that is confirmed to be yours. If you sign up with an email and password, we email
          that address a link to confirm it, and again only if you ask for it or sign in on another device before
          you have confirmed; a Google sign-in arrives already confirmed. Whether the address is confirmed is
          recorded with your sign-in. The email is sent for this purpose and no other: it is not a subscription to
          anything.
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
          how recently you were active and on which days, which structures you get wrong most, your mastery level for
          each structure (from Beginner to Master), how many sessions you finished, and your scores on the assignments
          they set. It is meant to tell them what the group finds hard, in time to reteach it.
        </p>
        <p>
          They cannot see your individual answers. Not the questions you got wrong one by one, not what you picked
          instead, not when you answered. What reaches them is counted up on your own device first — how often a
          structure was attempted and how often it was right, and the level that leaves you on — so the
          answer-by-answer record never leaves your account. This is enforced by the database’s own permission rules, not merely by what the app chooses to
          display.
        </p>
        <p>
          Leaving a class is a single action on your account screen, takes effect immediately, and stops any further
          visibility.
        </p>
      </Section>

      {/*
        THE DIAGNOSTIC (lib/diagnostic.ts, lib/diagnosticPapers.ts). Every
        sentence here is something the code does or a limit docs/CLAIMS.md
        sets, and privacyPage.test.tsx ties the ones that can drift to their
        source:
          - what a sitting stores: DiagnosticResult. A score, never the
            answer given to each question;
          - who can read it: firestore.rules gives users/{uid}/diagnostics to
            the student and to an admin, and to no class owner;
          - the class figure: scripts/cohortReport.ts, run by LocusMSK, over
            the class's CURRENT members, one paper at a time, with MIN_PAIRED
            as the floor. No educator screen shows it;
          - deletion: 'diagnostics' is in USER_SUBCOLLECTIONS, so it leaves
            with the account and is in the export.
        NO LAWFUL BASIS IS STATED FOR IT YET. The section above gives three,
        and which of them covers the class figure, and above all its use
        outside the course, is the owner's to decide and has not been
        decided (flagged 11 Oct 2026). Do not add one here by guessing.
      */}
      <Section title="The before-and-after test" id={DIAGNOSTIC_SECTION_ID}>
        <p>
          If you are in a class, the app offers you a short test twice: {DIAGNOSTIC_SIZE} questions soon after you
          join, and the same {DIAGNOSTIC_SIZE} about ten weeks later. Sitting it is your choice. It is not a mark, it
          changes nothing about what the app shows you or schedules for you, and nothing happens if you skip it.
        </p>
        <p>
          <strong style={{ color: 'var(--ink)' }}>What is kept.</strong> For each sitting: your score out of{' '}
          {DIAGNOSTIC_SIZE}, which paper you sat and which questions were on it, the date, how long you took, and the
          class you were in. The answer you gave to each question is not kept, so nobody, including us, can see which
          ones you got wrong.
        </p>
        <p>
          <strong style={{ color: 'var(--ink)' }}>Why.</strong> To see whether a class&rsquo;s scores changed over a
          term. One sitting on its own shows nothing, so a class figure counts only the students who sat both.
        </p>
        <p>
          <strong style={{ color: 'var(--ink)' }}>Who can see your score.</strong> You can: it is shown to you when
          you finish, and it is in Download my data. The person who runs LocusMSK can, because the class figure is
          added up from each student&rsquo;s score. Your course leader cannot, and neither can anyone else in your
          class. As with your answers, that is enforced by the database&rsquo;s permission rules.
        </p>
        <p>
          <strong style={{ color: 'var(--ink)' }}>What your course leader may be told.</strong> One overall figure for
          the class: the average score at the start and at the end, and how many students sat both. Never a name, and
          never one student&rsquo;s score. No figure is given unless at least {MIN_PAIRED} students in the class sat
          both tests on the same paper, because the average of a smaller group says too much about the people in it.
          Nothing about the test appears on your course leader&rsquo;s screens; we work the figure out ourselves.
        </p>
        <p>
          <strong style={{ color: 'var(--ink)' }}>Outside your course.</strong> An overall figure for a class, with no
          names, may also be used outside the course, for example to describe what happened to one class&rsquo;s
          scores over a term. That is done only for a class in which at least {PUBLIC_FIGURE_MIN_STUDENTS} students sat
          both tests, only with your course leader&rsquo;s written agreement, and never in a way that could pick out
          one student. Your course and university are not named without their permission.
        </p>
        <p>
          <strong style={{ color: 'var(--ink)' }}>Leaving, and deleting.</strong> If you leave the class, you are left
          out of any class figure worked out after that. Your scores stay in your account until it is deleted: Delete
          my account removes them with everything else, straight away. To have the test scores removed without
          deleting your account, email{' '}
          <a href={`mailto:${EMAIL}`} style={{ color: 'var(--accd)' }}>
            {EMAIL}
          </a>
          .
        </p>
      </Section>

      <Section title="Who else processes it">
        <p>
          <strong style={{ color: 'var(--ink)' }}>Google Firebase</strong> (Google Ireland Limited) provides
          authentication and the database, and sends the email that confirms your address.{' '}
          <strong style={{ color: 'var(--ink)' }}>Netlify</strong> hosts the site. Both
          act as processors on documented terms and use your data only to provide those services. Data may be
          transferred outside the UK under the safeguards those providers operate.
        </p>
        <p>Your data is not sold, and there is no advertising in this app and no advertising SDK in it.</p>
      </Section>

      <Section title="How long it is kept">
        <p>
          Account and revision data is kept while your account is active, and deleted after{' '}
          <strong style={{ color: 'var(--ink)' }}>{INACTIVITY_LABEL}</strong>. That is deliberately long enough to
          cover a placement year or a repeated year without losing your history.
        </p>
        <p>
          Delete your account at any time from your account screen and all of it goes immediately — your answers, your
          progress, your streaks, and the summary your class owner sees. There is no waiting period and no need to ask
          us.
        </p>
        <p>
          One thing has to come first if you have a subscription that is still set to renew: cancel it, on the same
          screen. We ask because deleting your account does not stop the payments, and you would have no account left
          to stop them from. Once it is cancelled you can delete straight away — you do not have to wait for the time
          you have paid for to run out, though deleting does give that time up.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          Two of these you can exercise yourself, without asking anyone: your account screen has{' '}
          <strong style={{ color: 'var(--ink)' }}>Download my data</strong>, which gives you everything held about you
          as a JSON file, and <strong style={{ color: 'var(--ink)' }}>Delete my account</strong>.
        </p>
        <p>
          You can also ask us to correct your data, restrict how it is used, or object to that use. Email{' '}
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
          for children, and creating an account requires confirming you are 16 or over before you can sign up by any
          route.
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
