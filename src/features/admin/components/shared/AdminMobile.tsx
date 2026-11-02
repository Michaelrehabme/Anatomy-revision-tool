import { useState, type CSSProperties, type ReactNode } from 'react';

/**
 * The phone versions of the admin pages' pieces. A table of six columns does
 * not fit a phone, so below the desktop width each table becomes a list of
 * folding rows: the name and one thing worth seeing at a glance, and the rest
 * of the row's columns behind a tap.
 */

/** Page padding: the desktop's 64px gutter would leave a phone 260px of page. */
export const ADMIN_PAGE_PAD = 'px-4 pt-6 pb-10 lg:px-16 lg:pt-16 lg:pb-16';

/** The page heading, scaled down to fit a phone. */
export const ADMIN_TITLE_STYLE: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 500,
  fontSize: 'clamp(30px, 8vw, 40px)',
  lineHeight: 1.05,
  letterSpacing: '-.02em',
  margin: 0,
};

export function FoldList({ children, className = 'mt-4' }: { children: ReactNode; className?: string }) {
  return (
    <ul className={`${className} flex flex-col gap-1.5`} style={{ listStyle: 'none', padding: 0, margin: undefined }}>
      {children}
    </ul>
  );
}

interface FoldRowProps {
  title: ReactNode;
  /** Shown on the right of the folded row, e.g. a status or a percentage. */
  aside?: ReactNode;
  /** What unfolds. */
  children: ReactNode;
}

export function FoldRow({ title, aside, children }: FoldRowProps) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-[4px]" style={{ background: 'var(--sf)', border: '1px solid var(--line)' }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 border-0 bg-transparent px-4 py-3 text-left"
        style={{ cursor: 'pointer' }}
      >
        <span className="min-w-0 flex-1" style={{ font: '500 14.5px/1.3 var(--font-ui)', color: 'var(--ink)' }}>
          {title}
        </span>
        {aside !== undefined && (
          <span className="flex-none" style={{ font: '500 12.5px/1.3 var(--font-ui)', color: 'var(--ink2)' }}>
            {aside}
          </span>
        )}
        <span aria-hidden="true" className="flex-none" style={{ color: 'var(--ink3)', fontSize: 12 }}>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && <div className="px-4 pb-3.5">{children}</div>}
    </li>
  );
}

/** Label/value pairs: a folded-away table row's other columns. */
export function Facts({ items }: { items: [label: string, value: ReactNode][] }) {
  return (
    <dl className="grid gap-x-4 gap-y-2" style={{ gridTemplateColumns: 'max-content 1fr', margin: 0 }}>
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt style={{ font: '500 10px/1.6 var(--font-mono)', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
            {label}
          </dt>
          <dd className="min-w-0" style={{ margin: 0, font: '400 13px/1.35 var(--font-ui)', color: 'var(--ink2)', overflowWrap: 'anywhere' }}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
