import { Link } from 'react-router-dom';
import { AREA_LABELS, type Area } from '../../types/region';
import { areasOf, type AnatomyStructure } from '../../types/structure';
import type { UseEntitlement } from '../../hooks/useEntitlement';
import { freeAreaSwitchDate } from '../../lib/entitlement';

/** "from 3 November 2026 (30 days)": the date first, because it does not go stale. */
function switchWait(access: UseEntitlement): string {
  const days = `${access.daysUntilSwitch} ${access.daysUntilSwitch === 1 ? 'day' : 'days'}`;
  const on = freeAreaSwitchDate(access.freeArea);
  return on ? `from ${on} (${days})` : `in ${days}`;
}

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
      {access.freeArea && access.canSwitchFree && <> — or make your one change of free area, from your account.</>}
      {/* An account from before a confirmed address was asked for keeps its
          area and confirms only to change it (lib/emailVerification.ts). The
          wait is not what is in its way, so the wait is not what is said. */}
      {access.freeArea && !access.canSwitchFree && !access.switchUsed && access.switchNeedsConfirmation && (
        <> — or confirm your email address, from your account, to change your free area.</>
      )}
      {access.freeArea && !access.canSwitchFree && !access.switchUsed && !access.switchNeedsConfirmation && (
        <> — or change your free area {switchWait(access)}.</>
      )}
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
        every region{access.switchUsed ? '.' : ', or you can use your one change and move your free area here.'}
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
        {onSwitchFree && !access.switchUsed && (
          <button
            type="button"
            disabled={!access.canSwitchFree}
            onClick={() => onSwitchFree(area)}
            className="disabled:opacity-50"
            style={{ font: '400 13.5px/1.4 var(--font-ui)', color: 'var(--accd)', textDecoration: 'underline' }}
          >
            {access.canSwitchFree
              ? `Use my one change: make ${AREA_LABELS[area]} free instead`
              : access.switchUsed
                ? 'Your free area is fixed now'
                : access.switchNeedsConfirmation
                  ? 'Confirm your email address, from your account, to change your free area'
                  : `Changeable ${switchWait(access)}`}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * What a locked structure's own page shows in place of its content
 * (docs/PAYWALL-TRACE-2026-09-29.md, item 14).
 *
 * The Atlas does not list a locked structure, but its page has an address,
 * and an address can be typed, bookmarked, or followed from an old
 * achievement. The page used to show everything — picture, origin, insertion,
 * nerve, action, blood supply, clinical note — and gate only the drill button
 * at the foot of it, below the fold. That is the content with a locked door
 * painted on the end.
 *
 * So the page for a locked structure is its name, its region and this: one
 * sentence saying what is being held back and why, then the same panel every
 * other locked screen uses. The name stays because it is not what is sold:
 * every structure's name is in the bundled index and in the wrong answers of
 * anyone's questions.
 *
 * WHILE THE ENTITLEMENT IS STILL BEING READ the answer is "free" (see
 * useEntitlement), and telling a subscriber who opened a bookmark that their
 * free area is set elsewhere would be wrong for the second it takes. Nothing
 * is shown until the read settles: not the panel, and not the content either.
 */
export function LockedStructureNotice({
  structure,
  access,
}: {
  structure: Pick<AnatomyStructure, 'name' | 'areas' | 'subregion'>;
  access: UseEntitlement;
}) {
  if (access.loading) {
    return (
      <p role="status" style={{ font: '400 14px/1.6 var(--font-ui)', color: 'var(--ink3)' }}>
        Checking what your account can open…
      </p>
    );
  }
  const area = areasOf(structure)[0];
  return (
    <div>
      <p style={{ font: '400 15px/1.6 var(--font-ui)', color: 'var(--ink2)' }}>
        {structure.name} is part of {AREA_LABELS[area]}, which is locked on this account. Its picture, facts and
        practice open with that area.
      </p>
      <div className="mt-4">
        <LockedAreaPanel area={area} access={access} onSwitchFree={access.chooseFreeArea} />
      </div>
    </div>
  );
}
