import type { ReactNode } from 'react';

interface SessionSidebarProps {
  current: number;
  total: number;
  correctCount: number;
  wrongCount: number;
  /**
   * Flashcards revealed so far, and how many the session holds. Their own
   * number because they are deliberately outside `current`/`total`: a card is
   * taught, not asked, so counting it would put "16/24" on a 16-question
   * session. But clicking past one and watching the counter stand still reads
   * as a bug rather than as a distinction, so the cards are counted where they
   * can be seen. Omit for a session with no cards in it.
   */
  cardsSeen?: number;
  cardsTotal?: number;
  onEnd: () => void;
  hint?: ReactNode;
}

/** The in-session sidebar (screens 05–08): replaces nav while a question is active. */
export function SessionSidebar({ current, total, correctCount, wrongCount, cardsSeen = 0, cardsTotal = 0, onEnd, hint }: SessionSidebarProps) {
  const pct = total > 0 ? (current / total) * 100 : 0;
  return (
    <>
      <button type="button" onClick={onEnd} className="text-left text-[15px]" style={{ color: 'var(--ink3)' }}>
        &times; End session
      </button>

      <div
        className="mt-11"
        style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
      >
        Progress
      </div>
      <div className="mt-3.5 flex items-baseline gap-2">
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 46, lineHeight: 1, letterSpacing: '-.03em' }}>
          {current}
        </span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink3)' }}>/ {total}</span>
      </div>
      <div className="mt-4 h-1 overflow-hidden rounded-full" style={{ background: 'var(--line)' }}>
        <div className="h-full transition-all duration-300" style={{ width: `${pct}%`, background: 'var(--acc)' }} />
      </div>
      <div className="mt-2" style={{ font: '400 11.5px/1.5 var(--font-mono)', color: 'var(--ink3)' }}>
        questions answered
      </div>

      {cardsTotal > 0 && (
        <>
          <div
            className="mt-8"
            style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
          >
            Learn cards
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 28, lineHeight: 1, letterSpacing: '-.03em' }}>
              {cardsSeen}
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--ink3)' }}>/ {cardsTotal}</span>
          </div>
          <div className="mt-1.5" style={{ font: '400 11.5px/1.5 var(--font-mono)', color: 'var(--ink3)' }}>
            seen · not scored
          </div>
        </>
      )}

      {(correctCount > 0 || wrongCount > 0) && (
        <>
          <div
            className="mt-10"
            style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
          >
            So far
          </div>
          <div className="mt-3" style={{ font: '400 13px/1.9 var(--font-mono)', color: 'var(--ink2)' }}>
            {correctCount} correct
            <br />
            {wrongCount} wrong
          </div>
        </>
      )}

      <div className="flex-1" />
      {hint && <div style={{ font: '400 11.5px/1.6 var(--font-mono)', color: 'var(--ink3)' }}>{hint}</div>}
    </>
  );
}
