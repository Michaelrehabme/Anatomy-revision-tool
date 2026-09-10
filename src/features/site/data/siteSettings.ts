import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDb } from '../../anatomy-revision/data/firebase';

/**
 * Runtime switches for the public site, held in Firestore rather than baked
 * into the build.
 *
 * The marketing home page is the first one: it needs to be turnable off in
 * seconds, from a phone, without a deploy. An environment variable would mean
 * a rebuild and a Netlify round trip to undo a bad launch, which is exactly
 * the wrong shape for a control whose whole purpose is "take it down again".
 *
 * DEFAULTS ARE OFF, AND A FAILED READ IS OFF. Firestore being unreachable
 * must never put a marketing page in front of someone trying to revise. The
 * app is the product; the home page is the wrapper.
 *
 * The last known value is cached in localStorage so a returning visitor does
 * not wait on a network round trip to find out which page they are on. The
 * cache is a speed optimisation only — the document is still read on every
 * load, and the fresh value wins.
 */

const CACHE_KEY = 'anatomy-revision:v1:siteSettings';

export interface SiteSettings {
  /** When true, a visitor who has not been through onboarding sees the marketing page at "/". */
  marketingHomeEnabled: boolean;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  marketingHomeEnabled: false,
};

function parse(value: unknown): SiteSettings {
  const data = (value ?? {}) as Record<string, unknown>;
  return { marketingHomeEnabled: data.marketingHomeEnabled === true };
}

/** Last known settings, or the defaults. Synchronous, for the first paint. */
export function cachedSiteSettings(): SiteSettings {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? parse(JSON.parse(raw)) : DEFAULT_SITE_SETTINGS;
  } catch {
    // A private window, cleared storage, or storage that throws on access.
    return DEFAULT_SITE_SETTINGS;
  }
}

export async function fetchSiteSettings(): Promise<SiteSettings> {
  try {
    const snapshot = await getDoc(doc(getDb(), 'settings', 'site'));
    const settings = parse(snapshot.exists() ? snapshot.data() : {});
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
    } catch {
      // Caching is optional; never let it break the read.
    }
    return settings;
  } catch {
    // Unreachable, refused, offline. Off is the safe answer.
    return DEFAULT_SITE_SETTINGS;
  }
}

/** Admin-only — firestore.rules enforces it; this is the write the toggle performs. */
export async function setMarketingHomeEnabled(enabled: boolean): Promise<void> {
  await setDoc(
    doc(getDb(), 'settings', 'site'),
    { marketingHomeEnabled: enabled, updatedAt: new Date().toISOString() },
    { merge: true },
  );
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ marketingHomeEnabled: enabled }));
  } catch {
    /* as above */
  }
}
