import { AREA_LABELS, type Area } from '../../types/region';
import { Button } from '../shared/Button';

interface GuestAccountPanelProps {
  /** The free area this guest chose before guests were closed, if any. */
  freeArea: Area | null;
  onCreate: () => void;
  onSignIn: () => void;
  compact?: boolean;
}

/**
 * The account screen's block for a GUEST, in place of Subscription and
 * Classes.
 *
 * A guest has no subscription to describe and may not join or create a class
 * (both need an account now), so the sections that describe those would be
 * three ways of saying "not for you yet". This says the one thing instead:
 * what to do, and that nothing they have done is lost by doing it.
 */
export function GuestAccountPanel({ freeArea, onCreate, onSignIn, compact = false }: GuestAccountPanelProps) {
  return (
    <div>
      <p style={{ font: `400 ${compact ? 14.5 : 14}px/1.55 var(--font-ui)`, color: 'var(--ink2)', maxWidth: 520 }}>
        You are using LocusMSK as a guest. Create a free account to keep going — your progress and your free area
        come with you.{freeArea ? ` Your free area is ${AREA_LABELS[freeArea]}.` : ''}
      </p>
      <p className="mt-2" style={{ font: `400 ${compact ? 13.5 : 13}px/1.55 var(--font-ui)`, color: 'var(--ink3)', maxWidth: 520 }}>
        Revising, joining a class and subscribing all need an account. It is free.
      </p>
      <div className={`mt-4 flex ${compact ? 'flex-col' : 'flex-wrap items-center'} gap-3`}>
        <Button onClick={onCreate} className={`min-h-[46px] ${compact ? 'w-full' : 'min-w-[170px]'}`}>
          Create account
        </Button>
        <Button variant="secondary" onClick={onSignIn} className={`min-h-[46px] ${compact ? 'w-full' : 'min-w-[120px]'}`}>
          Sign in
        </Button>
      </div>
    </div>
  );
}
