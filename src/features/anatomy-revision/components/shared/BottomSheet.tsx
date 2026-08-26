import type { ReactNode } from 'react';

interface BottomSheetProps {
  correct: boolean;
  title: string;
  body: ReactNode;
  onFullCard?: () => void;
  children?: ReactNode;
}

/**
 * The mobile answer-feedback sheet (screen 08) — a rounded-top panel
 * anchored to the bottom of the question's flex column, tinted by
 * correctness, question still visible above it. Not a `position:fixed`
 * overlay in the mockup (it's a normal flex child, `flex:none` at the
 * bottom of the session column) — deliberately kept that simple here too.
 */
export function BottomSheet({ correct, title, body, onFullCard, children }: BottomSheetProps) {
  const color = correct ? 'var(--accd)' : 'var(--acc2d)';
  return (
    <div
      className="flex-none rounded-t-2xl px-6.5 pt-5 pb-6"
      style={{ background: correct ? 'var(--accs)' : 'var(--acc2s)' }}
    >
      <div className="flex items-baseline gap-2.5">
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 24, color }}>{title}</span>
        <span className="flex-1" />
        {onFullCard && (
          <button type="button" onClick={onFullCard} className="border-0 bg-transparent p-0 underline" style={{ fontSize: 13.5, color }}>
            Full card
          </button>
        )}
      </div>
      <div className="mt-2.5 text-[15px] leading-relaxed" style={{ color: 'var(--ink)' }}>
        {body}
      </div>
      {children}
    </div>
  );
}
