import { Link } from 'react-router-dom';

/**
 * The fine print, reachable from inside the app. Until this existed the legal
 * pages were linked only from the marketing footer and from each other, so a
 * student who had signed up never saw them again — and /sources in particular
 * is only useful if someone doubting an answer can find it mid-revision.
 *
 * Rendered outside the signed-in block on both account screens: an anonymous
 * user is owed the privacy notice and the terms as much as anyone.
 */
const LINKS = [
  { to: '/sources', label: 'Sources', detail: 'Where the anatomy came from, and what has been checked' },
  { to: '/privacy', label: 'Privacy', detail: 'What is stored about you, and why' },
  { to: '/attributions', label: 'Attributions', detail: 'Image and software credits' },
  { to: '/terms', label: 'Terms', detail: 'Terms of use' },
] as const;

export function LegalLinks({ compact = false }: { compact?: boolean }) {
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {LINKS.map((link) => (
        <li key={link.to} className="border-b" style={{ borderColor: 'var(--line)' }}>
          <Link
            to={link.to}
            className={`flex flex-col gap-1 ${compact ? 'min-h-[52px] py-3' : 'py-2.5'}`}
            style={{ textDecoration: 'none' }}
          >
            <span style={{ font: `500 ${compact ? 14.5 : 14}px/1.2 var(--font-ui)`, color: 'var(--accd)' }}>{link.label}</span>
            <span style={{ font: `400 ${compact ? 12.5 : 12}px/1.35 var(--font-ui)`, color: 'var(--ink3)' }}>{link.detail}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
