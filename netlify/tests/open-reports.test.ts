import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The open-reports endpoint: only the key opens it, and what it gives back
 * carries no reporter. NOT UNDER netlify/functions, deliberately: see
 * paddle-webhook.test.ts.
 */

const rows = vi.hoisted(() => [
  { id: 'a', data: { createdAt: '2026-11-22T09:49:00Z', structureId: 'cuboid', userId: 'student-1', reason: 'picture' } },
  { id: 'b', data: { createdAt: '2026-11-21T10:00:00Z', structureId: 'gluteus-minimus', userId: 'student-2', reason: 'should-count', resolvedAt: '2026-11-21T12:00:00Z' } },
]);

vi.mock('../functions/lib/firebaseAdmin', () => ({
  adminDb: () => ({
    collection: () => ({
      where: () => ({
        orderBy: () => ({
          get: async () => ({
            docs: rows.map((r) => ({ id: r.id, data: () => r.data, get: (field: string) => (r.data as Record<string, unknown>)[field] })),
          }),
        }),
      }),
    }),
  }),
}));

import handler, { keyMatches } from '../functions/open-reports';

const KEY = 'k'.repeat(40);
const call = (key?: string) => handler(new Request('https://locusmsk.co.uk/.netlify/functions/open-reports', { headers: key ? { 'x-reports-key': key } : {} }));

afterEach(() => {
  delete process.env.OPEN_REPORTS_KEY;
});

describe('open-reports', () => {
  it('does not exist until the key is set', async () => {
    expect((await call(KEY)).status).toBe(404);
  });

  it('refuses a missing or wrong key', async () => {
    process.env.OPEN_REPORTS_KEY = KEY;
    expect((await call()).status).toBe(404);
    expect((await call('x'.repeat(40))).status).toBe(404);
  });

  it('refuses a key too short to be secret', () => {
    expect(keyMatches('short', 'short')).toBe(false);
  });

  it('gives the open reports, without who sent them', async () => {
    process.env.OPEN_REPORTS_KEY = KEY;
    const response = await call(KEY);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.count).toBe(1);
    expect(body.reports[0]).toMatchObject({ id: 'a', structureId: 'cuboid' });
    expect(body.reports[0]).not.toHaveProperty('userId');
  });
});
