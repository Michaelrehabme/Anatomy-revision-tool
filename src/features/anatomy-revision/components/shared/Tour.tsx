import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useIsDesktop } from '../../hooks/useIsDesktop';
import { markTourSeen, shouldShowTour, stepsFor, type TourKey, type TourStep } from '../../lib/tours';
import { Button } from './Button';
import { motionReduced } from './motion';

/** Long enough for motion.ts's staggered entrances to land, so the spotlight measures where things end up. */
const ENTRANCE_SETTLE_MS = 700;
const GAP = 14;
const EDGE = 16;
const DESKTOP_CARD_WIDTH = 360;

function targetOf(step: TourStep): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Where the card goes: below the spotlight if it fits, else above it, else
 * (desktop) beside it — the sidebar nav and the weakest list are taller than
 * the space either side of them. On a phone the card is full width, and a
 * target that leaves no room above or below gets the card along the bottom.
 */
function placeCard(target: Box, card: { width: number; height: number }, desktop: boolean): { top: number; left: number } {
  const { top, left } = placeBeside(target, card, desktop);
  // Never off screen, whatever the target does: a table taller than the viewport has no room above or below it.
  return { top: Math.min(Math.max(top, EDGE), window.innerHeight - card.height - EDGE), left };
}

function placeBeside(target: Box, card: { width: number; height: number }, desktop: boolean): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = desktop ? Math.min(Math.max(target.left, EDGE), vw - card.width - EDGE) : EDGE;
  const below = target.top + target.height + GAP;
  if (below + card.height <= vh - EDGE) return { top: below, left };
  const above = target.top - GAP - card.height;
  if (above >= EDGE) return { top: above, left };
  const top = Math.min(Math.max(target.top, EDGE), vh - card.height - EDGE);
  if (!desktop) return { top: vh - card.height - EDGE, left };
  const right = target.left + target.width + GAP;
  if (right + card.width <= vw - EDGE) return { top, left: right };
  return { top, left: Math.max(EDGE, target.left - GAP - card.width) };
}

/**
 * A screen's step-by-step tour (lib/tours.ts). Mount it once in the screen —
 * desktop and mobile both — and it plays the first time the screen opens on
 * this device, then never again unless replayed from Account.
 *
 * Modal while it runs, by hand like the Atlas filter drawer (the app has no
 * dialog primitive): a scrim with a hole cut over the part being described,
 * Escape to leave, Tab kept inside the card, focus handed back afterwards,
 * and the page held still under it. Portalled to <body> so no screen's
 * stacking or overflow can clip it.
 */
export function Tour({ tourKey, ready = true }: { tourKey: TourKey; ready?: boolean }) {
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [box, setBox] = useState<Box | null>(null);
  const [cardSize, setCardSize] = useState({ width: DESKTOP_CARD_WIDTH, height: 200 });
  const cardRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const reduced = motionReduced();
  const focusNext = () => cardRef.current?.querySelector<HTMLButtonElement>('[data-tour-next]')?.focus();

  // Start once the screen has its content, after the entrances have played.
  useEffect(() => {
    if (!ready || !shouldShowTour(tourKey)) return;
    const timer = window.setTimeout(() => {
      const present = stepsFor(tourKey, desktop ? 'desktop' : 'mobile').filter((s) => targetOf(s));
      if (present.length === 0) return;
      setSteps(present);
      setIndex(0);
      setOpen(true);
    }, reduced ? 0 : ENTRANCE_SETTLE_MS);
    return () => window.clearTimeout(timer);
    // `desktop` is read once at start: crossing the breakpoint remounts the screen, and this with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tourKey]);

  const close = useCallback(() => {
    markTourSeen(tourKey);
    setOpen(false);
  }, [tourKey]);

  const step = open ? steps[index] : undefined;

  // Bring the step's part of the page into view and keep the spotlight on it.
  useLayoutEffect(() => {
    if (!step) return;
    const el = targetOf(step);
    if (!el) {
      setBox(null);
      return;
    }
    // Instant, not smooth: a class's weakness table runs to thousands of pixels, and a smooth scroll still under way
    // when the card is placed leaves both off screen. The spotlight's own glide is the motion. A target taller than
    // the screen is lined up by its top, where its heading is, rather than centred on its middle.
    el.scrollIntoView?.({ block: el.getBoundingClientRect().height > window.innerHeight * 0.8 ? 'start' : 'center', inline: 'nearest' });
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
      });
    };
    const r = el.getBoundingClientRect();
    setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
    window.addEventListener('resize', measure);
    // Capture: on a phone the page scrolls inside <main>, not the window.
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step]);

  useLayoutEffect(() => {
    if (!cardRef.current) return;
    const { offsetWidth, offsetHeight } = cardRef.current;
    setCardSize((size) => (size.width === offsetWidth && size.height === offsetHeight ? size : { width: offsetWidth, height: offsetHeight }));
  }, [step]);

  // Modal behaviour: focus in and back out, Escape to leave, Tab kept in the card, page held still.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    focusNext();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === 'Tab' && cardRef.current) {
        const stops = [...cardRef.current.querySelectorAll<HTMLElement>('button:not(:disabled)')];
        if (stops.length === 0) return;
        const active = document.activeElement;
        const leaving = e.shiftKey ? active === stops[0] : active === stops[stops.length - 1];
        if (leaving || !cardRef.current.contains(active)) {
          e.preventDefault();
          (e.shiftKey ? stops[stops.length - 1] : stops[0]).focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, [open, close]);

  // Focus follows the step, so a keyboard user hears each new card.
  useEffect(() => {
    if (open) focusNext();
  }, [open, index]);

  if (!step) return null;

  const last = index === steps.length - 1;
  const width = desktop ? DESKTOP_CARD_WIDTH : window.innerWidth - EDGE * 2;
  const pad = 6;
  const hole = box && { top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2 };
  const position = hole ? placeCard(hole, { width, height: cardSize.height }, desktop) : { top: window.innerHeight - cardSize.height - EDGE, left: EDGE };
  const glide = reduced ? undefined : 'top 260ms ease, left 260ms ease, width 260ms ease, height 260ms ease';

  return createPortal(
    <>
      {/* Catches taps on the page behind: the tour is modal while it runs. */}
      <div className="fixed inset-0 z-[60]" aria-hidden="true" style={hole ? undefined : { background: 'var(--scrim)' }} />
      {hole && (
        <div
          data-tour-spotlight
          aria-hidden="true"
          className="pointer-events-none fixed z-[61]"
          style={{
            ...hole,
            borderRadius: 6,
            boxShadow: '0 0 0 2px var(--acc), 0 0 0 9999px var(--scrim)',
            transition: glide,
          }}
        />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="fixed z-[62] rounded-lg p-5"
        style={{
          top: position.top,
          left: position.left,
          width,
          background: 'var(--pg)',
          border: '1px solid var(--line)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.18)',
          transition: reduced ? undefined : 'top 260ms ease, left 260ms ease',
        }}
      >
        <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
          {index + 1} of {steps.length}
        </div>
        <h2 id={titleId} className="mt-2.5" style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 21, lineHeight: 1.2, color: 'var(--ink)' }}>
          {step.title}
        </h2>
        <p id={bodyId} className="mt-2" style={{ fontSize: 14.5, lineHeight: 1.5, color: 'var(--ink2)' }}>
          {step.body}
        </p>
        <div className="mt-4 flex items-center gap-2.5">
          {!last && (
            <button
              type="button"
              onClick={close}
              className="mr-auto min-h-[44px] border-0 bg-transparent p-0 underline"
              style={{ font: '500 13.5px/1 var(--font-ui)', color: 'var(--ink3)' }}
            >
              Skip tour
            </button>
          )}
          {last && <span className="mr-auto" />}
          {index > 0 && (
            <Button variant="secondary" onClick={() => setIndex(index - 1)} className="min-h-[44px] px-4">
              Back
            </Button>
          )}
          <Button data-tour-next onClick={() => (last ? close() : setIndex(index + 1))} className="min-h-[44px] px-5">
            {last ? 'Done' : 'Next'}
          </Button>
        </div>
      </div>
    </>,
    document.body,
  );
}
