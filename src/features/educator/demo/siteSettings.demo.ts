/**
 * Demo-mode stand-in for site/data/siteSettings.ts.
 *
 * The real one imports getDb, and App.tsx reads it on every load — so without
 * this alias the public demo bundles the Firebase SDK, which
 * vite.config.demo.ts exists to prevent.
 *
 * Marketing is off. The demo link is sent to a course leader to show them the
 * educator dashboard; dropping them on a pricing page first would waste the
 * one click you get.
 */

export interface SiteSettings {
  marketingHomeEnabled: boolean;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = { marketingHomeEnabled: false };

export function cachedSiteSettings(): SiteSettings {
  return DEFAULT_SITE_SETTINGS;
}

export async function fetchSiteSettings(): Promise<SiteSettings> {
  return DEFAULT_SITE_SETTINGS;
}

export async function setMarketingHomeEnabled(): Promise<void> {
  throw new Error('Site settings are read-only in the demo.');
}
