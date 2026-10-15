import { useEffect, useState } from 'react';
import { currentInAppBrowser } from '../anatomy-revision/lib/inAppBrowser';

/**
 * Whether, and how, this phone can put LocusMSK on its home screen.
 *
 * WHY IT IS ASKED AT ALL. A student who has to find the site again in a
 * browser tab tomorrow mostly does not. On the home screen the app is one tap
 * away, opens full screen, and is what the offline downloads were built for.
 *
 * THREE CASES, because the platforms differ:
 *  - Chrome and Edge on Android (and desktop) fire `beforeinstallprompt`, which
 *    can be kept and shown later from a button. It fires once, early, often
 *    before any screen that would use it has mounted, so it is caught here at
 *    startup (main.tsx) and held.
 *  - Safari on iPhone and iPad has no such event and never will: the only way
 *    is Share, then Add to Home Screen, so the card says that in words.
 *  - Anywhere else, including an app's own browser (Instagram, TikTok), there
 *    is nothing to install into, and the card is not shown.
 */

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** Called once from main.tsx, before anything renders. */
export function captureInstallPrompt(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (event) => {
    // Keep the browser from showing its own mini-infobar; the card asks at a better moment.
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    notify();
  });
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

export function isIosSafari(userAgent: string): boolean {
  // Every browser on iOS is Safari underneath, and from iOS 16.4 Chrome, Edge
  // and Firefox there can add to the home screen from their share menu too.
  return /iPhone|iPad|iPod/i.test(userAgent);
}

export type InstallWay = 'prompt' | 'ios' | null;

/** How this browser can install the app right now; null when it cannot, or already has. */
export function installWay(): InstallWay {
  if (installed || isStandalone() || currentInAppBrowser()) return null;
  if (deferred) return 'prompt';
  if (typeof navigator !== 'undefined' && isIosSafari(navigator.userAgent)) return 'ios';
  return null;
}

/** Shows the browser's own install dialog. Resolves true if the student accepted. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  deferred = null;
  notify();
  await event.prompt();
  return (await event.userChoice).outcome === 'accepted';
}

export function useInstallWay(): InstallWay {
  const [way, setWay] = useState<InstallWay>(installWay);
  useEffect(() => {
    const update = () => setWay(installWay());
    listeners.add(update);
    update();
    return () => {
      listeners.delete(update);
    };
  }, []);
  return way;
}
