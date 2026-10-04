import { useEffect, useRef } from 'react';

/**
 * "Session complete", as the results page's heading — and where focus lands.
 *
 * Finishing a session removes the Next button that was pressed and replaces
 * the whole screen. Focus fell to the page body: a keyboard user started again
 * from the top of the navigation, and a screen reader said nothing at all
 * about the score having arrived (WCAG 2.4.3; found by the keyboard pass of
 * 4 October 2026). The eyebrow was also a plain div on a page with no heading.
 *
 * `label` is read on focus: the score, which sits below in type too large to
 * be part of a heading.
 */
export function ResultsHeading({ children, label }: { children: string; label: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <h1
      ref={ref}
      tabIndex={-1}
      aria-label={label}
      style={{ margin: 0, outline: 'none', font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
    >
      {children}
    </h1>
  );
}
