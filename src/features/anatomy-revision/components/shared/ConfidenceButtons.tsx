import { useEffect, useState } from 'react';
import type { Confidence } from '../../types/attempt';
import { recordHintShown, shouldShowHint } from '../../lib/firstTimeHints';

const OPTIONS: { value: Confidence; label: string; hint: string }[] = [
  { value: 'hard', label: 'Hard', hint: '1 day' },
  { value: 'medium', label: 'Medium', hint: '4 days' },
  { value: 'easy', label: 'Easy', hint: '10 days' },
];

interface ConfidenceButtonsProps {
  onRate: (confidence: Confidence) => void;
  /** Desktop mockup says "How confident?", mobile says "How did that feel?" — shared component, per-breakpoint copy. */
  label?: string;
}

/**
 * The three confidence buttons on the answer-feedback band (mockup screen
 * 08) / bottom sheet (mobile screen 08), shared across every question type
 * and both breakpoints — this is what actually drives
 * updateMasteryAfterAttempt/dueAt (see useRevisionSession.submitAnswer), so
 * every format needs it, not just flashcards. Hints show representative
 * next-review intervals (the desktop mockup's 1/4/10-day example — the
 * mobile mockup's own numbers differ slightly, tomorrow/4/11 days;
 * standardized on one set app-wide rather than forking copy per breakpoint,
 * consistent with the "Medium" vs "Fine" label decision) rather than a live
 * per-structure computeNextReview preview, to avoid an extra fetch per
 * question just for a label.
 *
 * The first few times, a one-line explanation sits above the buttons. This
 * is the one mechanic the whole scheduler depends on, and onboarding copy
 * read before the first question does not stick — the moment to explain it
 * is the moment it is asked.
 */
export function ConfidenceButtons({ onRate, label = 'How confident?' }: ConfidenceButtonsProps) {
  const [showHint] = useState(() => shouldShowHint('confidence'));
  useEffect(() => {
    if (showHint) recordHintShown('confidence');
  }, [showHint]);

  return (
    <div>
      <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
        {label}
      </div>
      {showHint && (
        <p className="mt-2.5 text-sm leading-snug" style={{ color: 'var(--ink2)' }}>
          This sets when you see it again. Be honest: a lucky guess marked Easy comes back in ten days.
        </p>
      )}
      <div className="mt-3.5 flex gap-2.5">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onRate(opt.value)}
            className="flex min-h-[72px] flex-1 flex-col items-center justify-center gap-1 rounded-[3px]"
            style={{ border: '1.4px solid var(--line)', background: 'var(--sf)' }}
          >
            <span style={{ fontSize: 16.5, color: 'var(--ink)' }}>{opt.label}</span>
            <span style={{ font: '400 11px/1 var(--font-mono)', color: 'var(--ink3)' }}>{opt.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
