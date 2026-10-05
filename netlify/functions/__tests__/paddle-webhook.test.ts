import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';

/**
 * The webhook as a whole, against a database that is a Map.
 *
 * The decisions are tested as pure functions beside
 * src/features/billing/lib/paddleWebhook.ts. What only shows up here is the
 * plumbing those decisions sit in: which account an event reaches, whether a
 * second delivery writes twice, whether a deleted account comes back, and
 * whether the dry run really touches nothing. Those are the ways this file
 * takes access from somebody who paid, or leaves it with somebody who has
 * their money back.
 *
 * The payloads are Paddle's documented examples with our ids in them:
 *   https://developer.paddle.com/webhooks/adjustments/adjustment-created
 *   https://developer.paddle.com/webhooks/adjustments/adjustment-updated
 *   https://developer.paddle.com/webhooks/subscriptions/subscription-past-due
 *   https://developer.paddle.com/webhooks/subscriptions/subscription-canceled
 * (read 5 October 2026). Nothing here reaches Paddle or Firebase.
 */

type Row = Record<string, unknown>;

const store = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  /** Every admin SDK call that would have touched the network. */
  touched: [] as string[],
  failWrites: false,
}));

vi.mock('firebase-admin/app', () => ({
  initializeApp: () => ({}),
  cert: () => ({}),
  getApps: () => [{}],
}));

vi.mock('firebase-admin/firestore', () => {
  const ref = (path: string) => ({
    path,
    set: async (data: Record<string, unknown>) => {
      store.touched.push(`set ${path}`);
      store.docs.set(path, data);
    },
  });
  const snap = (path: string) => ({
    exists: store.docs.has(path),
    data: () => store.docs.get(path),
  });
  const db = {
    doc: (path: string) => ref(path),
    collection: (name: string) => ({
      where: (field: string, _op: string, value: unknown) => ({
        limit: (n: number) => ({
          get: async () => {
            store.touched.push(`query ${name} ${field}`);
            const [outer, inner] = field.split('.');
            const docs = [...store.docs.entries()]
              .filter(([path, data]) => path.startsWith(`${name}/`) && (data[outer] as Record<string, unknown> | undefined)?.[inner] === value)
              .slice(0, n)
              .map(([path, data]) => ({ id: path.slice(name.length + 1), data: () => data }));
            return { docs, size: docs.length, empty: docs.length === 0 };
          },
        }),
      }),
    }),
    runTransaction: async (fn: (tx: unknown) => Promise<void>) => {
      store.touched.push('transaction');
      await fn({
        get: async (r: { path: string }) => snap(r.path),
        update: (r: { path: string }, data: Record<string, unknown>) => {
          if (store.failWrites) throw new Error('UNAVAILABLE: the write did not land');
          if (!store.docs.has(r.path)) throw new Error('NOT_FOUND');
          store.docs.set(r.path, { ...store.docs.get(r.path), ...data });
        },
      });
    },
  };
  return { getFirestore: () => db, FieldValue: { serverTimestamp: () => 'SERVER_TIME' } };
});

import handler from '../paddle-webhook';

const SECRET = 'pdl_ntfset_test_secret';
const SUB = 'sub_01hvccbx32q2gb40sqx7n42430';
const TXN = 'txn_01hvcc93znj3mpqt1tenkjb04y';
const ADJ = 'adj_01hvgf2s84dr6reszzg29zbvcm';
const CTM = 'ctm_01hv6y1jedq4p1n0yqn5ba3ky4';
const UID = 'student-1';

/** A year bought on 1 October 2026 — inside the 14 days /refunds promises. */
const PAID: Row = {
  tier: 'individual',
  source: 'paddle',
  expiresAt: '2027-10-01T09:00:00.000000Z',
  externalId: SUB,
  interval: 'year',
  startedAt: '2026-10-01T09:00:00.000000Z',
  eventAt: '2026-10-01T09:00:05.000000Z',
  customerId: CTM,
  consent: { coolingOffWaived: true, agreedAt: '2026-10-01T08:59:00.000Z', wordingVersion: 'v1' },
};

/** Paddle's adjustment.updated example, as a full refund that has been approved. */
function adjustment(over: Row = {}, envelope: Row = {}): Row {
  return {
    event_id: 'evt_01hvgfdfepj8eaevsjh5g4swbe',
    event_type: 'adjustment.updated',
    occurred_at: '2026-10-05T08:54:10.646377Z',
    notification_id: 'ntf_01hvgfdfhwncqrrjz1nz5eky9a',
    ...envelope,
    data: {
      id: ADJ,
      items: [
        {
          id: 'adjitm_01hvgf2s84dr6reszzg2gx70gj',
          type: 'full',
          amount: '3900',
          totals: { tax: '650', total: '3900', subtotal: '3250' },
          item_id: 'txnitm_01hvcc94b7qgz60qmrqmbm19zw',
          proration: null,
        },
      ],
      action: 'refund',
      type: 'full',
      reason: 'requested within 14 days',
      status: 'approved',
      totals: { fee: '195', tax: '650', total: '3900', earnings: '3055', subtotal: '3250', currency_code: 'GBP', retained_fee: '0' },
      created_at: '2026-10-05T08:48:20.239695Z',
      updated_at: '2026-10-05T08:54:10.646377Z',
      customer_id: CTM,
      currency_code: 'GBP',
      payout_totals: null,
      transaction_id: TXN,
      subscription_id: SUB,
      credit_applied_to_balance: null,
      tax_rates_used: null,
      ...over,
    },
  };
}

function post(body: Row): Request {
  const raw = JSON.stringify(body);
  const ts = Math.floor(Date.now() / 1000);
  const h1 = createHmac('sha256', SECRET).update(`${ts}:${raw}`).digest('hex');
  return new Request('https://example.test/.netlify/functions/paddle-webhook', {
    method: 'POST',
    headers: { 'paddle-signature': `ts=${ts};h1=${h1}` },
    body: raw,
  });
}

/** What Paddle's transaction list answers, newest first. */
function paddleAnswers(transactions: Row[] | { status: number } | 'unreachable') {
  const fetchMock = vi.fn<(url: string | URL | Request, init?: RequestInit) => Promise<Response>>(async () => {
    if (transactions === 'unreachable') throw new Error('fetch failed');
    if (!Array.isArray(transactions)) return new Response('no', { status: transactions.status });
    return new Response(JSON.stringify({ data: transactions, meta: { pagination: { per_page: 30, has_more: false } } }), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const ONLY_PAYMENT = [{ id: TXN, status: 'completed', origin: 'web', subscription_id: SUB, billed_at: '2026-10-01T09:00:00.000000Z' }];

const user = () => store.docs.get(`users/${UID}`);
const entitlement = () => user()?.entitlement as Row | undefined;
const failures = () => [...store.docs.entries()].filter(([path]) => path.startsWith('billingFailures/')).map(([, row]) => row);

beforeEach(() => {
  store.docs.clear();
  store.touched.length = 0;
  store.failWrites = false;
  process.env.PADDLE_WEBHOOK_SECRET = SECRET;
  process.env.PADDLE_API_KEY = 'pdl_sdbx_apikey_test';
  delete process.env.PADDLE_WEBHOOK_DRY_RUN;
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('a refund', () => {
  beforeEach(() => {
    store.docs.set(`users/${UID}`, { displayName: 'Sam', entitlement: { ...PAID } });
  });

  it('approved, in full, for the latest payment: access ends at the time of the event', async () => {
    const paddle = paddleAnswers(ONLY_PAYMENT);
    const response = await handler(post(adjustment()));
    expect(response.status).toBe(200);
    expect(entitlement()).toEqual({
      ...PAID,
      expiresAt: '2026-10-05T08:54:10.646377Z',
      eventAt: '2026-10-05T08:54:10.646377Z',
      refundedAt: '2026-10-05T08:54:10.646377Z',
    });
    // The rest of the account is untouched, and nobody needs to act.
    expect(user()?.displayName).toBe('Sam');
    expect(failures()).toEqual([]);

    // Paddle was ASKED, read only, on the sandbox host this key belongs to.
    expect(paddle).toHaveBeenCalledTimes(1);
    const [url, init] = paddle.mock.calls[0];
    expect(String(url)).toMatch(/^https:\/\/sandbox-api\.paddle\.com\/transactions\?/);
    expect(new URL(String(url)).searchParams.get('subscription_id')).toBe(SUB);
    expect(init?.method).toBe('GET');
    expect(init?.body).toBeUndefined();
  });

  it('approved at creation is read the same way as approved later', async () => {
    paddleAnswers(ONLY_PAYMENT);
    await handler(post(adjustment({}, { event_type: 'adjustment.created' })));
    expect(entitlement()?.expiresAt).toBe('2026-10-05T08:54:10.646377Z');
  });

  it('partial: nothing changes, and Paddle is not asked', async () => {
    const paddle = paddleAnswers(ONLY_PAYMENT);
    const response = await handler(post(adjustment({ type: 'partial' })));
    expect(response.status).toBe(200);
    expect(entitlement()).toEqual(PAID);
    expect(paddle).not.toHaveBeenCalled();
    expect(store.touched).toEqual([]);
  });

  it('pending approval: nothing changes', async () => {
    paddleAnswers(ONLY_PAYMENT);
    // Paddle's adjustment.created example: "most refunds for live accounts
    // require Paddle approval and are created as pending_approval".
    await handler(post(adjustment({ status: 'pending_approval' }, { event_type: 'adjustment.created' })));
    expect(entitlement()).toEqual(PAID);
    expect(store.touched).toEqual([]);
  });

  it('rejected, or reversed: nothing changes', async () => {
    paddleAnswers(ONLY_PAYMENT);
    await handler(post(adjustment({ status: 'rejected' })));
    await handler(post(adjustment({ status: 'reversed' })));
    expect(entitlement()).toEqual(PAID);
    expect(store.touched).toEqual([]);
  });

  it('a credit is not a refund', async () => {
    paddleAnswers(ONLY_PAYMENT);
    await handler(post(adjustment({ action: 'credit' })));
    expect(entitlement()).toEqual(PAID);
  });

  it('delivered twice: the second delivery changes nothing', async () => {
    const paddle = paddleAnswers(ONLY_PAYMENT);
    await handler(post(adjustment()));
    const after = structuredClone(entitlement());
    const response = await handler(post(adjustment()));
    expect(response.status).toBe(200);
    expect(entitlement()).toEqual(after);
    // Access had already ended, so the second one stops before asking Paddle.
    expect(paddle).toHaveBeenCalledTimes(1);
    expect(failures()).toEqual([]);
  });

  it('older than what is stored: a renewal after the refund is not undone', async () => {
    paddleAnswers(ONLY_PAYMENT);
    const renewed = { ...PAID, eventAt: '2026-10-06T00:00:00.000000Z' };
    store.docs.set(`users/${UID}`, { entitlement: renewed });
    const response = await handler(post(adjustment()));
    expect(response.status).toBe(200);
    expect(entitlement()).toEqual(renewed);
    expect(failures()).toEqual([]);
  });

  it('and a subscription event that happened BEFORE the refund cannot bring access back', async () => {
    paddleAnswers(ONLY_PAYMENT);
    await handler(post(adjustment()));
    await handler(post({
      event_id: 'evt_late',
      event_type: 'subscription.updated',
      occurred_at: '2026-10-02T10:00:00.000000Z',
      data: {
        id: SUB,
        status: 'active',
        customer_id: CTM,
        current_billing_period: { starts_at: '2026-10-01T09:00:00.000000Z', ends_at: '2027-10-01T09:00:00.000000Z' },
        custom_data: { uid: UID },
      },
    }));
    expect(entitlement()?.expiresAt).toBe('2026-10-05T08:54:10.646377Z');
  });

  it('while a later one — a renewal that was paid — grants again', async () => {
    paddleAnswers(ONLY_PAYMENT);
    await handler(post(adjustment()));
    await handler(post({
      event_id: 'evt_renewed',
      event_type: 'subscription.updated',
      occurred_at: '2027-10-01T09:00:10.000000Z',
      data: {
        id: SUB,
        status: 'active',
        customer_id: CTM,
        current_billing_period: { starts_at: '2027-10-01T09:00:00.000000Z', ends_at: '2028-10-01T09:00:00.000000Z' },
        custom_data: { uid: UID },
      },
    }));
    expect(entitlement()?.expiresAt).toBe('2028-10-01T09:00:00.000000Z');
    expect(entitlement()?.refundedAt).toBeUndefined();
  });

  it('for an earlier payment, not the latest: access stays, and the owner is told', async () => {
    paddleAnswers([
      { id: 'txn_renewal', status: 'completed', origin: 'subscription_recurring', subscription_id: SUB, billed_at: '2026-11-01T09:00:00.000000Z' },
      ...ONLY_PAYMENT,
    ]);
    const response = await handler(post(adjustment()));
    expect(response.status).toBe(200);
    expect(entitlement()).toEqual(PAID);
    expect(failures()).toHaveLength(1);
    expect(failures()[0]).toMatchObject({ uid: UID, subscriptionId: SUB, transactionId: TXN, adjustmentId: ADJ, eventType: 'adjustment.updated' });
    expect(String(failures()[0].error)).toMatch(/EARLIER payment/);
  });

  it('a card change after the payment does not make the payment an earlier one', async () => {
    paddleAnswers([
      { id: 'txn_card', status: 'completed', origin: 'subscription_payment_method_change', subscription_id: SUB, billed_at: '2026-10-03T09:00:00.000000Z' },
      ...ONLY_PAYMENT,
    ]);
    await handler(post(adjustment()));
    expect(entitlement()?.refundedAt).toBe('2026-10-05T08:54:10.646377Z');
  });

  it.each([
    ['the key may not read transactions', { status: 403 }],
    ['the refunded payment is not in the answer', []],
  ] as const)('when it cannot be confirmed as the latest (%s): access stays, and the owner is told', async (_why, answer) => {
    paddleAnswers(answer as Row[] | { status: number });
    const response = await handler(post(adjustment()));
    // 200: a retry would get the same answer.
    expect(response.status).toBe(200);
    expect(entitlement()).toEqual(PAID);
    expect(failures()).toHaveLength(1);
    expect(String(failures()[0].error)).toMatch(/could not be confirmed as the latest payment/);
  });

  it('with no API key at all: access stays, the owner is told, and nothing is fetched', async () => {
    delete process.env.PADDLE_API_KEY;
    const paddle = paddleAnswers(ONLY_PAYMENT);
    await handler(post(adjustment()));
    expect(paddle).not.toHaveBeenCalled();
    expect(entitlement()).toEqual(PAID);
    expect(failures()).toHaveLength(1);
  });

  it.each([['unreachable', 'unreachable'], ['rate limited', { status: 429 }], ['failing', { status: 503 }]] as const)(
    'when Paddle is %s: access stays and the event is retried',
    async (_why, answer) => {
      paddleAnswers(answer as 'unreachable' | { status: number });
      const response = await handler(post(adjustment()));
      expect(response.status).toBe(500);
      expect(entitlement()).toEqual(PAID);
      expect(failures()).toHaveLength(1);
    },
  );

  it('when the write fails: access stays, it is recorded, and the event is retried', async () => {
    paddleAnswers(ONLY_PAYMENT);
    store.failWrites = true;
    const response = await handler(post(adjustment()));
    expect(response.status).toBe(500);
    expect(entitlement()).toEqual(PAID);
    expect(String(failures()[0].error)).toMatch(/ending access failed/);
  });

  it('a live key asks the live API', async () => {
    process.env.PADDLE_API_KEY = 'pdl_live_apikey_test';
    const paddle = paddleAnswers(ONLY_PAYMENT);
    await handler(post(adjustment()));
    expect(String(paddle.mock.calls[0][0])).toMatch(/^https:\/\/api\.paddle\.com\/transactions\?/);
  });

  it('a delayed-start plan refunded before it began no longer says it is about to start', async () => {
    paddleAnswers(ONLY_PAYMENT);
    store.docs.set(`users/${UID}`, { entitlement: { ...PAID, startsAt: '2026-10-15T09:00:00.000000Z' } });
    await handler(post(adjustment()));
    expect(entitlement()?.startsAt).toBeUndefined();
    expect(entitlement()?.expiresAt).toBe('2026-10-05T08:54:10.646377Z');
    // The consent the refund turned on is still there.
    expect(entitlement()?.consent).toEqual(PAID.consent);
  });
});

describe('a refund that reaches nobody, or the wrong thing', () => {
  it('for a deleted account: the account is not recreated', async () => {
    const paddle = paddleAnswers(ONLY_PAYMENT);
    const response = await handler(post(adjustment()));
    expect(response.status).toBe(200);
    expect([...store.docs.keys()].filter((path) => path.startsWith('users/'))).toEqual([]);
    expect(paddle).not.toHaveBeenCalled();
    // Recorded, with Paddle's ids and nobody's personal data.
    expect(failures()).toHaveLength(1);
    expect(failures()[0]).toMatchObject({ uid: 'unknown', subscriptionId: SUB });
    expect(String(failures()[0].error)).toMatch(/no account holds this subscription/);
  });

  it('for an account since given complimentary access: that access is not ended', async () => {
    const paddle = paddleAnswers(ONLY_PAYMENT);
    // What `scripts/accountData.ts grant` leaves: merged INTO the map, so the
    // old subscription's id is still there beside the new source.
    const comped = { ...PAID, tier: 'individual', source: 'complimentary', expiresAt: null };
    store.docs.set(`users/${UID}`, { entitlement: comped });
    const response = await handler(post(adjustment()));
    expect(response.status).toBe(200);
    expect(entitlement()).toEqual(comped);
    expect(paddle).not.toHaveBeenCalled();
    expect(failures()).toEqual([]);
  });

  it('for an account now on a different subscription: untouched', async () => {
    paddleAnswers(ONLY_PAYMENT);
    store.docs.set(`users/${UID}`, { entitlement: { ...PAID, externalId: 'sub_another' } });
    await handler(post(adjustment()));
    expect((entitlement() as Row).externalId).toBe('sub_another');
    expect(entitlement()?.refundedAt).toBeUndefined();
  });

  it('when two accounts hold the subscription: neither is touched, and the owner is told', async () => {
    paddleAnswers(ONLY_PAYMENT);
    store.docs.set(`users/${UID}`, { entitlement: { ...PAID } });
    store.docs.set('users/student-2', { entitlement: { ...PAID } });
    await handler(post(adjustment()));
    expect(entitlement()).toEqual(PAID);
    expect((store.docs.get('users/student-2')?.entitlement as Row).expiresAt).toBe(PAID.expiresAt);
    expect(String(failures()[0].error)).toMatch(/more than one account/);
  });

  it('with no subscription on it: recorded, nothing guessed from the customer id', async () => {
    paddleAnswers(ONLY_PAYMENT);
    store.docs.set(`users/${UID}`, { entitlement: { ...PAID } });
    await handler(post(adjustment({ subscription_id: null })));
    expect(entitlement()).toEqual(PAID);
    expect(failures()).toHaveLength(1);
    expect(failures()[0]).toMatchObject({ uid: 'unknown', subscriptionId: null, customerId: CTM });
  });

  it('a chargeback changes nothing and is put in front of the owner', async () => {
    const paddle = paddleAnswers(ONLY_PAYMENT);
    store.docs.set(`users/${UID}`, { entitlement: { ...PAID } });
    const response = await handler(post(adjustment({ action: 'chargeback' })));
    expect(response.status).toBe(200);
    expect(entitlement()).toEqual(PAID);
    expect(paddle).not.toHaveBeenCalled();
    expect(failures()[0]).toMatchObject({ uid: UID, subscriptionId: SUB });
    expect(String(failures()[0].error)).toMatch(/chargeback/);
  });
});

describe('the dry run', () => {
  beforeEach(() => {
    process.env.PADDLE_WEBHOOK_DRY_RUN = '1';
    store.docs.set(`users/${UID}`, { entitlement: { ...PAID } });
  });

  it('a refund is verified and logged, and nothing is read, asked or written', async () => {
    const paddle = paddleAnswers(ONLY_PAYMENT);
    const response = await handler(post(adjustment()));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok (dry run)');
    expect(entitlement()).toEqual(PAID);
    expect(store.touched).toEqual([]);
    expect(paddle).not.toHaveBeenCalled();
  });

  it('a chargeback likewise', async () => {
    paddleAnswers(ONLY_PAYMENT);
    await handler(post(adjustment({ action: 'chargeback' })));
    expect(store.touched).toEqual([]);
  });

  it('a subscription event likewise, as before', async () => {
    const response = await handler(post({
      event_type: 'subscription.canceled',
      occurred_at: '2026-10-05T09:00:00.000000Z',
      data: { id: SUB, status: 'canceled', canceled_at: '2026-10-05T09:00:00.000000Z', current_billing_period: null, custom_data: { uid: UID } },
    }));
    expect(await response.text()).toBe('ok (dry run)');
    expect(entitlement()).toEqual(PAID);
    expect(store.touched).toEqual([]);
  });

  it('still refuses an unsigned request', async () => {
    const request = new Request('https://example.test/', { method: 'POST', body: JSON.stringify(adjustment()) });
    expect((await handler(request)).status).toBe(401);
  });
});

describe('a subscription event, unchanged by any of this', () => {
  const activated = (occurredAt: string, endsAt: string): Row => ({
    event_id: `evt_${occurredAt}`,
    event_type: 'subscription.updated',
    occurred_at: occurredAt,
    data: {
      id: SUB,
      status: 'active',
      customer_id: CTM,
      started_at: '2026-10-01T09:00:00.000000Z',
      billing_cycle: { interval: 'year', frequency: 1 },
      current_billing_period: { starts_at: '2026-10-01T09:00:00.000000Z', ends_at: endsAt },
      custom_data: { uid: UID, coolingOffWaived: true, consentAt: '2026-10-01T08:59:00.000Z', consentVersion: 'v1' },
    },
  });

  it('writes the entitlement onto an existing account', async () => {
    store.docs.set(`users/${UID}`, { displayName: 'Sam' });
    const response = await handler(post(activated('2026-10-01T09:00:05.000000Z', '2027-10-01T09:00:00.000000Z')));
    expect(response.status).toBe(200);
    expect(entitlement()).toEqual(PAID);
    expect(user()?.displayName).toBe('Sam');
  });

  it('never creates an account that is not there, and records it', async () => {
    const response = await handler(post(activated('2026-10-01T09:00:05.000000Z', '2027-10-01T09:00:00.000000Z')));
    expect(await response.text()).toBe('ok (no account)');
    expect(user()).toBeUndefined();
    expect(failures()).toHaveLength(1);
  });

  it('skips an event older than the one stored', async () => {
    store.docs.set(`users/${UID}`, { entitlement: { ...PAID, eventAt: '2026-10-09T00:00:00.000000Z' } });
    await handler(post(activated('2026-10-08T00:00:00.000000Z', '2099-01-01T00:00:00.000000Z')));
    expect(entitlement()?.expiresAt).toBe(PAID.expiresAt);
  });

  it('answers 500 and records it when the write fails', async () => {
    store.docs.set(`users/${UID}`, { displayName: 'Sam' });
    store.failWrites = true;
    const response = await handler(post(activated('2026-10-01T09:00:05.000000Z', '2027-10-01T09:00:00.000000Z')));
    expect(response.status).toBe(500);
    expect(failures()[0]).toMatchObject({ uid: UID, eventType: 'subscription.updated' });
  });

  it('refuses anything but a POST', async () => {
    expect((await handler(new Request('https://example.test/', { method: 'GET' }))).status).toBe(405);
  });
});
