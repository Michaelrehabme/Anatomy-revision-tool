import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The access-code function as a whole, against a database that is a Map and
 * an identity service that is a lookup table. Who gets a code is decided in
 * src/features/billing/lib/accessCode.ts and tested there; what is checked
 * here is that the function asks, writes all three documents or none, and
 * counts.
 *
 * Nothing here reaches Google or Firebase. NOT UNDER netlify/functions,
 * deliberately: see paddle-webhook.test.ts.
 */

type Row = Record<string, unknown>;

const store = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  failWrites: false,
}));

vi.mock('firebase-admin/app', () => ({
  initializeApp: () => ({}),
  cert: () => ({}),
  getApps: () => [{}],
}));

vi.mock('firebase-admin/firestore', () => {
  const db = {
    doc: (path: string) => ({ path }),
    // All or nothing, as a transaction is: the writes land only if the body
    // finishes, and only together.
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const pending: [string, Record<string, unknown>, { merge?: boolean; mergeFields?: string[] } | undefined][] = [];
      const result = await fn({
        get: async (r: { path: string }) => ({ exists: store.docs.has(r.path), data: () => store.docs.get(r.path) }),
        set: (r: { path: string }, data: Record<string, unknown>, options?: { merge?: boolean; mergeFields?: string[] }) => {
          pending.push([r.path, data, options]);
        },
      });
      if (store.failWrites && pending.length > 0) throw new Error('UNAVAILABLE: the write did not land');
      for (const [path, data, options] of pending) {
        const before = options?.merge || options?.mergeFields ? store.docs.get(path) ?? {} : {};
        const next: Record<string, unknown> = { ...before };
        for (const [key, value] of Object.entries(data)) {
          const increment = (value as { increment?: number } | null)?.increment;
          next[key] = typeof increment === 'number' ? ((before[key] as number | undefined) ?? 0) + increment : value;
        }
        store.docs.set(path, next);
      }
      return result;
    },
  };
  return {
    getFirestore: () => db,
    FieldValue: { serverTimestamp: () => 'SERVER_TIME', increment: (n: number) => ({ increment: n }) },
  };
});

import handler from '../functions/redeem-code';

const NOW = new Date('2026-10-12T12:00:00.000Z');
const UNTIL = '2027-01-01T00:00:00.000Z';
const COUNTER = 'accessCodes/LOCUSMSK27';

/** token -> the account Google would say it belongs to. */
const ACCOUNTS: Record<string, Row> = {
  'token-student': { localId: 'student', emailVerified: true, providerUserInfo: [{ providerId: 'password' }] },
  'token-second': { localId: 'second', emailVerified: true, providerUserInfo: [{ providerId: 'google.com' }] },
  'token-unconfirmed': { localId: 'unconfirmed', emailVerified: false, providerUserInfo: [{ providerId: 'password' }] },
  'token-guest': { localId: 'guest', providerUserInfo: [] },
};

function ask(code: unknown, token: string | null = 'token-student', method = 'POST'): Promise<Response> {
  return handler(
    new Request('https://locusmsk.co.uk/.netlify/functions/redeem-code', {
      method,
      headers: token ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' } : {},
      ...(method === 'POST' ? { body: typeof code === 'string' && code.startsWith('{') ? code : JSON.stringify({ code }) } : {}),
    }),
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  store.docs.clear();
  store.failWrites = false;
  store.docs.set('users/student', { displayName: 'Sam', cohort: null });
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'web-api-key');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: { body: string }) => {
      const found = ACCOUNTS[(JSON.parse(init.body) as { idToken: string }).idToken];
      return found
        ? new Response(JSON.stringify({ users: [found] }), { status: 200 })
        : new Response(JSON.stringify({ error: { message: 'INVALID_ID_TOKEN' } }), { status: 400 });
    }),
  );
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('redeeming LocusMSK27', () => {
  it('gives the account full access until 1 January 2027, counts it, and records who', async () => {
    const response = await ask('LocusMSK27');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, already: false, accessUntil: UNTIL });

    expect(store.docs.get('users/student')).toEqual({
      displayName: 'Sam',
      cohort: null,
      entitlement: { tier: 'individual', source: 'complimentary', expiresAt: UNTIL, accessCode: 'LOCUSMSK27', teaching: false },
      updatedAt: 'SERVER_TIME',
    });
    expect(store.docs.get(COUNTER)?.redeemed).toBe(1);
    expect(store.docs.get(`${COUNTER}/redemptions/student`)).toEqual({ uid: 'student', redeemedAt: 'SERVER_TIME' });
  });

  it('counts each account once, however often it asks', async () => {
    await ask('LOCUSMSK27');
    const again = await ask('locusmsk27');
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ ok: true, already: true, accessUntil: UNTIL });
    expect(store.docs.get(COUNTER)?.redeemed).toBe(1);

    expect((await ask('LOCUSMSK27', 'token-second')).status).toBe(200);
    expect(store.docs.get(COUNTER)?.redeemed).toBe(2);
    // An account with no profile yet is given one, holding only this.
    expect(store.docs.get('users/second')?.entitlement).toMatchObject({ accessCode: 'LOCUSMSK27', expiresAt: UNTIL });
  });

  it('replaces a lapsed subscription whole, keeping only what the webhook keeps', async () => {
    store.docs.set('users/student', {
      displayName: 'Sam',
      entitlement: {
        tier: 'individual', source: 'paddle', expiresAt: '2026-09-01T00:00:00.000Z', externalId: 'sub_1',
        interval: 'month', cancelAt: '2026-09-01T00:00:00.000Z', eventAt: '2026-08-20T00:00:00.000Z', customerId: 'ctm_1',
      },
    });
    expect((await ask('LOCUSMSK27')).status).toBe(200);
    expect(store.docs.get('users/student')?.entitlement).toEqual({
      tier: 'individual', source: 'complimentary', expiresAt: UNTIL, accessCode: 'LOCUSMSK27', teaching: false,
      eventAt: '2026-08-20T00:00:00.000Z', customerId: 'ctm_1',
    });
  });

  it('refuses an account once every place is taken, and changes nothing', async () => {
    store.docs.set(COUNTER, { redeemed: 101 });
    const response = await ask('LOCUSMSK27');
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ ok: false, reason: 'all-used' });
    expect(store.docs.get('users/student')).toEqual({ displayName: 'Sam', cohort: null });
    expect(store.docs.get(COUNTER)).toEqual({ redeemed: 101 });
  });

  it('refuses an account that already has full access, and leaves it exactly as it was', async () => {
    const paid = { tier: 'individual', source: 'paddle', expiresAt: '2026-11-09T00:00:00.000Z', externalId: 'sub_1' };
    store.docs.set('users/student', { entitlement: paid });
    const response = await ask('LOCUSMSK27');
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ ok: false, reason: 'has-access' });
    expect(store.docs.get('users/student')).toEqual({ entitlement: paid });
    expect(store.docs.has(COUNTER)).toBe(false);
  });

  it('refuses a guest and an unconfirmed address', async () => {
    const guest = await ask('LOCUSMSK27', 'token-guest');
    expect([guest.status, await guest.json()]).toEqual([403, { ok: false, reason: 'guest' }]);
    const unconfirmed = await ask('LOCUSMSK27', 'token-unconfirmed');
    expect([unconfirmed.status, await unconfirmed.json()]).toEqual([403, { ok: false, reason: 'unconfirmed' }]);
    expect(store.docs.has(COUNTER)).toBe(false);
  });

  it('refuses once the code has ended', async () => {
    vi.setSystemTime(new Date('2027-01-01T00:00:00.000Z'));
    const response = await ask('LOCUSMSK27');
    expect([response.status, await response.json()]).toEqual([410, { ok: false, reason: 'ended' }]);
    expect(store.docs.get('users/student')).toEqual({ displayName: 'Sam', cohort: null });
  });
});

describe('what it turns away before the database', () => {
  it('a code that does not exist', async () => {
    for (const code of ['LOCUSMSK28', '', null, 27]) {
      const response = await ask(code);
      expect([response.status, await response.json()]).toEqual([404, { ok: false, reason: 'unknown-code' }]);
    }
    expect(store.docs.has(COUNTER)).toBe(false);
  });

  it('no token, a token Google does not vouch for, anything but POST, and a body that is not JSON', async () => {
    expect((await ask('LOCUSMSK27', null)).status).toBe(401);
    expect((await ask('LOCUSMSK27', 'token-forged')).status).toBe(401);
    expect((await ask('LOCUSMSK27', 'token-student', 'GET')).status).toBe(405);
    expect((await ask('{not json')).status).toBe(400);
    expect(store.docs.get('users/student')).toEqual({ displayName: 'Sam', cohort: null });
  });
});

describe('when the write does not land', () => {
  it('says so, and neither grants nor counts', async () => {
    store.failWrites = true;
    expect((await ask('LOCUSMSK27')).status).toBe(503);
    expect(store.docs.get('users/student')).toEqual({ displayName: 'Sam', cohort: null });
    expect(store.docs.has(COUNTER)).toBe(false);
    expect(store.docs.has(`${COUNTER}/redemptions/student`)).toBe(false);
  });
});
