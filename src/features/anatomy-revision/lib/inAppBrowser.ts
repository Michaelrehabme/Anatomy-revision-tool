/**
 * Which app's built-in browser this page is open in, if any.
 *
 * WHY IT MATTERS. A link tapped in Instagram, TikTok or Facebook opens inside
 * that app, not in Safari or Chrome, and Google refuses to sign anyone in from
 * there: its sign-in page answers "disallowed_useragent" in an embedded
 * browser, whether it is opened as a popup or as a redirect. That is policy on
 * Google's side, so no change of sign-in method gets round it. An advert or a
 * post sends people to exactly these browsers, and a "Continue with Google"
 * button that cannot work is the first thing they would press.
 *
 * So the account form says what is happening and offers the two ways that do
 * work: an email and password here, or the same page in the phone's own
 * browser (Auth/AccountForm.tsx).
 *
 * Read from the user agent, which these apps all mark. Android's Custom Tabs
 * and iOS's Safari view (WhatsApp, Gmail, most others) are real browsers, carry
 * no such mark, and are rightly not caught.
 */

const APPS: { name: string; pattern: RegExp }[] = [
  { name: 'Instagram', pattern: /Instagram/i },
  // The Facebook app and Messenger both mark themselves FBAN/FBAV; newer builds FB_IAB.
  { name: 'Facebook', pattern: /FBAN|FBAV|FB_IAB|FBIOS/ },
  { name: 'TikTok', pattern: /musical_ly|BytedanceWebview|TikTok/i },
  { name: 'Snapchat', pattern: /Snapchat/i },
  { name: 'LinkedIn', pattern: /LinkedInApp/i },
];

export function inAppBrowserName(userAgent: string): string | null {
  return APPS.find((app) => app.pattern.test(userAgent))?.name ?? null;
}

/** The app this page is open in, read once; null in an ordinary browser, and outside one. */
export function currentInAppBrowser(): string | null {
  return typeof navigator === 'undefined' ? null : inAppBrowserName(navigator.userAgent);
}

/** Where the "open in your browser" option lives on this phone, in words a student can follow. */
export function openInBrowserHint(userAgent: string): string {
  const apple = /iPhone|iPad|iPod/i.test(userAgent);
  return apple
    ? 'tap the ••• menu and choose Open in external browser (or Open in Safari)'
    : 'tap the ⋮ menu and choose Open in browser (or Open in Chrome)';
}
