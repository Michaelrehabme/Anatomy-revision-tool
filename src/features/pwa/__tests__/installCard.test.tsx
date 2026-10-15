import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

/**
 * The home screen card (15 October 2026): offered where a phone can install
 * the app, in the words that phone needs, and never where it cannot.
 */

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const IPHONE_INSTAGRAM =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 389.0.0.29.84';

function setBrowser(userAgent: string, standalone = false) {
  vi.stubGlobal('navigator', { ...navigator, userAgent });
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: standalone && query.includes('standalone'), media: query, addEventListener() {}, removeEventListener() {} }));
}

async function load() {
  vi.resetModules();
  const install = await import('../install');
  install.captureInstallPrompt();
  const card = await import('../InstallCard');
  return { ...install, ...card };
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the install card', () => {
  it('offers the browser\'s own install dialog where there is one', async () => {
    setBrowser(ANDROID_CHROME);
    const { InstallCard, INSTALL_TITLE } = await load();
    render(<InstallCard />);
    expect(screen.queryByText(INSTALL_TITLE)).toBeNull();

    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    expect(prompt).toHaveBeenCalledOnce();
  });

  it('says Share, then Add to Home Screen, on an iPhone', async () => {
    setBrowser(IPHONE_SAFARI);
    const { InstallCard, INSTALL_TITLE } = await load();
    render(<InstallCard />);
    expect(screen.getByText(INSTALL_TITLE)).toBeTruthy();
    expect(screen.getByText(/Tap the Share button, then Add to Home Screen/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Install' })).toBeNull();
  });

  it('is not offered once installed, or inside an app\'s own browser', async () => {
    setBrowser(IPHONE_SAFARI, true);
    const first = await load();
    const { unmount } = render(<first.InstallCard />);
    expect(screen.queryByText(first.INSTALL_TITLE)).toBeNull();
    unmount();

    setBrowser(IPHONE_INSTAGRAM);
    const second = await load();
    render(<second.InstallCard />);
    expect(screen.queryByText(second.INSTALL_TITLE)).toBeNull();
  });

  it('goes away on "Not now", and stays away', async () => {
    setBrowser(IPHONE_SAFARI);
    const { InstallCard, INSTALL_TITLE } = await load();
    const { unmount } = render(<InstallCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByText(INSTALL_TITLE)).toBeNull();
    unmount();
    render(<InstallCard />);
    expect(screen.queryByText(INSTALL_TITLE)).toBeNull();
  });
});
