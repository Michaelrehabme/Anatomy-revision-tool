import { Link } from 'react-router-dom';
import { CATEGORY_LABELS } from '../anatomy-revision/types/structure';
import { LegalLayout, legalHeading, legalLabel, legalProse } from './LegalLayout';
import { FAMILIES, WORKS, type FamilyProvenance } from './data/provenance.generated';

/**
 * /sources — where the anatomical content came from, family by family.
 *
 * The honest answer is uncomfortable and that is the point. This content was
 * drafted with AI assistance. The muscles came from a named lecture deck and
 * the ligament attachments have been checked against published works, but the
 * bones, joints and bony landmarks were written from standard anatomy and
 * checked against nothing. A student revising for an exam is entitled to know
 * which of those they are looking at, and to know it before they trust an
 * answer rather than after they get one wrong.
 *
 * EVERY NUMBER HERE IS DERIVED from provenance.generated.ts, which is built
 * from the root *-source-review JSONs — the same reason AttributionsPage
 * counts ALL_IMAGES rather than stating a figure. A hardcoded "110 of 143"
 * becomes a false statement about accuracy the first time somebody checks
 * another ligament, and accuracy is the one thing this page cannot be wrong
 * about. validateContent.ts fails the build if the generated file has drifted.
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

/** "2026-09-22" as a reader says it. A bare ISO date on a public page is a date nobody reads. */
function readableDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${d} ${months[m - 1]} ${y}`;
}

/**
 * One line saying how far this family has been checked. Written as a sentence
 * rather than a fraction because "0 of 31" reads as a score, and the state it
 * describes is "nobody has looked at these yet", which deserves plain words.
 */
function statusOf(f: FamilyProvenance): string {
  if (f.method === 'lecture-deck') return `All ${f.total} come from the teaching material named below.`;
  if (f.checked === 0) return 'Not yet checked against any published work.';
  // "against the sources listed" rather than "against published works": some
  // checks are the owner's own review, and the list below names them as such.
  if (f.checked < f.total) return `${f.checked} of the ${f.total} have been checked against the sources listed.`;
  return `All ${f.total} have been checked against the sources listed.`;
}

function FamilyBlock({ family }: { family: FamilyProvenance }) {
  const works = family.works.map((i) => WORKS[i]).filter(Boolean);

  return (
    <div className="mt-6">
      <div style={legalLabel}>
        {family.total} {CATEGORY_LABELS[family.category].toLowerCase()}
      </div>
      <p className="mt-1.5" style={{ ...legalProse, color: 'var(--ink)' }}>
        {statusOf(family)}
      </p>
      <p className="mt-1.5" style={legalProse}>
        {family.scope}
        {family.lastChecked ? ` Last checked ${readableDate(family.lastChecked)}.` : ''}
      </p>
      {family.held > 0 && (
        <p className="mt-1.5" style={legalProse}>
          {family.held} {family.held === 1 ? 'fact is' : 'facts are'} on hold: a published work contradicted what we
          had, and until that is settled {family.held === 1 ? 'it is' : 'they are'} not used in any question.
        </p>
      )}
      {works.length > 0 && (
        <ul className="mt-2 flex list-none flex-col gap-0.5 p-0">
          {works.map((work) => (
            <li key={work.title} style={{ font: '400 13px/1.6 var(--font-ui)', color: 'var(--ink2)' }}>
              {work.url ? (
                <a href={work.url} target="_blank" rel="noreferrer noopener" style={{ color: 'var(--accd)' }}>
                  {work.title}
                </a>
              ) : (
                work.title
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SourcesPage() {
  const total = FAMILIES.reduce((n, f) => n + f.total, 0);
  const checked = FAMILIES.reduce((n, f) => n + f.checked, 0);
  const unchecked = FAMILIES.filter((f) => f.checked < f.total);
  const untouched = FAMILIES.filter((f) => f.method === 'ai-drafted' && f.checked === 0);

  return (
    <LegalLayout title="Where this content comes from" updated="28 September 2026">
      <p className="mt-4" style={legalProse}>
        LocusMSK holds {total} structures. This page says where the information about each of them came from, what has
        been checked and against what, and what the checking does not cover. It is kept honest by the build: every
        number below is counted from the content itself rather than typed in.
      </p>

      <Section title="How this content was made">
        <p>
          <strong style={{ color: 'var(--ink)' }}>
            The anatomical content in this app was drafted with AI assistance, and then checked family by family against
            the sources named below.
          </strong>{' '}
          That is stated here rather than left to be discovered, because an AI draft is confident whether or not it is
          right, and you cannot tell the difference from inside a revision session.
        </p>
        <p>
          {checked} of the {total} structures currently rest on a named source
          {checked < total
            ? '. The rest were written from standard anatomy and have not yet been checked against anything; which is which is set out below.'
            : ' for the facts listed under each family below.'}
        </p>
        <p>
          Checking means the fact was looked up in a work named below and quoted from it, not recalled. Where a work
          contradicted what we had, the entry was corrected and the correction recorded; where the right answer was not
          clear, the fact was put on hold and taken out of the question bank rather than guessed at.
        </p>
        <p>
          A few facts were checked a different way. Whether a landmark can be felt through the skin is something
          anatomy texts describe in detail for bones and almost never state for touch, so those were checked by the
          project owner, a sports rehabilitation student, against their own palpation practice. That is a real check but
          not a clinician&rsquo;s sign-off, and where a published work and the owner’s review disagreed, the published work was
          followed.
        </p>
      </Section>

      <Section title="Family by family">
        <p>
          The works listed under each family are the ones its facts were checked against.
        </p>
        {FAMILIES.map((family) => (
          <FamilyBlock key={family.category} family={family} />
        ))}
      </Section>

      {/*
        Always rendered. It used to appear only while a family was unchecked, so
        the moment every count reached its total the page's most important limit
        vanished with it. "Checked" covers the fields named per family above and
        nothing else; that has to stay said however high the numbers go.
      */}
      <Section title="What the checking does not cover">
        <p>
          {untouched.length > 0 && (
            <>
              The{' '}
              {untouched
                .map((f) => `${f.total} ${CATEGORY_LABELS[f.category].toLowerCase()}`)
                .join(', ')
                .replace(/, ([^,]*)$/, ' and $1')}{' '}
              have not been checked against a published work at all. They were drafted from standard anatomy and are
              most likely right, but nobody has confirmed them, and this page will not pretend otherwise until somebody
              has.{' '}
            </>
          )}
          Each family above lists the facts that were checked. The ligament work checked where each ligament attaches;
          the descriptions have not been checked to the same standard, and neither have the joint descriptions.
        </p>
        <p>
          The short clinical notes some entries carry — the kind that say where a bone commonly fractures or which test
          examines a structure — are not covered by the check either. They are drafted content, and they are the part of
          this app furthest from a revision fact and closest to clinical advice, which is exactly why the warning below
          applies to them.
        </p>
        {unchecked.length > 0 && (
          <p>
            Unchecked content is still used in questions. The alternative — withholding it — would empty most of the app
            while saying less than this paragraph does. What is withheld is anything a published work actively
            contradicts.
          </p>
        )}
      </Section>

      <Section title="Imagery, and the muscle dataset">
        <p>
          The anatomical renders come from Z-Anatomy under Creative Commons Attribution-ShareAlike 4.0, and the full
          image-by-image credits are on the{' '}
          <Link to="/attributions" style={{ color: 'var(--accd)' }}>attributions page</Link>.
        </p>
        <p>
          The muscle data has a chain worth stating in full: it derives from a University of Salford teaching deck,
          which itself drew on Visible Body. The wording in this app is not that deck&rsquo;s — the action descriptions
          were re-derived from each muscle&rsquo;s own recorded actions and attachments, and the clinical sentences
          removed, so what ships is the anatomy rather than anyone&rsquo;s prose.
        </p>
      </Section>

      <Section title="This is a revision tool, not a clinical resource">
        <p>
          <strong style={{ color: 'var(--ink)' }}>
            LocusMSK is an educational revision aid. It is not a clinical, diagnostic or treatment resource, and no
            warranty is given that its anatomical content is accurate or complete for clinical decision-making.
          </strong>
        </p>
        <p>
          A page that names its sources can read as a page claiming authority. This one is not. For clinical practice,
          use a current textbook, your professional body&rsquo;s guidance and your supervisor. The full position is in
          the <Link to="/terms" style={{ color: 'var(--accd)' }}>terms of use</Link>.
        </p>
      </Section>

      <Section title="Found something wrong?">
        <p>
          Tell us and it gets checked. Errors reported this way are looked up in a published work and corrected at the
          source, so the fix reaches everyone rather than one answer.
        </p>
        <p>
          <a href={`mailto:${EMAIL}?subject=LocusMSK%20content%20correction`} style={{ color: 'var(--accd)' }}>
            {EMAIL}
          </a>
        </p>
      </Section>
    </LegalLayout>
  );
}

export default SourcesPage;
