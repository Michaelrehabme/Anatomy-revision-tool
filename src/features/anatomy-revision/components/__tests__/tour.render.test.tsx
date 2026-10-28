import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Tour } from '../shared/Tour';
import { shouldShowTour } from '../../lib/tours';

/**
 * The tour overlay (shared/Tour.tsx) as a student meets it: it plays once,
 * steps the parts of the page that are there and skips the ones that are
 * not, can be left with Skip or Escape, and gives focus back afterwards.
 * jsdom has no Web Animations API, so motionReduced() is true and the tour
 * starts on the next tick rather than after the entrances.
 */

let desktop = true;
beforeEach(() => {
  localStorage.clear();
  window.matchMedia = ((query: string) => ({
    matches: query.includes('min-width') ? desktop : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

/** A stand-in Setup screen: every setup target but the spaced-repetition switch. */
function Page() {
  return (
    <div>
      <button type="button">Somewhere else</button>
      <div data-tour="setup-formats">formats</div>
      <div data-tour="setup-length">length</div>
      <button type="button" data-tour="setup-begin">Begin</button>
      <Tour tourKey="setup" />
    </div>
  );
}

async function renderPage() {
  render(<Page />);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('Tour', () => {
  it('steps only the parts that are on the page, then stays seen', async () => {
    await renderPage();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('1 of 3');
    expect(dialog).toHaveTextContent('Which kinds of question');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(dialog).toHaveTextContent('How long');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(dialog).toHaveTextContent('Which kinds of question');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(dialog).toHaveTextContent('3 of 3');
    expect(dialog).not.toHaveTextContent('Spaced repetition');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(shouldShowTour('setup')).toBe(false);
  });

  it('does not play a second time', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    document.body.innerHTML = '';
    await renderPage();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on Escape and hands focus back', async () => {
    const before = document.createElement('button');
    document.body.appendChild(before);
    before.focus();
    await renderPage();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(before);
    expect(shouldShowTour('setup')).toBe(false);
  });

  it('keeps Tab inside the card', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const next = screen.getByRole('button', { name: 'Next' });
    next.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Skip tour' }));
  });

  it('runs on a phone too, the card full width', async () => {
    desktop = false;
    await renderPage();
    const dialog = screen.getByRole('dialog');
    expect(dialog.style.width).toBe(`${window.innerWidth - 32}px`);
    desktop = true;
  });
});
