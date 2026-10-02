/**
 * Whether a stale download is brought up to date without asking.
 *
 * WHY ANY UPDATE IS APPLIED UNASKED. A downloaded area's copy of a picture is
 * served ahead of everything else, so once a plate is redrawn the student who
 * downloaded the area is the ONE person still shown the old one — online or
 * not — until they open the Account screen and press Update. Most never
 * would, and a picture that no longer matches its answer is the failure the
 * image cache's version exists to prevent (anatomyCache.ts).
 *
 * WHY NOT EVERY UPDATE. An update costs the student's data, and nobody agreed
 * to sixty megabytes on a phone contract by opening the app. So the small
 * ones go through and the large ones wait behind the button.
 *
 * THE LINE IS 5 MB. What gets redrawn in practice is a structure or a few: a
 * turntable is twelve frames, context and highlight, at 40-80 kB each — one to
 * two megabytes per structure. Five covers a correction round of two or three
 * structures, is half of the smallest area there is (the elbow, 10 MB), and
 * on a poor 1 Mbit/s connection is under a minute in the background. A
 * re-render of a whole family — every muscle plate, tens of megabytes — is
 * well past it and still asks, which is the case the button is for.
 */
export const AUTO_UPDATE_MAX_BYTES = 5_000_000;

export interface AutoUpdateFacts {
  /** The device believes it has a network. */
  online: boolean;
  /** The account may study this area NOW — not "could when it was downloaded". */
  entitled: boolean;
  /** The browser's "reduce data use" setting, where it reports one. */
  saveData: boolean;
  /** What the update would fetch, from diffing the new manifest against what is held. */
  fetchBytes: number;
}

export type AutoUpdateDecision = 'apply' | 'mark';

/**
 * 'apply' fetches now, quietly; 'mark' leaves "Update available" and its
 * button. Anything in doubt is 'mark': the cost of marking wrongly is one
 * press, the cost of applying wrongly is somebody else's money.
 *
 * AN UPDATE THAT FETCHES NOTHING ALWAYS APPLIES. When all that changed is
 * that files were retired, bringing the area up to date is bookkeeping — no
 * request is made — so neither the paywall nor the data saver has anything to
 * object to, and leaving "Update available" on a row whose update is empty
 * would be asking permission for nothing.
 */
export function autoUpdateDecision({ online, entitled, saveData, fetchBytes }: AutoUpdateFacts): AutoUpdateDecision {
  if (fetchBytes === 0) return 'apply';
  if (!online || !entitled || saveData) return 'mark';
  return fetchBytes <= AUTO_UPDATE_MAX_BYTES ? 'apply' : 'mark';
}

/** navigator.connection.saveData, on the browsers that have it (Chromium). Absent means not asked for. */
export function saveDataRequested(): boolean {
  if (typeof navigator === 'undefined') return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}
