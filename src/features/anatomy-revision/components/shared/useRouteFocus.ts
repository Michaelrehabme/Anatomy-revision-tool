import { useEffect, useRef } from 'react';

/** How long to wait for a lazily loaded page to put its heading up before giving up. */
const MAX_FRAMES = 40;

/**
 * Puts focus on the new page's heading when a navigation has left it nowhere
 * (WCAG 2.4.3).
 *
 * Opening a structure from the Atlas, going back, following "Unlock every
 * region" — each replaces the element that was pressed, and focus fell to the
 * page body. A keyboard user was sent back to the top of the navigation to tab
 * through it again; a screen reader announced nothing, so the page appeared
 * not to have changed (keyboard pass, 4 October 2026).
 *
 * Only when focus is LOST. Navigating from the sidebar leaves focus on the
 * sidebar button, which is still there and is where the user is; a question
 * screen and the results page place focus themselves, and their effects run
 * before this one looks. Never on the first load: nobody pressed anything.
 *
 * The heading is given tabindex="-1" here rather than in thirty components,
 * so a page gains this by having an <h1>, which every route already does.
 */
export function useRouteFocus(pathname: string): void {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let frame = 0;
    let id = requestAnimationFrame(function look() {
      const active = document.activeElement;
      if (active && active !== document.body) return;
      const heading = document.querySelector<HTMLElement>('main h1, h1');
      if (heading) {
        if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
        // Scrolled into view: a list left scrolled half-way down would
        // otherwise put focus on a heading that is off the screen.
        heading.focus();
        return;
      }
      if (++frame < MAX_FRAMES) id = requestAnimationFrame(look);
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);
}

/**
 * The same move for a page that changes WITHOUT a navigation: a screen that
 * stands in for another and then gives way (the account screen a guest sees,
 * the panel an educator sees), or a step of onboarding replacing the last.
 * The address does not change, so the hook above never runs.
 *
 * Under the same two conditions. Only when focus has been LOST — the button
 * that was pressed is gone and focus fell to the page body. And never before
 * anybody has pressed anything: on a first load nothing was lost, and a
 * heading that takes focus by itself is drawn with a focus ring nobody asked
 * for.
 */
export function focusHeadingIfLost(heading: HTMLElement | null | undefined): void {
  if (!heading || !pressedSomething) return;
  const active = document.activeElement;
  if (active && active !== document.body) return;
  if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
  heading.focus();
}

/**
 * Whether anybody has pressed anything on this page yet: a pointer or a key.
 * Listened for rather than asked of the browser (`navigator.userActivation`),
 * which answers "yes" for a page that was merely opened by a script and is
 * not there at all in older browsers.
 */
let pressedSomething = false;
if (typeof document !== 'undefined') {
  const pressed = () => { pressedSomething = true; };
  document.addEventListener('pointerdown', pressed, { capture: true, once: true });
  document.addEventListener('keydown', pressed, { capture: true, once: true });
}
