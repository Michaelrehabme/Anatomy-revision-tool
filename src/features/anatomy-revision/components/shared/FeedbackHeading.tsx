import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

/**
 * The "Correct" / "Not quite" line of an answer's feedback, which takes focus
 * the moment it appears (WCAG 2.4.3 and 4.1.3).
 *
 * Checking an answer removes the button that was pressed, and focus fell back
 * to the page body: a screen reader user heard nothing, and the result was
 * only announced once they had rated their confidence — by which point the
 * next question was loading. Focusing the verdict reads it out at once, and
 * leaves the reader in the right place to carry on into the explanation and
 * the rating buttons below it.
 *
 * `label` is what is read on focus when it should say more than the visible
 * word — the right answer, usually, which the panel shows beneath it.
 */
export function FeedbackHeading({
  children,
  label,
  style,
  className,
}: {
  children: ReactNode;
  label?: string;
  style?: CSSProperties;
  className?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <h2 ref={ref} data-feedback tabIndex={-1} aria-label={label} className={className} style={{ margin: 0, outline: 'none', ...style }}>
      {children}
    </h2>
  );
}
