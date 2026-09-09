import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * Shared chrome for /privacy, /terms and /attributions.
 *
 * One measure, one type scale, one back link — these pages are read by people
 * deciding whether to trust the product (a student, a course leader, a
 * university's data protection officer), and three pages that look like three
 * different products undermine that before a word is read.
 */

export const legalHeading = {
  fontFamily: 'var(--font-display)',
  fontSize: 21,
  letterSpacing: '-0.01em',
} as const;

export const legalProse = {
  color: 'var(--ink2)',
  font: '400 14.5px/1.65 var(--font-ui)',
} as const;

export const legalLabel = {
  font: '500 10px/1 var(--font-mono)',
  letterSpacing: '.12em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink3)',
};

export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  /** Rendered under the title. A policy with no date is not much of a policy. */
  updated?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[760px] px-5 py-10" style={{ color: 'var(--ink)' }}>
      <Link to="/" style={{ font: '400 12.5px/1 var(--font-ui)', color: 'var(--ink3)', textDecoration: 'none' }}>
        ← Back to the app
      </Link>

      <h1 className="mt-6" style={{ fontFamily: 'var(--font-display)', fontSize: 32, letterSpacing: '-0.02em' }}>
        {title}
      </h1>
      {updated && (
        <p className="mt-2" style={legalLabel}>
          Last updated {updated}
        </p>
      )}

      {children}

      <nav className="mt-12 flex gap-4 border-t pt-5" style={{ borderColor: 'var(--line)' }}>
        {[
          { to: '/privacy', label: 'Privacy' },
          { to: '/terms', label: 'Terms' },
          { to: '/attributions', label: 'Attributions' },
        ].map((item) => (
          <Link key={item.to} to={item.to} style={{ font: '400 13px/1 var(--font-ui)', color: 'var(--accd)' }}>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
