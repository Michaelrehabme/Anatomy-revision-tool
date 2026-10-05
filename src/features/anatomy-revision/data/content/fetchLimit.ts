/**
 * How many areas one account may fetch in an hour, and the arithmetic of
 * counting them (docs/DESIGN-CONTENT-BEHIND-SERVER.md: "per-user rate
 * limiting in the function, about 30 area fetches an hour").
 *
 * THIRTY. There are nine areas, and an honest device asks for each about once
 * per content release and again when a lease is half spent — so thirty is
 * three whole-body fetches in an hour, which only reinstalling the app three
 * times running would reach. It is not what protects the content: nine
 * requests are the whole dataset to an account entitled to it. It bounds what
 * one token can cost — every request is a database read against a daily
 * allowance the whole product shares — and it makes a script visible in the
 * log as the account that keeps hitting it.
 *
 * Pure, with no clock of its own, so the function's tests can walk an hour.
 * Here rather than in netlify/functions because the stored shape is also
 * named in firestore.rules (users/{uid}.contentFetch, which no client may
 * write) and described to whoever reads an account export.
 */
export const CONTENT_FETCHES_PER_HOUR = 30;

export const CONTENT_FETCH_WINDOW_MS = 60 * 60 * 1000;

/** users/{uid}.contentFetch: when the current hour began, and how many fetches it has seen. */
export interface FetchWindow {
  /** Milliseconds since the epoch. */
  windowStart: number;
  count: number;
}

/** The stored window, or null when there is none worth trusting — which counts as a fresh start. */
export function parseFetchWindow(raw: unknown): FetchWindow | null {
  if (!raw || typeof raw !== 'object') return null;
  const { windowStart, count } = raw as { windowStart?: unknown; count?: unknown };
  if (typeof windowStart !== 'number' || !Number.isFinite(windowStart)) return null;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) return null;
  return { windowStart, count };
}

/**
 * One more request against a window: whether it is over the limit, and the
 * window as it stands afterwards.
 *
 * A fixed window, not a sliding one: the hour starts at the first fetch and
 * the count returns to nothing when it ends. A burst straddling the boundary
 * can therefore reach twice the limit, and for a limit whose job is to bound
 * cost and flag scripts that is fine — the simpler rule is the one that can
 * be stored in two numbers and reasoned about from a log line.
 *
 * A window that starts in the future (a clock that moved, a hand edit) is
 * discarded rather than honoured, so nobody is locked out until a date that
 * should never have been written.
 */
export function countFetch(stored: FetchWindow | null | undefined, now: Date): { limited: boolean; window: FetchWindow } {
  const at = now.getTime();
  const live = stored && stored.windowStart <= at && at - stored.windowStart < CONTENT_FETCH_WINDOW_MS;
  if (!live) return { limited: false, window: { windowStart: at, count: 1 } };
  if (stored.count >= CONTENT_FETCHES_PER_HOUR) return { limited: true, window: stored };
  return { limited: false, window: { windowStart: stored.windowStart, count: stored.count + 1 } };
}
