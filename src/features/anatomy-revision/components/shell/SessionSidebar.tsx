import type { ReactNode } from 'react';

interface SessionSidebarProps {
  current: number;
  total: number;
  correctCount: number;
  wrongCount: number;
  onEnd: () => void;
  hint?: ReactNode;
}

/** The in-session sidebar (screens 05–08): replaces nav while a question is active. */
export function SessionSidebar({ current, total, correctCount, wrongCount, onEnd, hint }: SessionSidebarProps) {
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
