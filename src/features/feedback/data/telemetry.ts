import {
  CLIENT_ERRORS,
  FUNNEL_EVENTS,
  QUESTION_REPORTS,
  SOURCE_MAX,
  clientErrorRow,
  errorMessage,
  funnelEventId,
  funnelEventRow,
  questionReportRow,
  type ErrorSource,
  type FunnelStep,
  type QuestionReportInput,
} from './rows';
import { CONTENT_VERSION } from '../../anatomy-revision/data/content/version';

/**
 * What the app tells its owner about itself: a question a student says is
 * wrong, a page that broke, and how far a new visitor got.
 *
 * FIRST-PARTY, AND NOTHING ON THE DEVICE. Every row goes to this project's own
 * Firestore, under the uid the visitor already has (every visitor is signed in
 * anonymously before anything renders). No third-party script, no cookie and
 * no new storage key, which is what lets the site go on having no consent
 * banner. The privacy policy says what is kept and for how long.
 *
 * NEVER IN THE WAY. Nothing here is awaited by a screen, and nothing here
 * throws: a refused or offline write is dropped. Telemetry that can break the
 * thing it measures is worse than none.
 *
 * Firebase is imported dynamically, as data/repository.ts does, so a local
 * build stays Firebase-free and none of this weighs on the entry chunk.
 *
 * The three collections are append-only for the author (firestore.rules), and
 * data/accountLifecycle.ts removes all three when an account is deleted.
 */

const ENABLED =
  (import.meta.env.VITE_PERSISTENCE ?? 'local') === 'firestore' && import.meta.env.VITE_PUBLIC_DEMO !== '1';

export * from './rows';

/**
 * The database, the SDK and whose row this is; null where there is nobody to
 * write as. The imports sit in the arm of a ternary on a build-time constant
 * so that a build without Firebase (local, the public demo) drops them and
 * the chunks behind them: features/educator/demo/__tests__/demoIsolation.
 */
async function firestore() {
  const loaded = ENABLED
    ? await Promise.all([import('../../anatomy-revision/data/firebase'), import('firebase/firestore')])
    : null;
  if (!loaded) return null;
  const [{ getDb, getFirebaseAuth }, sdk] = loaded;
  const auth = getFirebaseAuth();
  // Waits for a restored session rather than reading `currentUser` early and
  // finding nobody. It never signs anyone in: that is AuthProvider's job.
  await auth.authStateReady();
  const uid = auth.currentUser?.uid;
  return uid ? { db: getDb(), uid, sdk } : null;
}

/** Resolves true once the report is saved, false if it could not be. The one write here a screen waits for. */
export async function reportQuestion(input: QuestionReportInput): Promise<boolean> {
  if (!ENABLED) return false;
  try {
    const store = await firestore();
    if (!store) return false;
    const { db, uid, sdk } = store;
    const report = questionReportRow(uid, input, CONTENT_VERSION, new Date());
    // Offline, the write is queued on the device and the promise waits for the
    // server. The report is as good as sent, so the student is not kept waiting.
    const write = (row: typeof report) =>
      Promise.race([sdk.addDoc(sdk.collection(db, QUESTION_REPORTS), row), new Promise((resolve) => setTimeout(resolve, QUEUED_AFTER_MS))]);
    try {
      await write(report);
    } catch (error) {
      // Rules deployed before 25 Oct 2026 refuse the `shown` snapshot. The
      // report still matters more than the snapshot: send it without.
      if (!report.shown) throw error;
      const plain = { ...report };
      delete plain.shown;
      await write(plain);
    }
    return true;
  } catch {
    return false;
  }
}

const QUEUED_AFTER_MS = 6000;

/** Whether a report can be sent at all, so the control is not offered where it would do nothing. */
export const REPORTING_AVAILABLE = ENABLED;

/** A page that loops on an error must not write a row per frame. */
const MAX_ERRORS_PER_LOAD = 5;
const reported = new Set<string>();

export function reportClientError(source: ErrorSource, error: unknown): void {
  if (!ENABLED) return;
  const message = errorMessage(error);
  if (!message || reported.has(message) || reported.size >= MAX_ERRORS_PER_LOAD) return;
  reported.add(message);
  void (async () => {
    try {
      const store = await firestore();
      if (!store) return;
      const { db, uid, sdk } = store;
      const page = { path: window.location.pathname, userAgent: navigator.userAgent };
      const row = clientErrorRow(uid, source, error, page, CONTENT_VERSION, new Date());
      await sdk.addDoc(sdk.collection(db, CLIENT_ERRORS), row);
    } catch {
      // Reporting an error must never be one.
    }
  })();
}

/** Errors nothing catches. Called once, from main.tsx. */
export function installErrorReporting(): void {
  if (!ENABLED) return;
  window.addEventListener('error', (event) => reportClientError('error', event.error ?? event.message));
  window.addEventListener('unhandledrejection', (event) => reportClientError('rejection', event.reason));
}

/**
 * Where this visit came from, read once as the page opens: the address is
 * rewritten by the router long before most steps are reached.
 */
const ARRIVED_FROM = arrivalSource();

function arrivalSource(): string {
  try {
    const tagged = new URLSearchParams(window.location.search).get('utm_source');
    if (tagged) return tagged.slice(0, SOURCE_MAX);
    if (!document.referrer) return '';
    const host = new URL(document.referrer).host;
    return host === window.location.host ? '' : host.slice(0, SOURCE_MAX);
  } catch {
    return '';
  }
}

const tracked = new Set<FunnelStep>();

/**
 * Records that this account reached a step. Safe to call on every render of
 * the screen that marks it: once per page load here, and once per account in
 * the rules, which refuse to overwrite the first.
 */
export function trackStep(step: FunnelStep): void {
  if (!ENABLED || tracked.has(step)) return;
  tracked.add(step);
  void (async () => {
    try {
      const store = await firestore();
      if (!store) return;
      const { db, uid, sdk } = store;
      const event = funnelEventRow(uid, step, ARRIVED_FROM, new Date());
      await sdk.setDoc(sdk.doc(db, FUNNEL_EVENTS, funnelEventId(uid, step)), event);
    } catch {
      // Already recorded for this account, or offline. Either way, nothing to do.
    }
  })();
}
