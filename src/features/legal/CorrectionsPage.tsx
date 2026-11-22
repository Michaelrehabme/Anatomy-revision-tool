import { Link } from 'react-router-dom';
import { LegalLayout, legalHeading, legalLabel, legalProse } from './LegalLayout';
import { CORRECTIONS, type Correction } from './data/corrections';

/**
 * /corrections — the public change log the terms point to from "If you find
 * an error". It lists every content correction that has gone live, newest
 * first, so anyone can see that reports lead to fixes. The entries live in
 * data/corrections.ts; see the rule at the top of that file.
 */

const EMAIL = 'michael@rehabme.uk';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "12 November 2026" from an ISO date, read from the string so no time zone can shift it. */
export function formatCorrectionDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function groupByDate(list: readonly Correction[]): [string, Correction[]][] {
  const groups = new Map<string, Correction[]>();
  for (const c of [...list].sort((a, b) => b.date.localeCompare(a.date))) {
    groups.set(c.date, [...(groups.get(c.date) ?? []), c]);
  }
  return [...groups.entries()];
}

export function CorrectionsPage() {
  const groups = groupByDate(CORRECTIONS);
  const latest = groups[0]?.[0];
  return (
    <LegalLayout title="Content corrections" updated={latest ? formatCorrectionDate(latest) : undefined}>
      <p className="mt-4" style={legalProse}>
        Every correction to LocusMSK&rsquo;s anatomy content is listed here, newest first, with what changed and, where recorded, the
        source it was checked against. Each fix reaches everyone the moment it goes live.
      </p>
      <p className="mt-3" style={legalProse}>
        Found something wrong? Use <strong style={{ color: 'var(--ink)' }}>Report a problem</strong> during a session,
        or email{' '}
        <a href={`mailto:${EMAIL}?subject=LocusMSK%20content%20correction`} style={{ color: 'var(--accd)' }}>
          {EMAIL}
        </a>
        . How reports are handled is set out in the{' '}
        <Link to="/terms" style={{ color: 'var(--accd)' }}>terms of use</Link>.
      </p>

      {groups.map(([date, items]) => (
        <section key={date} className="mt-9" aria-labelledby={`c-${date}`}>
          <h2 id={`c-${date}`} style={legalHeading}>{formatCorrectionDate(date)}</h2>
          <ul className="mt-3 flex flex-col gap-4" style={{ listStyle: 'none', padding: 0 }}>
            {items.map((c) => (
              <li key={`${c.date}-${c.structure}`} className="border-t pt-3" style={{ borderColor: 'var(--line)' }}>
                <p style={{ ...legalProse, color: 'var(--ink)', fontWeight: 600 }}>{c.structure}</p>
                <p style={legalProse}>{c.change}</p>
                <p className="mt-1" style={legalLabel}>
                  {c.kind} · {c.found}{c.source ? ` · Checked against ${c.source}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </LegalLayout>
  );
}

export default CorrectionsPage;
