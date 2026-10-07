import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The content function as a whole, against a database that is a Map and an
 * identity service that is a lookup table.
 *
 * WHO GETS WHICH AREA is the whole of what this function is for, so the body
 * of this file is a matrix: one row per kind of account the product has, and
 * for each the areas it must be given and the areas it must be refused. Every
 * row is then checked a second way — against what the APP's own gate says
 * for the same stored documents — because the promise is not only that each
 * answer is right but that the server and the browser cannot disagree.
 *
 * Nothing here reaches Google or Firebase. NOT UNDER netlify/functions,
 * deliberately: see paddle-webhook.test.ts.
 */

type Row = Record<string, unknown>;

const store = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  reads: [] as string[],
  writes: [] as string[],
  failReads: false,
  failWrites: false,
}));

vi.mock('firebase-admin/app', () => ({
  initializeApp: () => ({}),
  cert: () => ({}),
  getApps: () => [{}],
}));

vi.mock('firebase-admin/firestore', () => {
  const db = {
    doc: (path: string) => ({
      path,
      get: async () => {
        store.reads.push(path);
        if (store.failReads) throw new Error('UNAVAILABLE: the read did not land');
        return { exists: store.docs.has(path), data: () => store.docs.get(path) };
      },
      update: async (data: Record<string, unknown>) => {
        store.writes.push(path);
        if (store.failWrites) throw new Error('UNAVAILABLE: the write did not land');
        if (!store.docs.has(path)) throw new Error('NOT_FOUND');
        store.docs.set(path, { ...store.docs.get(path), ...data });
      },
      set: async () => {
        throw new Error('content-area must never set a document');
      },
    }),
  };
  return { getFirestore: () => db };
});

import handler from '../functions/content-area';
import { forgetRecentRequests } from '../functions/lib/recentRequests';
import { AREAS, type Area } from '../../src/features/anatomy-revision/types/region';
import { entitledAreas, resolveEntitlement, PAYMENT_GRACE_DAYS } from '../../src/features/anatomy-revision/lib/entitlement';
import { accessRecord } from '../../src/features/anatomy-revision/lib/entitlementRecord';
import { VERIFICATION_STARTS, mayHoldFreeArea } from '../../src/features/anatomy-revision/lib/emailVerification';
import { CONTENT_LEASE_DAYS } from '../../src/features/anatomy-revision/data/content/lease';
import { CONTENT_FETCHES_PER_HOUR } from '../../src/features/anatomy-revision/data/content/fetchLimit';
import { STRUCTURE_FACT_FIELDS_NOT_SERVED } from '../../src/features/anatomy-revision/types/structureIndex';
import { AUTHORED_STRUCTURES } from '../../src/features/anatomy-revision/data/seed';
import { areasOf } from '../../src/features/anatomy-revision/types/structure';
import version from '../../.content/version.json';

const NOW = new Date('2026-10-05T12:00:00.000Z');
const DAY = 86_400_000;
const at = (days: number) => new Date(NOW.getTime() + days * DAY).toISOString();
/** A Firestore timestamp as the Admin SDK hands it back. */
const stamp = (days: number) => ({ toMillis: () => NOW.getTime() + days * DAY });

const ORIGIN = 'https://locusmsk.co.uk';
const URL_BASE = `${ORIGIN}/.netlify/functions/content-area`;

/** token -> uid. A token not in here is one Google does not recognise. */
const TOKENS = new Map<string, string>();
/** The uids that are GUESTS: signed in anonymously, with no way of signing in again. */
const GUESTS = new Set<string>();
/** The uids whose email address is NOT confirmed: they signed up with a password and have not followed the link. */
const UNCONFIRMED = new Set<string>();
/** The uids that signed in with Google, which hands over a confirmed address. */
const GOOGLE = new Set<string>();

function user(uid: string, doc: Row | null, kind: 'account' | 'guest' | 'unconfirmed' | 'google' = 'account'): string {
  const token = `token-of-${uid}`;
  TOKENS.set(token, uid);
  if (kind === 'guest') GUESTS.add(uid);
  if (kind === 'unconfirmed') UNCONFIRMED.add(uid);
  if (kind === 'google') GOOGLE.add(uid);
  if (doc) store.docs.set(`users/${uid}`, doc);
  return token;
}

function request(area: string | null, token: string | null, init: { method?: string; origin?: string | null; v?: string } = {}): Request {
  const query = new URLSearchParams();
  if (area !== null) query.set('area', area);
  if (init.v !== undefined) query.set('v', init.v);
  const headers = new Headers();
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (init.origin) headers.set('origin', init.origin);
  return new Request(`${URL_BASE}?${query}`, { method: init.method ?? 'GET', headers });
}

const ask = (area: string | null, token: string | null, init?: Parameters<typeof request>[2]) =>
  handler(request(area, token, init));

/** The areas an account is actually given, by asking for all nine. */
async function served(token: string): Promise<Area[]> {
  const out: Area[] = [];
  for (const area of AREAS) {
    const response = await ask(area, token);
    expect([200, 403], `${area}: ${response.status}`).toContain(response.status);
    if (response.status === 200) out.push(area);
  }
  return out;
}

/**
 * What the APP would open for the same stored documents, in a build with
 * accounts (hooks/useEntitlement.ts does exactly this): nothing for a guest,
 * and for an account its entitlement and the free area it chose — no default.
 */
function appWouldOpen(uid: string): Area[] {
  if (GUESTS.has(uid)) return [];
  const doc = store.docs.get(`users/${uid}`);
  const cohortId = typeof doc?.cohort === 'string' ? doc.cohort : null;
  const record = accessRecord(doc, cohortId ? store.docs.get(`cohorts/${cohortId}`) : undefined, NOW);
  const entitlement = resolveEntitlement(record.candidates, NOW);
  // The free area needs a confirmed address, unless the account predates
  // that being asked for; full access never does (hooks/useEntitlement.ts).
  const holdsFreeArea = mayHoldFreeArea({ emailVerified: !UNCONFIRMED.has(uid), predatesVerification: record.predatesVerification });
  return entitledAreas(AREAS, entitlement, NOW, record.freeArea && holdsFreeArea ? [record.freeArea.area] : []);
}

const PADDLE: Row = { tier: 'individual', source: 'paddle', externalId: 'sub_1', customerId: 'ctm_1', interval: 'month' };
const FREE_KNEE: Row = { area: 'knee', chosenAt: stamp(-40), switches: 0 };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  store.docs.clear();
  store.reads.length = 0;
  store.writes.length = 0;
  store.failReads = false;
  store.failWrites = false;
  TOKENS.clear();
  GUESTS.clear();
  UNCONFIRMED.clear();
  GOOGLE.clear();
  forgetRecentRequests();
  process.env.FIREBASE_SERVICE_ACCOUNT = '{}';
  process.env.VITE_FIREBASE_API_KEY = 'web-api-key';
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  delete process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.CONTENT_ALLOWED_ORIGINS;
  delete process.env.URL;
  delete process.env.DEPLOY_PRIME_URL;
  delete process.env.DEPLOY_URL;
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=web-api-key');
      const { idToken } = JSON.parse(String(init?.body)) as { idToken: string };
      const uid = TOKENS.get(idToken);
      // Google answers 400 for a token it will not vouch for — a forgery, an
      // expired one, or one whose account has been deleted.
      if (!uid) return new Response(JSON.stringify({ error: { message: 'INVALID_ID_TOKEN' } }), { status: 400 });
      // As Google answers: an account lists the ways it can sign in, a guest lists none.
      const providerUserInfo = GUESTS.has(uid)
        ? undefined
        : [GOOGLE.has(uid) ? { providerId: 'google.com', email: `${uid}@gmail.com` } : { providerId: 'password', email: `${uid}@uni.ac.uk` }];
      // …and says whether its address is confirmed. A guest has none, and Google says nothing of one.
      const emailVerified = GUESTS.has(uid) ? undefined : !UNCONFIRMED.has(uid);
      return new Response(
        JSON.stringify({ users: [{ localId: uid, ...(providerUserInfo ? { providerUserInfo } : {}), ...(emailVerified === undefined ? {} : { emailVerified }) }] }),
        { status: 200 },
      );
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * THE MATRIX. `areas` is what the account must be given; everything else must
 * be refused with 403.
 */
const ALL = AREAS;
const NONE: readonly Area[] = [];
/** A profile first written before a confirmed address was asked for, and one written after. */
const OLD_PROFILE = { toMillis: () => Date.parse(VERIFICATION_STARTS) - 60 * DAY };
const NEW_PROFILE = { toMillis: () => Date.parse(VERIFICATION_STARTS) + 2 * DAY };

const matrix: { who: string; doc: Row | null; guest?: true; kind?: 'unconfirmed' | 'google'; cohort?: [string, Row]; areas: readonly Area[] }[] = [
  // ---- A confirmed email address before the free area (7 Oct 2026) ----
  // New since the rule, password, link not followed: nothing, its chosen area included.
  { who: 'an unconfirmed email-and-password account, on the area its document names', doc: { createdAt: NEW_PROFILE, freeArea: FREE_KNEE }, kind: 'unconfirmed', areas: NONE },
  { who: 'an unconfirmed account that has not chosen', doc: { createdAt: NEW_PROFILE }, kind: 'unconfirmed', areas: NONE },
  { who: 'an unconfirmed account whose profile carries no date at all', doc: { freeArea: FREE_KNEE }, kind: 'unconfirmed', areas: NONE },
  { who: 'an unconfirmed account with no profile document', doc: null, kind: 'unconfirmed', areas: NONE },
  // The same account once the link is followed.
  { who: 'that account once its address is confirmed', doc: { createdAt: NEW_PROFILE, freeArea: FREE_KNEE }, areas: ['knee'] },
  { who: 'a Google account, which arrives confirmed', doc: { createdAt: NEW_PROFILE, freeArea: { area: 'hip', chosenAt: stamp(-1), switches: 0 } }, kind: 'google', areas: ['hip'] },
  // Here before the rule: never sent a confirmation email, keeps the one area it has.
  { who: 'an unconfirmed account from before the rule, on its free area', doc: { createdAt: OLD_PROFILE, freeArea: FREE_KNEE }, kind: 'unconfirmed', areas: ['knee'] },
  { who: 'an unconfirmed account from before the rule that has not chosen', doc: { createdAt: OLD_PROFILE }, kind: 'unconfirmed', areas: NONE },
  // A confirmed account that then changed its address: unconfirmed again, and refused until it confirms the new one.
  { who: 'an account that confirmed, chose, then changed its address', doc: { createdAt: NEW_PROFILE, email: 'made-up@example.com', freeArea: FREE_KNEE }, kind: 'unconfirmed', areas: NONE },
  // FULL ACCESS IS NEVER HELD BACK BY IT.
  { who: 'a paying subscriber whose address is not confirmed', doc: { createdAt: NEW_PROFILE, entitlement: { ...PADDLE, expiresAt: at(20) } }, kind: 'unconfirmed', areas: ALL },
  {
    who: 'an unconfirmed subscriber inside the days of grace',
    doc: { createdAt: NEW_PROFILE, entitlement: { ...PADDLE, expiresAt: at(PAYMENT_GRACE_DAYS - 1), paymentIssueSince: at(-1) } },
    kind: 'unconfirmed',
    areas: ALL,
  },
  { who: 'an unconfirmed complimentary account', doc: { createdAt: NEW_PROFILE, entitlement: { tier: 'institutional', source: 'complimentary', expiresAt: null } }, kind: 'unconfirmed', areas: ALL },
  {
    who: 'an unconfirmed member of a licensed class',
    doc: { createdAt: NEW_PROFILE, cohort: 'c-licensed' },
    kind: 'unconfirmed',
    cohort: ['c-licensed', { ownerUid: 'educator', licensedUntil: at(200) }],
    areas: ALL,
  },
  // …and once the paid time is over, an unconfirmed account is a free account like any other.
  { who: 'an unconfirmed subscriber whose subscription has ended', doc: { createdAt: NEW_PROFILE, entitlement: { ...PADDLE, expiresAt: at(-1) }, freeArea: FREE_KNEE }, kind: 'unconfirmed', areas: NONE },
  { who: 'an unconfirmed subscriber from before the rule whose subscription has ended', doc: { createdAt: OLD_PROFILE, entitlement: { ...PADDLE, expiresAt: at(-1) }, freeArea: FREE_KNEE }, kind: 'unconfirmed', areas: ['knee'] },
  // ---- Everything below is a confirmed account unless it is a guest ----
  { who: 'a free account, on the area it chose', doc: { freeArea: FREE_KNEE }, areas: ['knee'] },
  // No default: an account that has not chosen its free area holds none.
  { who: 'a free account that has not chosen its free area', doc: { displayName: 'New' }, areas: NONE },
  { who: 'an account whose profile has not been written yet', doc: null, areas: NONE },
  // A guest is not an account. Nothing, whatever its document says.
  { who: 'a guest with no profile yet', doc: null, guest: true, areas: NONE },
  { who: 'a guest with a profile and no free area', doc: { isAnonymous: true }, guest: true, areas: NONE },
  { who: 'a guest whose document holds a free area from before guests were closed', doc: { isAnonymous: true, freeArea: { area: 'hip', chosenAt: stamp(-1), switches: 0 } }, guest: true, areas: NONE },
  {
    who: 'a guest who joined a licensed class before guests were closed',
    doc: { isAnonymous: true, cohort: 'c-licensed', freeArea: FREE_KNEE },
    guest: true,
    cohort: ['c-licensed', { ownerUid: 'educator', licensedUntil: at(200) }],
    areas: NONE,
  },
  { who: 'a guest whose document somehow holds an entitlement', doc: { isAnonymous: true, entitlement: { ...PADDLE, expiresAt: at(20) } }, guest: true, areas: NONE },
  // The same documents once the guest has created an account: the uid is kept, and it is an account.
  { who: 'that guest after creating an account: the free area comes with them', doc: { isAnonymous: false, freeArea: { area: 'hip', chosenAt: stamp(-1), switches: 0 } }, areas: ['hip'] },
  { who: 'a free account that has used its one change', doc: { freeArea: { area: 'elbow', chosenAt: stamp(-2), switches: 1 } }, areas: ['elbow'] },
  { who: 'a paying subscriber', doc: { entitlement: { ...PADDLE, expiresAt: at(20) }, freeArea: FREE_KNEE }, areas: ALL },
  {
    who: 'a subscriber whose renewal failed, inside the days of grace',
    doc: { entitlement: { ...PADDLE, expiresAt: at(PAYMENT_GRACE_DAYS - 1), paymentIssueSince: at(-1) }, freeArea: FREE_KNEE },
    areas: ALL,
  },
  {
    who: 'a subscriber whose renewal failed, after the grace',
    doc: { entitlement: { ...PADDLE, expiresAt: at(-0.01), paymentIssueSince: at(-PAYMENT_GRACE_DAYS - 0.01) }, freeArea: FREE_KNEE },
    areas: ['knee'],
  },
  {
    who: 'a subscriber who has cancelled, before the paid period ends',
    doc: { entitlement: { ...PADDLE, expiresAt: at(9), cancelAt: at(9) }, freeArea: FREE_KNEE },
    areas: ALL,
  },
  {
    who: 'a subscriber who cancelled, after the paid period ended',
    doc: { entitlement: { ...PADDLE, expiresAt: at(-1), cancelAt: at(-1) }, freeArea: FREE_KNEE },
    areas: ['knee'],
  },
  {
    who: 'a subscriber refunded in full',
    doc: { entitlement: { ...PADDLE, expiresAt: at(-0.5), refundedAt: at(-0.5) }, freeArea: FREE_KNEE },
    areas: ['knee'],
  },
  {
    who: 'a buyer who kept their 14-day cancellation right: paid, not started',
    doc: { entitlement: { ...PADDLE, startsAt: at(10), expiresAt: at(40) }, freeArea: FREE_KNEE },
    areas: ['knee'],
  },
  {
    who: 'the same buyer once the start date has passed',
    doc: { entitlement: { ...PADDLE, startsAt: at(-1), expiresAt: at(29) }, freeArea: FREE_KNEE },
    areas: ALL,
  },
  {
    who: 'a member of a licensed class',
    doc: { cohort: 'c-licensed', freeArea: FREE_KNEE },
    cohort: ['c-licensed', { ownerUid: 'educator', licensedUntil: at(200) }],
    areas: ALL,
  },
  {
    who: 'a member of a class whose licence has lapsed',
    doc: { cohort: 'c-lapsed', freeArea: FREE_KNEE },
    cohort: ['c-lapsed', { ownerUid: 'educator', licensedUntil: at(-3) }],
    areas: ['knee'],
  },
  {
    who: 'a member of a class with no licence',
    doc: { cohort: 'c-plain', freeArea: FREE_KNEE },
    cohort: ['c-plain', { ownerUid: 'educator' }],
    areas: ['knee'],
  },
  { who: 'a member of a class that no longer exists', doc: { cohort: 'c-gone', freeArea: FREE_KNEE }, areas: ['knee'] },
  {
    who: 'an expired subscriber who is also in a licensed class',
    doc: { entitlement: { ...PADDLE, expiresAt: at(-30) }, cohort: 'c-licensed', freeArea: FREE_KNEE },
    cohort: ['c-licensed', { ownerUid: 'educator', licensedUntil: at(200) }],
    areas: ALL,
  },
  { who: 'a complimentary account that never expires', doc: { entitlement: { tier: 'institutional', source: 'complimentary', expiresAt: null } }, areas: ALL },
  {
    who: 'an account holding two entitlements, one live',
    doc: { entitlement: [{ ...PADDLE, expiresAt: at(-5) }, { tier: 'individual', source: 'apple', expiresAt: at(5) }], freeArea: FREE_KNEE },
    areas: ALL,
  },
  // The admin role opens screens, not areas — in the app and here alike.
  { who: 'an admin with no entitlement of their own', doc: { email: 'admin@locusmsk.co.uk', freeArea: FREE_KNEE }, areas: ['knee'] },
  { who: 'an admin holding a complimentary grant', doc: { email: 'admin@locusmsk.co.uk', entitlement: { tier: 'institutional', source: 'complimentary', expiresAt: null } }, areas: ALL },
  { who: 'an account whose stored tier this build has never heard of', doc: { entitlement: { tier: 'platinum', expiresAt: null }, freeArea: FREE_KNEE }, areas: ['knee'] },
  { who: 'an account whose stored free area is not an area', doc: { freeArea: { area: 'everything', chosenAt: stamp(-1), switches: 0 } }, areas: NONE },
];

describe('who is given which area', () => {
  it.each(matrix)('$who', async ({ doc, cohort, areas, guest, kind }) => {
    if (cohort) store.docs.set(`cohorts/${cohort[0]}`, cohort[1]);
    const token = user('u1', doc, guest ? 'guest' : (kind ?? 'account'));

    const given = await served(token);
    expect(given).toEqual(areas);
    // ...and the app, reading the same documents, opens exactly those.
    expect(given).toEqual(appWouldOpen('u1'));
  });

  it('covers every kind of account the task names', () => {
    // A guard on the matrix itself: a row deleted in a refactor fails here.
    expect(matrix.length).toBeGreaterThanOrEqual(43);
    expect(matrix.filter((row) => row.guest).length).toBeGreaterThanOrEqual(5);
    expect(matrix.filter((row) => row.kind === 'unconfirmed').length).toBeGreaterThanOrEqual(12);
    // Full access held by an unconfirmed account: served everything, every time.
    expect(matrix.filter((row) => row.kind === 'unconfirmed' && row.areas.length === AREAS.length).length).toBeGreaterThanOrEqual(4);
  });

  it('tells an unconfirmed account what to do, in the answer and in the log, and hands it nothing', async () => {
    const token = user('n1', { createdAt: NEW_PROFILE, freeArea: FREE_KNEE }, 'unconfirmed');
    const response = await ask('knee', token);
    expect(response.status).toBe(403);
    expect(await response.text()).toBe('Confirm your email address to open your free area');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(store.writes).toEqual([]);
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('its email address is not confirmed'));
    // An area it never chose is a plain refusal: confirming would not open it.
    expect(await (await ask('hip', token)).text()).toBe('Not entitled to this area');
  });

  it('serves the same uid the moment the address is confirmed, whatever its token was minted as', async () => {
    const token = user('n1', { createdAt: NEW_PROFILE, freeArea: FREE_KNEE }, 'unconfirmed');
    expect((await ask('knee', token)).status).toBe(403);
    // The link is followed. The token in the student's hand is the same one;
    // Google's answer about the account is what has changed.
    UNCONFIRMED.delete('n1');
    expect((await ask('knee', token)).status).toBe(200);
    expect(await served(token)).toEqual(['knee']);
  });

  it('does not take a lookup that says nothing about the address as a confirmation', async () => {
    const token = user('n1', { createdAt: NEW_PROFILE, freeArea: FREE_KNEE });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ users: [{ localId: 'n1', providerUserInfo: [{ providerId: 'password' }] }] }), { status: 200 },
    )));
    expect((await ask('knee', token)).status).toBe(403);
  });

  it('never refuses full access for an unconfirmed address, and counts and leases it as for anyone', async () => {
    const token = user('p1', { createdAt: NEW_PROFILE, entitlement: { ...PADDLE, expiresAt: at(20) } }, 'unconfirmed');
    for (const area of AREAS) {
      const response = await ask(area, token);
      expect(response.status, area).toBe(200);
      expect(((await response.json()) as { structures: unknown[] }).structures.length).toBeGreaterThan(0);
    }
    expect((store.docs.get('users/p1')?.contentFetch as { count: number }).count).toBe(AREAS.length);
    expect(console.info).not.toHaveBeenCalledWith(expect.stringContaining('not confirmed'));
  });

  it('refuses a guest before reading anything about them, and tells the log why', async () => {
    const token = user('g1', { isAnonymous: true, freeArea: FREE_KNEE }, 'guest');
    const response = await ask('knee', token);
    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(store.reads).toEqual([]);
    expect(store.writes).toEqual([]);
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('a guest, not an account'));
  });

  it('serves the same uid once it is an account: linking keeps the uid and its free area', async () => {
    const token = user('g1', { isAnonymous: true, freeArea: FREE_KNEE }, 'guest');
    expect((await ask('knee', token)).status).toBe(403);
    // The guest creates an account. Same uid, same document, a sign-in method now listed.
    GUESTS.delete('g1');
    expect((await ask('knee', token)).status).toBe(200);
    expect((await ask('hip', token)).status).toBe(403);
  });
});

describe('who is refused outright', () => {
  it('no token: 401, and nothing is read', async () => {
    expect((await ask('knee', null)).status).toBe(401);
    expect(store.reads).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('a token Google will not vouch for: 401, and nothing is read', async () => {
    const response = await ask('knee', 'forged-token');
    expect(response.status).toBe(401);
    expect(store.reads).toEqual([]);
  });

  it('a deleted account: its token no longer finds an account, so 401', async () => {
    // The profile may even still be there; the account is what was deleted.
    store.docs.set('users/gone', { entitlement: { ...PADDLE, expiresAt: at(20) } });
    expect((await ask('knee', 'token-of-gone')).status).toBe(401);
    expect(store.reads).toEqual([]);
  });

  it('an account whose profile was erased while its sign-in survives: nothing, and no profile back', async () => {
    const token = user('erased', null);
    expect(await served(token)).toEqual([]);
    // And it is not given a profile back by asking.
    expect(store.docs.has('users/erased')).toBe(false);
    expect(store.writes).toEqual([]);
  });

  it('an unknown area: 400, before anyone is asked who the caller is', async () => {
    const token = user('u1', { freeArea: FREE_KNEE });
    for (const area of ['spleen', '', 'back-core', '../version', 'KNEE']) {
      expect((await ask(area, token)).status, area).toBe(400);
    }
    expect((await ask(null, token)).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('anything but GET: 405', async () => {
    const token = user('u1', { freeArea: FREE_KNEE });
    for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
      const response = await ask('knee', token, { method });
      expect(response.status, method).toBe(405);
      expect(response.headers.get('access-control-allow-origin'), method).toBeNull();
    }
  });

  it('a page on another site, even holding a good token: 403', async () => {
    const token = user('paid', { entitlement: { ...PADDLE, expiresAt: at(20) } });
    const response = await ask('knee', token, { origin: 'https://evil.example' });
    expect(response.status).toBe(403);
    expect(store.reads).toEqual([]);
    expect((await ask('knee', token, { origin: ORIGIN })).status).toBe(200);
    expect((await ask('knee', token, { origin: null })).status).toBe(200);
  });

  it('allows a named extra origin, and only that one', async () => {
    const token = user('paid', { entitlement: { ...PADDLE, expiresAt: at(20) } });
    process.env.CONTENT_ALLOWED_ORIGINS = 'https://localhost, capacitor://localhost';
    expect((await ask('knee', token, { origin: 'https://localhost' })).status).toBe(200);
    expect((await ask('knee', token, { origin: 'https://localhost.evil.example' })).status).toBe(403);
  });

  it('never sends a CORS header, on any answer', async () => {
    const token = user('paid', { entitlement: { ...PADDLE, expiresAt: at(20) } });
    for (const response of [await ask('knee', token), await ask('knee', null), await ask('spleen', token)]) {
      expect(response.headers.get('access-control-allow-origin')).toBeNull();
    }
  });
});

describe('when the function cannot find out', () => {
  it('serves nothing if the account cannot be read', async () => {
    const token = user('paid', { entitlement: { ...PADDLE, expiresAt: at(20) } });
    store.failReads = true;
    const response = await ask('knee', token);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('structures');
  });

  it('refuses everyone when it has no key to check tokens with', async () => {
    const token = user('paid', { entitlement: { ...PADDLE, expiresAt: at(20) } });
    delete process.env.VITE_FIREBASE_API_KEY;
    delete process.env.FIREBASE_API_KEY;
    expect((await ask('knee', token)).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('only believes an Auth emulator on this machine', async () => {
    const token = user('paid', { entitlement: { ...PADDLE, expiresAt: at(20) } });
    // A stray setting pointing somewhere else is ignored: Google is still asked.
    process.env.FIREBASE_AUTH_EMULATOR_HOST = 'attacker.example:9099';
    expect((await ask('knee', token)).status).toBe(200);
  });
});

describe('what a grant carries', () => {
  it('the area payload exactly as it was generated, this deploy\'s version, and a lease', async () => {
    const token = user('paid', { entitlement: { ...PADDLE, expiresAt: at(200) } });
    const response = await ask('knee', token, { v: version.version });
    const body = (await response.json()) as { version: string; area: string; leaseUntil: string; structures: { id: string }[] };

    expect(Object.keys(body).sort()).toEqual(['area', 'leaseUntil', 'structures', 'version']);
    expect(body.version).toBe(version.version);
    expect(body.area).toBe('knee');
    expect(body.structures.map((s) => s.id)).toEqual(
      AUTHORED_STRUCTURES.filter((s) => areasOf(s).includes('knee')).map((s) => s.id),
    );
    expect(body.structures.length).toBe(version.areas.knee.structures);
    expect(body.leaseUntil).toBe(at(CONTENT_LEASE_DAYS));
  });

  it('carries facts, and neither the author\'s notes nor the source record', async () => {
    const token = user('paid', { entitlement: { ...PADDLE, expiresAt: at(200) } });
    const body = (await (await ask('shoulder', token)).json()) as { structures: Record<string, unknown>[] };
    expect(body.structures.some((s) => Array.isArray(s.origin) && typeof s.description === 'string')).toBe(true);
    for (const s of body.structures) {
      for (const field of STRUCTURE_FACT_FIELDS_NOT_SERVED) expect(field in s, `${String(s.id)}.${field}`).toBe(false);
    }
  });

  it('gives a client on an older bundle the current version, not an error', async () => {
    const token = user('paid', { entitlement: { ...PADDLE, expiresAt: at(200) } });
    for (const v of ['0000000000000000', 'dev', '', 'x'.repeat(5000)]) {
      const response = await ask('hip', token, { v });
      expect(response.status).toBe(200);
      expect(((await response.json()) as { version: string }).version).toBe(version.version);
    }
  });

  it('is marked private and never to be stored, on every answer', async () => {
    const token = user('paid', { entitlement: { ...PADDLE, expiresAt: at(200) } });
    const free = user('free', { freeArea: FREE_KNEE });
    for (const response of [await ask('knee', token), await ask('hip', free), await ask('knee', null), await ask('x', token)]) {
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(response.headers.get('vary')).toContain('Authorization');
    }
    expect((await ask('knee', token)).headers.get('content-type')).toContain('application/json');
  });

  it('a refusal carries no content at all', async () => {
    const free = user('free', { freeArea: FREE_KNEE });
    const response = await ask('hip', free);
    expect(response.status).toBe(403);
    expect((await response.text()).length).toBeLessThan(100);
  });
});

describe('the lease', () => {
  const leaseOf = async (doc: Row, area: Area = 'knee') =>
    ((await (await ask(area, user('u1', doc))).json()) as { leaseUntil: string }).leaseUntil;

  it('is fourteen days for the free area', async () => {
    expect(await leaseOf({ freeArea: FREE_KNEE })).toBe(at(CONTENT_LEASE_DAYS));
  });

  it('ends with the subscription when that is sooner', async () => {
    expect(await leaseOf({ entitlement: { ...PADDLE, expiresAt: at(3) } })).toBe(at(3));
    expect(await leaseOf({ entitlement: { ...PADDLE, expiresAt: at(300) } })).toBe(at(CONTENT_LEASE_DAYS));
  });

  it('ends with the days of grace after a failed payment', async () => {
    expect(await leaseOf({ entitlement: { ...PADDLE, expiresAt: at(2), paymentIssueSince: at(-1) } })).toBe(at(2));
  });

  it('ends with a class licence that is about to lapse', async () => {
    store.docs.set('cohorts/c1', { licensedUntil: at(1) });
    expect(await leaseOf({ cohort: 'c1' })).toBe(at(1));
  });

  it('is fourteen days for a grant that never expires', async () => {
    expect(await leaseOf({ entitlement: { tier: 'institutional', source: 'complimentary', expiresAt: null } })).toBe(at(CONTENT_LEASE_DAYS));
  });

  // The free area is open whatever the subscription does, so its lease must
  // not be cut short by a subscription about to end.
  it('is fourteen days for the free area of a subscriber about to lapse — once they have lapsed', async () => {
    expect(await leaseOf({ entitlement: { ...PADDLE, expiresAt: at(-1) }, freeArea: FREE_KNEE })).toBe(at(CONTENT_LEASE_DAYS));
  });
});

describe('the limit on fetches', () => {
  it(`serves ${CONTENT_FETCHES_PER_HOUR} in an hour and refuses the next, then starts again`, async () => {
    const token = user('paid', { entitlement: { ...PADDLE, expiresAt: at(200) } });
    for (let i = 0; i < CONTENT_FETCHES_PER_HOUR; i++) {
      expect((await ask(AREAS[i % AREAS.length], token)).status, `fetch ${i + 1}`).toBe(200);
    }
    const refused = await ask('knee', token);
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(Number(refused.headers.get('retry-after'))).toBeLessThanOrEqual(3600);

    vi.setSystemTime(new Date(NOW.getTime() + 61 * 60 * 1000));
    expect((await ask('knee', token)).status).toBe(200);
  });

  it('counts on the account, so a fresh instance still refuses', async () => {
    const token = user('paid', { entitlement: { ...PADDLE, expiresAt: at(200) } });
    for (let i = 0; i < CONTENT_FETCHES_PER_HOUR; i++) await ask('knee', token);
    expect(store.docs.get('users/paid')?.contentFetch).toEqual({ windowStart: NOW.getTime(), count: CONTENT_FETCHES_PER_HOUR });

    forgetRecentRequests(); // a cold start
    expect((await ask('knee', token)).status).toBe(429);
  });

  it('refuses from memory without reading the database once it has seen the limit', async () => {
    const token = user('paid', { entitlement: { ...PADDLE, expiresAt: at(200) } });
    for (let i = 0; i < CONTENT_FETCHES_PER_HOUR; i++) await ask('knee', token);
    store.reads.length = 0;
    expect((await ask('knee', token)).status).toBe(429);
    expect(store.reads).toEqual([]);
  });

  it('bounds refusals too: a free account probing locked areas is cut off', async () => {
    const token = user('free', { freeArea: FREE_KNEE });
    for (let i = 0; i < CONTENT_FETCHES_PER_HOUR; i++) expect((await ask('hip', token)).status).toBe(403);
    expect((await ask('hip', token)).status).toBe(429);
    // Refusals are not written to the account: nothing was handed out.
    expect(store.writes).toEqual([]);
  });

  it('keeps one account\'s count away from another\'s', async () => {
    const a = user('a', { entitlement: { ...PADDLE, expiresAt: at(200) } });
    const b = user('b', { entitlement: { ...PADDLE, expiresAt: at(200) } });
    for (let i = 0; i < CONTENT_FETCHES_PER_HOUR; i++) await ask('knee', a);
    expect((await ask('knee', a)).status).toBe(429);
    expect((await ask('knee', b)).status).toBe(200);
  });

  it('still serves a paying student when the count cannot be written', async () => {
    const token = user('paid', { entitlement: { ...PADDLE, expiresAt: at(200) } });
    store.failWrites = true;
    expect((await ask('knee', token)).status).toBe(200);
  });

  it('ignores a stored count that makes no sense rather than locking the account out', async () => {
    const token = user('paid', {
      entitlement: { ...PADDLE, expiresAt: at(200) },
      contentFetch: { windowStart: NOW.getTime() + 10 * DAY, count: 9999 },
    });
    expect((await ask('knee', token)).status).toBe(200);
  });
});

describe('what it reads, writes and logs', () => {
  it('reads the account once, and the class only for a member', async () => {
    const solo = user('solo', { freeArea: FREE_KNEE });
    await ask('knee', solo);
    expect(store.reads).toEqual(['users/solo']);

    store.reads.length = 0;
    store.docs.set('cohorts/c1', { licensedUntil: at(50) });
    const member = user('member', { cohort: 'c1' });
    await ask('knee', member);
    expect(store.reads).toEqual(['users/member', 'cohorts/c1']);
  });

  it('writes nothing but its own count, and never touches the entitlement', async () => {
    const entitlement = { ...PADDLE, expiresAt: at(200) };
    const token = user('paid', { entitlement, freeArea: FREE_KNEE, displayName: 'Sam' });
    await ask('knee', token);
    expect(store.writes).toEqual(['users/paid']);
    const after = store.docs.get('users/paid')!;
    expect(after.entitlement).toEqual(entitlement);
    expect(after.freeArea).toBe(FREE_KNEE);
    expect(Object.keys(after).sort()).toEqual(['contentFetch', 'displayName', 'entitlement', 'freeArea']);
  });

  it('logs one line for a grant and one for a refusal', async () => {
    const info = vi.mocked(console.info);
    const token = user('free', { freeArea: FREE_KNEE });
    await ask('knee', token, { v: 'old-version' });
    expect(info.mock.calls.map((c) => String(c[0])).filter((l) => l.includes('served knee'))).toHaveLength(1);
    expect(String(info.mock.calls.at(-1)?.[0])).toMatch(/to free, tier free\/none, lease to .*1 of 30 this hour/);
    expect(String(info.mock.calls.at(-1)?.[0])).toContain('asked for old-version');

    await ask('hip', token);
    expect(String(info.mock.calls.at(-1)?.[0])).toContain('refused hip to free (tier free, free area knee)');
  });

  it('never logs the token', async () => {
    const token = user('free', { freeArea: FREE_KNEE });
    await ask('knee', token);
    await ask('hip', token);
    await ask('knee', 'a-bad-token');
    const logged = [console.info, console.warn, console.error].flatMap((fn) => vi.mocked(fn).mock.calls.flat().map(String)).join('\n');
    expect(logged).not.toContain(token);
    expect(logged).not.toContain('a-bad-token');
  });
});
