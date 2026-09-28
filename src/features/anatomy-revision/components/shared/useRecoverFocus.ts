import { useEffect, type RefObject } from 'react';

/**
 * Puts focus back on `ref` whenever `key` changes and focus has been lost to
 * the page body — a new question replacing the old one, or the confidence
 * buttons disappearing once pressed (WCAG 2.4.3).
 *
 * Only when LOST: a typed-answer question focuses its own text box as it
 * mounts, and a parent's effect runs after its children's, so an
 * unconditional focus here would snatch the caret out of the box the student
 * is about to type in. The check waits a frame for that autofocus to land.
 */
export function useRecoverFocus(ref: RefObject<HTMLElement | null>, key: unknown): void {
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const active = document.activeElement;
      if (!active || active === document.body) ref.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [ref, key]);
}
