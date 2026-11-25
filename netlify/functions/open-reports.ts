import { timingSafeEqual } from 'node:crypto';
import { adminDb } from './lib/firebaseAdmin';
import { QUESTION_REPORTS, type QuestionReport } from '../../src/features/feedback/data/rows';

/**
 * The open question reports, for the owner's daily 8 AM check (owner, 22 Nov
 * 2026: "when an error is reported can i get it to go straight to you and you
 * can begin fixing it"). A scheduled Claude task reads this each morning,
 * drafts fixes and sends previews for approval. Nothing here changes data.
 *
 * WHO MAY READ IT. Only a caller holding OPEN_REPORTS_KEY, sent as the
 * x-reports-key header. Unset, the endpoint answers 404 as if it did not
 * exist, so a deploy without the key exposes nothing.
 *
 * WHAT IT GIVES. The reports' own fields, as /admin/feedback shows them,
 * WITHOUT the reporter's uid: the check needs the question, not the student.
 *
 * REQUIRED ENVIRONMENT (set in Netlify, never committed):
 *   FIREBASE_SERVICE_ACCOUNT  already set for the other functions
 *   OPEN_REPORTS_KEY          a long random string, also held by the check
 */

/** How far back to look; a report older than this is on /admin/feedback. */
export const LOOKBACK_DAYS = 30;
const MIN_KEY_LENGTH = 32;

export function keyMatches(given: string | null, expected: string | undefined): boolean {
  if (!expected || expected.length < MIN_KEY_LENGTH || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export default async function handler(request: Request): Promise<Response> {
  const expected = process.env.OPEN_REPORTS_KEY;
  if (!expected) return new Response('Not found', { status: 404 });
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  if (!keyMatches(request.headers.get('x-reports-key'), expected)) return new Response('Not found', { status: 404 });

  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();
  const snapshot = await adminDb().collection(QUESTION_REPORTS).where('createdAt', '>=', since).orderBy('createdAt', 'desc').get();
  const reports = snapshot.docs
    .filter((d) => !d.get('resolvedAt'))
    .map((d) => {
      const report: Partial<QuestionReport> = { ...(d.data() as QuestionReport) };
      delete report.userId;
      return { id: d.id, ...report };
    });
  return json({ since, count: reports.length, reports });
}
