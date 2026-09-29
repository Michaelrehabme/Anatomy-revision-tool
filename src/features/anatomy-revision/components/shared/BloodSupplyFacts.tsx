import type { AnatomyStructure, BloodSupplyRating } from '../../types/structure';

const RATING_LABEL: Record<BloodSupplyRating, string> = { rich: 'Rich supply', moderate: 'Moderate supply', poor: 'Poor supply' };

const RATING_STYLE: Record<BloodSupplyRating, { background: string; color: string; border?: string }> = {
  rich: { background: 'var(--acc-fill)', color: 'var(--onacc)' },
  moderate: { background: 'var(--accs)', color: 'var(--accd)', border: '1px solid var(--acc)' },
  poor: { background: 'var(--acc2s)', color: 'var(--acc2d)', border: '1px solid var(--acc2)' },
};

/**
 * The reviewed blood supply on a structure's card: the primary artery, the
 * others that assist, how rich the supply is, and the poorly supplied part
 * where one is documented. Renders nothing for a structure without one —
 * landmarks, and anything not yet reviewed.
 */
export function BloodSupplyFacts({ structure, compact = false }: { structure: AnatomyStructure; compact?: boolean }) {
  const b = structure.bloodSupply;
  if (!b) return null;
  return (
    <div className={compact ? 'py-3.5' : 'py-4.5'}>
      <div className="flex flex-wrap items-center gap-2.5">
        <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
          Blood supply
        </div>
        <span
          style={{
            font: '600 10.5px/1 var(--font-mono)',
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            padding: '4px 7px 3px',
            borderRadius: 2,
            ...RATING_STYLE[b.rating],
          }}
        >
          {RATING_LABEL[b.rating]}
        </span>
      </div>
      <p className={compact ? 'mt-1.5 text-[15px] leading-relaxed' : 'mt-2 max-w-[48ch] text-lg leading-snug'} style={{ color: 'var(--ink)' }}>
        {b.primary ? (
          <>
            <span style={{ color: 'var(--ink3)' }}>Primary · </span>
            {b.primary}
          </>
        ) : (
          <span style={{ color: 'var(--ink3)' }}>No single named artery in the sources.</span>
        )}
      </p>
      {b.assisting.length > 0 && (
        <p className="mt-1 max-w-[48ch] text-[15px] leading-relaxed" style={{ color: 'var(--ink2)' }}>
          <span style={{ color: 'var(--ink3)' }}>Also · </span>
          {b.assisting.join(', ')}
        </p>
      )}
      {b.zone && (
        <p className="mt-1.5 max-w-[48ch] text-[14px] leading-relaxed" style={{ color: 'var(--ink2)' }}>
          <span style={{ color: 'var(--acc2d)' }}>Poorly supplied · </span>
          {b.zone}
        </p>
      )}
    </div>
  );
}
