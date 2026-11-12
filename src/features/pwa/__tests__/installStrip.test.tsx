import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

/** The home screen strip (12 November 2026): landing page and the foot of every app page. */

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const IPHONE_INSTAGRAM =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 389.0.0.29.84';
const DESKTOP_FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0';

function setBrowser(userAgent: string, standalone = false) {
  vi.stubGlobal('navigator', { ...navigator, userAgent });
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: standalone && query.includes('standalone'), media: query, addEventListener() {}, removeEventListener() {} }));
}

async function load() {
  vi.resetModules();
  const install = await import('../install');
  install.captureInstallPrompt();
  const strip = await import('../InstallStrip');
  const card = await import('../InstallCard');
  return { ...install, ...strip, ...card };
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the install strip', () => {
  it('shows the iPhone steps on request', async () => {
    setBrowser(IPHONE_SAFARI);
    const { InstallStrip, STRIP_TITLE_PHONE } = await load();
    render(<InstallStrip />);
    expect(screen.getByText(STRIP_TITLE_PHONE)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show me how' }));
    expect(screen.getByText('Add to Home Screen')).toBeTruthy();
  });

  it('offers the browser dialog where there is one', async () => {
    setBrowser(DESKTOP_FIREFOX);
    const { InstallStrip } = await load();
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event('beforeinstallprompt'), { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) });
    render(<InstallStrip />);
    act(() => {
      window.dispatchEvent(event);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    expect(prompt).toHaveBeenCalled();
  });

  it('is absent once installed, in an in-app browser, or with no install route', async () => {
    for (const [ua, standalone] of [[IPHONE_SAFARI, true], [IPHONE_INSTAGRAM, false], [DESKTOP_FIREFOX, false]] as const) {
      setBrowser(ua, standalone);
      const { InstallStrip } = await load();
      const { container } = render(<InstallStrip variant="landing" />);
      expect(container.innerHTML).toBe('');
      cleanup();
    }
  });

  it('hides for 30 days from the footer, but not from the landing page', async () => {
    setBrowser(IPHONE_SAFARI);
    const { InstallStrip, STRIP_TITLE_PHONE } = await load();
    render(<InstallStrip />);
    fireEvent.click(screen.getByRole('button', { name: 'Hide for 30 days' }));
    expect(screen.queryByText(STRIP_TITLE_PHONE)).toBeNull();
    render(<InstallStrip />);
    expect(screen.queryByText(STRIP_TITLE_PHONE)).toBeNull();
    render(<InstallStrip variant="landing" />);
    expect(screen.getByText(STRIP_TITLE_PHONE)).toBeTruthy();
  });

  it('stands down in the footer while the Today card is showing', async () => {
    setBrowser(IPHONE_SAFARI);
    const { InstallStrip, InstallCard, STRIP_TITLE_PHONE } = await load();
    render(
      <>
        <InstallCard />
        <InstallStrip />
      </>,
    );
    // The card carries the same title; only one of the two may be on screen.
    expect(screen.getAllByText(STRIP_TITLE_PHONE)).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Show me how' })).toBeNull();
  });
});
