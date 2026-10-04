import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * The app's motion layer (LocusMSK Web App v2). Screens stay declarative: they
 * mark elements with a data attribute and the shell that wraps them plays the
 * matching entrance when the element first reaches the DOM — on mount, or
 * later when a repository read resolves and the rows arrive.
 *
 *   data-in        a block of the page: fades up, staggered in document order
 *   data-row       a list row: the same, on a tighter stagger
 *   data-count     a number: counts up from zero (the element must hold one text node)
 *   data-wbar      a vertical bar in a chart: grows from its base
 *   data-rbar      a horizontal bar: grows from the left
 *   data-xp        the level bar in the sidebar: grows from the left, slower
 *   data-line      an SVG path with pathLength="1": draws itself
 *   data-dash      a dashed SVG path: wipes in left to right
 *   data-dot       the end marker of a line: pops once the line has drawn
 *   data-band      a region of the body figure: fades in, in the order of its value
 *   data-pip       a mastery pip: pops, after the row it sits in
 *   data-feedback  an answer's verdict: fades up
 *   data-fx        "shake" | "pulse", played each time the value is set
 *
 * Nothing here changes layout or final state. Every animation ends where the
 * static page already was, so reduced motion — or a browser without the Web
 * Animations API, which includes the test environment — simply skips it.
 */

export const EASE = 'cubic-bezier(0.2, 0, 0, 1)';
const DRAW = 'cubic-bezier(0.4, 0, 0.2, 1)';

const SELECTOR =
  '[data-in],[data-row],[data-count],[data-wbar],[data-rbar],[data-xp],[data-line],[data-dash],[data-dot],[data-band],[data-pip],[data-feedback],[data-fx]';

/** Rows past this in one batch are below the fold; animating them is cost with nothing to see. */
const MAX_STAGGERED_ROWS = 24;
const MAX_STAGGER_MS = 600;

export function motionReduced(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  if (typeof Element === 'undefined' || typeof Element.prototype.animate !== 'function') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function play(el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
  el.animate(keyframes, { duration: 320, easing: EASE, fill: 'backwards', ...options });
}

function fadeUp(el: Element, dy: number, delay: number, duration = 460) {
  play(el, [{ opacity: 0, transform: `translateY(${dy}px)` }, { opacity: 1, transform: 'translateY(0)' }], { duration, delay });
}

/**
 * Counts the first number in the element up from zero, leaving the text around
 * it alone. It writes to React's own text node, so it stops the moment React
 * writes something else there, and always finishes on the string React rendered.
 */
function countUp(el: Element, index: number) {
  if (counted.has(el)) return;
  const node = el.firstChild;
  if (el.childNodes.length !== 1 || !node || node.nodeType !== Node.TEXT_NODE) return;
  const full = node.nodeValue ?? '';
  const match = full.match(/\d[\d,]*/);
  if (!match || match.index === undefined) return;
  const to = Number(match[0].replace(/,/g, ''));
  if (!Number.isFinite(to) || to === 0) return;
  counted.add(el);
  const grouped = match[0].includes(',');
  const before = full.slice(0, match.index);
  const after = full.slice(match.index + match[0].length);
  const startAt = performance.now() + 120 + index * 40;
  let written = `${before}0${after}`;
  node.nodeValue = written;
  const step = (now: number) => {
    if (node.nodeValue !== written) return;
    const k = Math.min(1, Math.max(0, (now - startAt) / 900));
    if (k >= 1) {
      node.nodeValue = full;
      return;
    }
    const value = Math.round(to * (1 - Math.pow(1 - k, 3)));
    written = `${before}${grouped ? value.toLocaleString('en-GB') : value}${after}`;
    node.nodeValue = written;
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/**
 * Numbers that have had their count. A figure that mounts as 0 and is filled
 * in by a repository read counts when the real value lands, once; after that
 * its updates are just updates.
 */
const counted = new WeakSet<Element>();

function playFx(el: Element) {
  const fx = el.getAttribute('data-fx');
  if (fx === 'shake') {
    play(el, [0, -8, 7, -4, 0].map((x) => ({ transform: `translateX(${x}px)` })), { duration: 360, easing: 'linear', fill: 'none' });
  } else if (fx === 'pulse') {
    play(el, [1, 1.015, 1].map((s) => ({ transform: `scale(${s})` })), { duration: 300, fill: 'none' });
  }
}

/** Elements that have already made their entrance — a keyed reorder re-inserts a node, and must not replay it. */
const entered = new WeakSet<Element>();

function enter(roots: Element[], settled: boolean) {
  const fresh: Element[] = [];
  for (const root of roots) {
    const found = [...(root.matches(SELECTOR) ? [root] : []), ...root.querySelectorAll(SELECTOR)];
    for (const el of found) {
      if (entered.has(el)) continue;
      entered.add(el);
      fresh.push(el);
    }
  }
  if (fresh.length === 0) return;

  // A screen arriving gets the full stagger; rows swapped in later (a search,
  // a filter) get a quicker, shallower one so typing never feels held up.
  const rowGap = settled ? 25 : 45;
  const rowDy = settled ? 10 : 14;
  const rowDelay = new Map<Element, number>();
  const rowsBelowFold = new Set<Element>();
  const n = { in: 0, row: 0, count: 0, wbar: 0, rbar: 0, line: 0 };
  const pipsInRow = new Map<Element | null, number>();

  for (const el of fresh) {
    if (el.hasAttribute('data-in')) fadeUp(el, 14, Math.min(n.in++ * 55, MAX_STAGGER_MS));
    if (el.hasAttribute('data-row')) {
      const i = n.row++;
      const delay = Math.min(i * rowGap, MAX_STAGGER_MS);
      rowDelay.set(el, delay);
      if (i < MAX_STAGGERED_ROWS) fadeUp(el, rowDy, delay);
      else rowsBelowFold.add(el);
    }
    if (el.hasAttribute('data-count')) countUp(el, n.count++);
    if (el.hasAttribute('data-wbar')) {
      (el as HTMLElement).style.transformOrigin = '50% 100%';
      play(el, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 700, delay: 200 + n.wbar++ * 45 });
    }
    if (el.hasAttribute('data-rbar')) {
      (el as HTMLElement).style.transformOrigin = '0 50%';
      play(el, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 900, delay: 250 + n.rbar++ * 90 });
    }
    if (el.hasAttribute('data-xp')) {
      (el as HTMLElement).style.transformOrigin = '0 50%';
      play(el, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 1100, delay: 300 });
    }
    if (el.hasAttribute('data-line')) {
      play(el, [{ strokeDasharray: '1 1', strokeDashoffset: 1 }, { strokeDasharray: '1 1', strokeDashoffset: 0 }], {
        duration: 1400,
        delay: 300 + n.line++ * 250,
        easing: DRAW,
      });
    }
    if (el.hasAttribute('data-dash')) {
      play(el, [{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 0 0 0)' }], { duration: 1400, delay: 300, easing: DRAW });
    }
    if (el.hasAttribute('data-dot')) {
      const dot = el as SVGElement;
      dot.style.transformBox = 'fill-box';
      dot.style.transformOrigin = 'center';
      play(el, [{ transform: 'scale(0)' }, { transform: 'scale(1.6)', offset: 0.6 }, { transform: 'scale(1)' }], { duration: 500, delay: 1750 });
    }
    if (el.hasAttribute('data-band')) {
      const order = Number(el.getAttribute('data-band')) || 0;
      play(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 350 + order * 160, easing: 'ease-out' });
    }
    if (el.hasAttribute('data-pip')) {
      const row = el.closest('[data-row]');
      if (row && rowsBelowFold.has(row)) continue;
      const j = pipsInRow.get(row) ?? 0;
      pipsInRow.set(row, j + 1);
      play(el, [{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 260, delay: ((row && rowDelay.get(row)) ?? 0) + 200 + Math.min(j, 10) * 50 });
    }
    if (el.hasAttribute('data-feedback')) fadeUp(el, 10, 120, 380);
    if (el.hasAttribute('data-fx')) playFx(el);
  }
}

/** How long after a shell mounts its late arrivals still count as part of the screen coming in. */
const ARRIVAL_WINDOW_MS = 1500;

/**
 * Attach to a shell's outermost element. Plays the entrance of everything
 * marked inside it, now and as it arrives.
 */
export function useMotionRoot<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || motionReduced()) return;
    const mountedAt = performance.now();
    enter([root], false);
    const observer = new MutationObserver((records) => {
      if (motionReduced()) return;
      const added: Element[] = [];
      for (const record of records) {
        if (record.type === 'characterData') {
          const holder = record.target.parentElement;
          if (holder?.hasAttribute('data-count')) countUp(holder, 0);
          continue;
        }
        if (record.type === 'attributes') {
          // React sets attributes before it inserts a node, so a record here is
          // always a change on an element already in the page, never an arrival.
          entered.add(record.target as Element);
          playFx(record.target as Element);
          continue;
        }
        record.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) added.push(node as Element);
        });
      }
      if (added.length > 0) enter(added, performance.now() - mountedAt > ARRIVAL_WINDOW_MS);
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-fx'] });
    return () => observer.disconnect();
  }, []);
  return ref;
}

/**
 * Runs a theme or contrast change as a cross-fade where the browser can
 * (View Transitions), and straight away where it cannot.
 */
export function withThemeTransition(change: () => void) {
  const doc = typeof document === 'undefined' ? null : (document as Document & { startViewTransition?: (cb: () => void) => unknown });
  if (doc && typeof doc.startViewTransition === 'function' && !motionReduced()) doc.startViewTransition(change);
  else change();
}
