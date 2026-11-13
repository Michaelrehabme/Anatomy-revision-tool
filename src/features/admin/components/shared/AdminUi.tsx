import type { CSSProperties, ReactNode } from 'react';
import { ADMIN_TITLE_STYLE } from './AdminMobile';

/**
 * The pieces the admin pages are built from, so every page reads the same:
 * a header with its one-line summary and any page-wide controls, cards for
 * the numbers, and panels for everything else.
 */

export const EYEBROW: CSSProperties = {
  font: '500 10px/1.2 var(--font-mono)',
  letterSpacing: '.14em',
  textTransform: 'uppercase',
  color: 'var(--ink3)',
};

export function PageHeader({ title, summary, actions }: { title: string; summary?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 style={ADMIN_TITLE_STYLE}>{title}</h1>
        {summary && (
          <p className="mt-2" style={{ font: '400 14px/1.45 var(--font-ui)', color: 'var(--ink2)', margin: '8px 0 0' }}>
            {summary}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-none flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ title, aside, children, className = '' }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[6px] p-4 lg:p-5 ${className}`} style={{ background: 'var(--sf)', border: '1px solid var(--line)' }}>
      {(title || aside) && (
        <div className="mb-3.5 flex items-baseline justify-between gap-3">
          {title && <h2 style={{ ...EYEBROW, margin: 0 }}>{title}</h2>}
          {aside && <span style={{ font: '400 12px/1.3 var(--font-ui)', color: 'var(--ink3)' }}>{aside}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({ label, value, note, tone, compact, className = '' }: { label: string; value: ReactNode; note?: ReactNode; tone?: 'accent'; compact?: boolean; className?: string }) {
  return (
    <div className={`flex min-w-0 flex-col rounded-[6px] px-4 py-3.5 ${className}`} style={{ background: 'var(--sf)', border: '1px solid var(--line)' }}>
      <span style={EYEBROW}>{label}</span>
      <span
        className="mt-2"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: compact ? 'clamp(20px, 5.5vw, 24px)' : 'clamp(26px, 7vw, 32px)',
          lineHeight: 1,
          letterSpacing: '-.02em',
          color: tone === 'accent' ? 'var(--accd)' : 'var(--ink)',
        }}
      >
        {value}
      </span>
      {note && (
        <span className="mt-1.5" style={{ font: '400 12px/1.35 var(--font-ui)', color: 'var(--ink3)' }}>
          {note}
        </span>
      )}
    </div>
  );
}

/** A labelled on/off switch. */
export function Switch({ checked, onChange, label, hideLabel, disabled }: { checked: boolean; onChange: (next: boolean) => void; label: string; hideLabel?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={hideLabel ? label : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex min-h-[36px] items-center gap-2.5 rounded-full border-0 bg-transparent px-1"
      style={{ cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1 }}
    >
      <span
        aria-hidden="true"
        className="relative inline-block h-5 w-9 flex-none rounded-full transition-colors"
        style={{ background: checked ? 'var(--acc)' : 'var(--line)' }}
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full transition-all"
          style={{ left: checked ? 18 : 2, background: 'var(--pg)', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }}
        />
      </span>
      {!hideLabel && <span style={{ font: '500 13px/1.2 var(--font-ui)', color: 'var(--ink2)' }}>{label}</span>}
    </button>
  );
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="min-h-[34px] rounded-full px-3.5"
      style={{
        font: '500 12.5px/1 var(--font-ui)',
        border: `1.2px solid ${active ? 'var(--acc)' : 'var(--line)'}`,
        background: active ? 'var(--acc)' : 'transparent',
        color: active ? 'var(--onacc)' : 'var(--ink2)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

/** A small label next to a name: Test, Admin, Guest. */
export function Tag({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'accent' | 'warn' }) {
  const colors = {
    muted: { color: 'var(--ink3)', border: 'var(--line)', background: 'transparent' },
    accent: { color: 'var(--accd)', border: 'var(--acc)', background: 'var(--accs)' },
    warn: { color: 'var(--acc2d)', border: 'var(--acc2)', background: 'var(--acc2s)' },
  }[tone];
  return (
    <span
      className="inline-flex flex-none items-center rounded-[3px] px-1.5 py-0.5"
      style={{ font: '500 10px/1.2 var(--font-mono)', letterSpacing: '.08em', textTransform: 'uppercase', border: `1px solid ${colors.border}`, color: colors.color, background: colors.background }}
    >
      {children}
    </span>
  );
}

/** One row of a share-of-total list: label, bar, count and percentage. */
export function ShareBar({ label, count, total, color = 'var(--acc)' }: { label: string; count: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className="min-w-0 flex-1 truncate" style={{ font: '400 13.5px/1.3 var(--font-ui)', color: 'var(--ink)' }}>
          {label}
        </span>
        <span style={{ font: '500 13px/1 var(--font-mono)', color: 'var(--ink)' }}>{count}</span>
        <span style={{ font: '400 12px/1 var(--font-mono)', color: 'var(--ink3)', minWidth: 36, textAlign: 'right' }}>{pct}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--line)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
