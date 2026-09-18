import { Link } from 'react-router-dom';

/**
 * The checkout consent that turns "no refunds after you start" from an
 * unenforceable term into a lawful one. CR-033 item 12.
 *
 * WHAT THE LAW ACTUALLY REQUIRES. Under the Consumer Contracts Regulations
 * 2013 a consumer buying digital content online has fourteen days to cancel
 * for a full refund. That right is lost only where BOTH of these happen before
 * supply begins: the consumer gives express consent to immediate supply, and
 * acknowledges that they lose the right by doing so. A pre-ticked box is not
 * consent, a term buried in the terms of use is not acknowledgement, and
 * "by continuing you agree" is neither.
 *
 * So this is an unticked checkbox with both halves written into its label, and
 * the caller must not let checkout proceed until it is ticked. The alternative
 * offered beside it — start after fourteen days and keep the right — is not
 * decoration: an option the customer would never take is evidence the consent
 * was not freely given.
 *
 * `onChange` reports the acknowledgement. Record WHAT was agreed and WHEN
 * alongside the subscription: if a refund is ever disputed, the thing in
 * question is whether this consent was taken, and "the page had a checkbox"
 * is not an answer.
 */

interface CoolingOffWaiverProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Shown when the customer tries to continue without deciding. */
  showError?: boolean;
  id?: string;
}

export function CoolingOffWaiver({ checked, onChange, showError, id = 'cooling-off-waiver' }: CoolingOffWaiverProps) {
  return (
    <div
      className="rounded-[3px] px-4 py-3.5"
      style={{
        background: 'var(--sf)',
        border: `1px solid ${showError && !checked ? 'var(--acc2)' : 'var(--line)'}`,
      }}
    >
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-[18px] w-[18px] flex-none"
          style={{ accentColor: 'var(--acc)' }}
          aria-describedby={`${id}-alt`}
        />
        <span style={{ font: '400 14.5px/1.5 var(--font-ui)', color: 'var(--ink2)' }}>
          I want my subscription to start <strong style={{ color: 'var(--ink)' }}>immediately</strong>,
          and I understand that this means I{' '}
          <strong style={{ color: 'var(--ink)' }}>lose my right to cancel within 14 days</strong> for
          a refund.
        </span>
      </label>

      <p id={`${id}-alt`} className="mt-2.5 pl-[30px]" style={{ font: '400 13px/1.5 var(--font-ui)', color: 'var(--ink3)' }}>
        Prefer to keep that right? Leave this unticked and your access will begin in 14 days instead.
        You can cancel for a full refund at any point before it does. Either way you can cancel
        whenever you like — see{' '}
        <Link to="/refunds" style={{ color: 'var(--accd)' }}>
          cancellation and refunds
        </Link>
        .
      </p>

      {showError && !checked && (
        <p className="mt-2.5 pl-[30px]" style={{ font: '400 13.5px/1.5 var(--font-ui)', color: 'var(--acc2d)' }}>
          Tick the box to start straight away, or choose the delayed start — we cannot begin a
          subscription without knowing which you want.
        </p>
      )}
    </div>
  );
}
