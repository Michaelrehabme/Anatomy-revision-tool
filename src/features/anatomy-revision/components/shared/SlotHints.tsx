import { isBloodFactKind, type OinaPromptKind } from '../../types/question';

/**
 * The hinted stage of typed fact recall (29 Sep 2026): the same two hints the
 * naming ladder gives — how long the answer is, and its first letter — for
 * one box. Counted from the plainest accepted form, not the authored one:
 * "Thoracoacromial artery (deltoid and acromial branches)" is typed as
 * "thoracoacromial artery", and a count that included the bracket would send
 * the student looking for a longer answer than they need.
 */
export function slotHints(accepted: readonly string[]): string[] {
  const target = accepted.find((a) => !/[()]/.test(a)) ?? accepted[0] ?? '';
  const words = target.split(/\s+/).filter(Boolean);
  const letters = words.join('').replace(/[^A-Za-z]/g, '').length;
  const shape = words.length > 1 ? `${words.length} words · ${letters} letters` : `${letters} letters`;
  return [shape, `starts with ${target.trim().charAt(0).toUpperCase()}`];
}

/** The small label above a typed fact question. */
export function factEyebrow(kind: OinaPromptKind): string {
  return isBloodFactKind(kind) ? 'Blood supply' : 'OINA';
}

export function SlotHints({ accepted }: { accepted: readonly string[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2" aria-label="Hints">
      {slotHints(accepted).map((hint) => (
        <span
          key={hint}
          className="inline-flex min-h-[32px] items-center whitespace-nowrap rounded-full px-3"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 12, border: '1.2px solid var(--line)', color: 'var(--ink3)' }}
        >
          {hint}
        </span>
      ))}
    </div>
  );
}
