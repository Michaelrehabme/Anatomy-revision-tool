import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LegalLayout, legalHeading, legalLabel, legalProse } from '../../legal/LegalLayout';
import { FAMILIES } from '../../legal/data/provenance.generated';
import { CATEGORY_LABELS } from '../../anatomy-revision/types/structure';
import { AREAS } from '../../anatomy-revision/types/region';
import { PLANS } from '../../billing/lib/checkout';
import { COMPARISON_ROWS, RECHECK_BY, asOf, readableDate, type ComparisonRow } from '../data/comparison';

/**
 * /compare — DRAFT (CR-033 item 17). Unlinked from every menu and marked
 * noindex until the owner approves it; see the gate in App.tsx.
 *
 * WHAT THIS PAGE IS. A price list, with dates. The evidence on file is a set
 * of pricing-page screenshots, so prices and plan names are all it can
 * support — it does not say who is better, more accurate or more effective,
 * because no screenshot shows that. It also says plainly what the other
 * products list that LocusMSK does not have: a comparison that only counts
 * one way is an advert, and a student will find out in a week anyway.
 *
 * NO "CHEAPER THAN" SENTENCE. The figures sit side by side and the reader can
 * subtract. A sentence would need re-proving every time anybody changed a
 * price; a dated figure is true for ever about its date.
 *
 * OUR OWN NUMBERS ARE DERIVED: prices from PLANS (what /pricing charges), the
 * structure count from the same generated file /sources counts, regions from
 * AREAS. Nothing here is typed in, so nothing here can drift.
 */

const cell = { ...legalProse, padding: '9px 0', verticalAlign: 'top' as const };

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

function Lines({ lines, caption }: { lines: { label: string; text: string }[]; caption: string }) {
  return (
    <table className="mt-3 w-full" style={{ borderCollapse: 'collapse' }}>
      <caption className="sr-only">{caption}</caption>
      <tbody>
        {lines.map((line) => (
          <tr key={line.label} style={{ borderTop: '1px solid var(--line)' }}>
            <th scope="row" style={{ ...cell, ...legalLabel, lineHeight: 1.65, width: '34%', textAlign: 'left', paddingRight: 12 }}>
              {line.label}
            </th>
            <td style={{ ...cell, color: 'var(--ink)' }}>{line.text}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CompetitorBlock({ row }: { row: ComparisonRow }) {
  return (
    <article className="mt-7" data-comparison-row={row.id}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink)' }}>{row.product}</h3>
      <p className="mt-1" style={legalProse}>{row.kind}.</p>
      <Lines lines={row.lines} caption={`${row.product} prices`} />
      <p className="mt-2" style={{ ...legalProse, fontSize: 13 }} data-evidence={row.evidence.file}>
        {asOf(row.evidence)}, from{' '}
        <a href={row.evidence.url} rel="noopener noreferrer nofollow" style={{ color: 'var(--accd)' }}>
          {row.evidence.url.replace(/^https?:\/\/(www\.)?/, '')}
        </a>
        {row.currency === 'USD' ? '. Shown in US dollars to a UK visitor; not converted here.' : '.'}
      </p>
    </article>
  );
}

export function ComparisonPage() {
  // A draft must not be indexed. The Netlify header (netlify.toml) says the
  // same thing to a crawler that does not run scripts.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    const title = document.title;
    document.title = 'How LocusMSK compares · LocusMSK';
    return () => {
      meta.remove();
      document.title = title;
    };
  }, []);

  const total = FAMILIES.reduce((n, f) => n + f.total, 0);
  const families = FAMILIES.map((f) => `${f.total} ${CATEGORY_LABELS[f.category].toLowerCase()}`);
  const monthly = PLANS.find((p) => p.id === 'monthly');
  const annual = PLANS.find((p) => p.id === 'annual');
  const captured = COMPARISON_ROWS[0].evidence.capturedOn;

  return (
    <LegalLayout title="How LocusMSK compares" updated={readableDate(captured)}>
      <p
        className="mt-6 rounded-[4px] px-4 py-3"
        role="note"
        style={{ ...legalProse, fontSize: 13.5, background: 'var(--sf)', border: '1px dashed var(--line)' }}
      >
        Draft. This page is not linked from anywhere and is not final.
      </p>

      <Section title="What this page is">
        <p>
          A list of prices, each with the date it was read. It covers what each product's own pricing
          page showed on that date and nothing more. It does not say which product is better: that
          depends on what you need, and a price list cannot tell you.
        </p>
        <p>
          Prices change. Check each product's own page before you buy. This list is due to be read
          again by {readableDate(RECHECK_BY)}.
        </p>
      </Section>

      <Section title="LocusMSK">
        <p>
          A revision tool for musculoskeletal anatomy of the limbs and spine: {total} structures
          across {AREAS.length} regions ({families.join(', ')}), drilled with locate, identify and
          OINA (origin, insertion, nerve, action) questions.
        </p>
        <Lines
          caption="LocusMSK prices"
          lines={[
            { label: 'Free tier', text: 'One region of your choice, with no card and no time limit' },
            ...(monthly ? [{ label: monthly.label, text: `${monthly.price} ${monthly.per}` }] : []),
            ...(annual ? [{ label: annual.label, text: `${annual.price} ${annual.per}` }] : []),
          ]}
        />
        <p style={{ fontSize: 13 }}>
          Our own prices, from the <Link to="/pricing" style={{ color: 'var(--accd)' }}>pricing page</Link>.
          Prices include VAT.
        </p>
        <p>
          What LocusMSK does not have: free-rotating 3D models, video or audio lectures, articles,
          dissection images, or any anatomy outside the musculoskeletal system of the limbs and
          spine. Several of the products below list those. If you need them, LocusMSK is not a
          replacement for a product that has them.
        </p>
      </Section>

      <Section title="Other products">
        <p>
          Read from each product's public pricing page, in the order we captured them. Plan names
          are theirs.
        </p>
      </Section>
      {COMPARISON_ROWS.map((row) => (
        <CompetitorBlock key={row.id} row={row} />
      ))}

      <Section title="What is missing">
        <p>
          Quizlet is not listed: its pricing page could not be read on the day. Prices for
          universities and other institutions are not listed for any product, because none of the
          pages showed one.
        </p>
      </Section>

      <Section title="How this was put together">
        <p>
          Each line above was read from a dated screenshot of the page named beside it, which we
          keep on file. Where a page showed US dollars to a UK visitor, the dollar figure is given
          as shown. If a line is wrong or out of date, write to{' '}
          <a href="mailto:michael@rehabme.uk" style={{ color: 'var(--accd)' }}>michael@rehabme.uk</a> and
          it will be corrected.
        </p>
        <p>
          Product names belong to their owners. LocusMSK is not affiliated with any of them.
        </p>
      </Section>
    </LegalLayout>
  );
}

export default ComparisonPage;
