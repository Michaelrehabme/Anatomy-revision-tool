import { Link } from 'react-router-dom';
import { AREA_LABELS, type Area } from '../../types/region';
import type { UseEntitlement } from '../../hooks/useEntitlement';

/**
 * The paywall's face: the small pieces every picker, list and drill uses to
 * say "this one is not yours yet".
 *
 * ONE PLACE, because a paywall that phrases itself differently on each screen
 * reads as a bug rather than a boundary, and because the wording is a promise
 * about money — it should be changed in one edit, not seven.
 *
 * The tone is deliberately flat. A locked area is not a failure or a trick;
 * the student chose one free area and this is another one. Nothing here nags,
 * animates or interrupts: it states the fact and offers the way out.
 */

/** The small "Locked" pill that sits on a chip or row. */
export function LockPill({ compact = false }: { compact?: boolean }) {
  return (
    <span
      style={{
        font: `500 ${compact ? 9.5 : 10}px/1 var(--font-mono)`,
        letterSpacing: '.1em',
        textTransform: 'uppercase',
        color: 'var(--ink3)',
        border: '1px solid var(--line)',
        borderRadius: 2,
        padding: compact ? '3px 5px' : '4px 6px',
        whiteSpace: 'nowrap',
      }}
    >
      Locked
    </span>
  );
}

/**
 * The line under a set of locked areas: what is free, and what unlocks the
 * rest. Says which area is free by name, because "your free area" leaves the
 * student wondering which one they picked.
 */
export function UnlockNote({ access, className = '' }: { access: UseEntitlement; className?: string }) {
  if (access.tier !== 'free') return null;
  const free = access.freeArea?.area;

  return (
    <p className={className} style={{ font: '400 13px/1.55 var(--font-ui)', color: 'var(--ink3)' }}>
      {free ? `${AREA_LABELS[free]} is your free area.` : 'One area is free.'}{' '}
      <Link to="/pricing" style={{ color: 'var(--accd)' }}>
        Unlock every region
      </Link>
      {access.freeArea && !access.canSwitchFree && (
        <> — or swap your free area in {access.daysUntilSwitch} {access.daysUntilSwitch === 1 ? 'day' : 'days'}.</>
      )}
      {access.freeArea && access.canSwitchFree && <> — or swap your free area from your account.</>}
    </p>
  );
}

/**
 * What a locked area offers instead of its content: the name, why it is shut,
 * and the two ways out. Used where a whole screen's worth of content is behind
 * the paywall, rather than one row of a list.
 */
export function LockedAreaPanel({
  area,
  access,
  onSwitchFree,
}: {
  area: Area;
  access: UseEntitlement;
  onSwitchFree?: (area: Area) => void;
}) {
  return (
    <div className="rounded-[4px] px-5 py-5" style={{ background: 'var(--sf)', border: '1px solid var(--line)' }}>
      <div className="flex items-center gap-2.5">
        <LockPill />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>{AREA_LABELS[area]}</span>
      </div>
      <p className="mt-2.5" style={{ font: '400 14px/1.6 var(--font-ui)', color: 'var(--ink2)' }}>
        Your free area is {access.freeArea ? AREA_LABELS[access.freeArea.area] : 'set elsewhere'}. A subscription opens
        every region, or you can move your free area here.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Link
          to="/pricing"
          style={{
            font: '500 14px/1 var(--font-ui)',
            padding: '12px 18px',
            background: 'var(--acc-fill)',
            color: 'var(--onacc)',
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          See the plans
        </Link>
        {onSwitchFree && (
          <button
            type="button"
            disabled={!access.canSwitchFree}
            onClick={() => onSwitchFree(area)}
            className="disabled:opacity-50"
            style={{ font: '400 13.5px/1.4 var(--font-ui)', color: 'var(--accd)', textDecoration: 'underline' }}
          >
            {access.canSwitchFree
              ? `Make ${AREA_LABELS[area]} my free area instead`
              : `Free area can change in ${access.daysUntilSwitch} ${access.daysUntilSwitch === 1 ? 'day' : 'days'}`}
          </button>
        )}
      </div>
    </div>
  );
}
