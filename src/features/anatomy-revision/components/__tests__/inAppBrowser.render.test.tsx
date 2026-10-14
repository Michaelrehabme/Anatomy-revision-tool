import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { inAppBrowserName } from '../../lib/inAppBrowser';

/**
 * Google sign-in inside an app's own browser (14 October 2026).
 *
 * Google refuses to sign anyone in from Instagram's, TikTok's or Facebook's
 * built-in browser, which is where a link in a post or an advert opens. What
 * is pinned: those browsers are recognised from the user agents they really
 * send, the real browsers people also arrive in are not, and in the first
 * kind the account form says why instead of offering a button that fails.
 */

const auth = vi.hoisted(() => ({
  signInWithGoogle: vi.fn(),
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  sendPasswordReset: vi.fn(),
}));

vi.mock('../../context/AuthProvider', () => ({
  AUTH_ENABLED: true,
  useAuth: () => ({ loading: false, user: null, ...auth }),
}));

const { AccountForm, inAppTitle } = await import('../Auth/AccountForm');

const AGENTS = {
  instagramIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 389.0.0.29.84 (iPhone15,3; iOS 18_5; en_GB; en-GB; scale=3.00; 1290x2796; 755118207)',
  instagramAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240805.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.81 Mobile Safari/537.36 Instagram 349.0.0.39.105 Android',
  tiktokIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_38.4.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/en Region/GB',
  tiktokAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-S911B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.146 Mobile Safari/537.36 trill_370504 BytedanceWebview/d8a21c6',
  facebookIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0.0.38.105;FBBV/662347851;FBDV/iPhone15,3;FBMD/iPhone;FBSN/iOS;FBSV/18.5;FBSS/3;FBID/phone;FBLC/en_GB;FBOP/5]',
  safari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  desktopChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('which browser this is', () => {
  it('recognises the apps whose browsers Google will not sign in from', () => {
    expect(inAppBrowserName(AGENTS.instagramIos)).toBe('Instagram');
    expect(inAppBrowserName(AGENTS.instagramAndroid)).toBe('Instagram');
    expect(inAppBrowserName(AGENTS.tiktokIos)).toBe('TikTok');
    expect(inAppBrowserName(AGENTS.tiktokAndroid)).toBe('TikTok');
    expect(inAppBrowserName(AGENTS.facebookIos)).toBe('Facebook');
  });

  it('leaves ordinary browsers alone', () => {
    expect(inAppBrowserName(AGENTS.safari)).toBeNull();
    expect(inAppBrowserName(AGENTS.chromeAndroid)).toBeNull();
    expect(inAppBrowserName(AGENTS.desktopChrome)).toBeNull();
  });
});

describe('the account form', () => {
  const renderAs = (userAgent: string) => {
    vi.stubGlobal('navigator', { ...navigator, userAgent });
    render(<AccountForm initialMode="sign-up" onDone={() => undefined} />);
  };

  it('explains instead of offering Google inside Instagram, and keeps the email form', () => {
    renderAs(AGENTS.instagramIos);
    expect(screen.queryByRole('button', { name: 'Continue with Google' })).toBeNull();
    expect(screen.getByText(inAppTitle('Instagram'))).toBeTruthy();
    expect(screen.getByText(/Open in external browser/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy the link to this page' })).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
  });

  it('names the Android menu on Android', () => {
    renderAs(AGENTS.tiktokAndroid);
    expect(screen.getByText(inAppTitle('TikTok'))).toBeTruthy();
    expect(screen.getByText(/Open in browser \(or Open in Chrome\)/)).toBeTruthy();
  });

  it('offers Google as before in an ordinary browser', () => {
    renderAs(AGENTS.safari);
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Copy the link to this page' })).toBeNull();
  });
});
