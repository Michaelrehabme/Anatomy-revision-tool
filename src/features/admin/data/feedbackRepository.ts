import { collection, doc, getDocs, limit, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { getDb } from '../../anatomy-revision/data/firebase';
import {
  CLIENT_ERRORS,
  FUNNEL_EVENTS,
  QUESTION_REPORTS,
  type ClientError,
  type FunnelEvent,
  type QuestionReport,
} from '../../feedback/data/telemetry';

/**
 * Admin reads of what the app reported about itself (feedback/data/telemetry.ts).
 * firestore.rules keeps other people's rows to admins; these are plain reads.
 *
 * CAPPED, NOT PAGED. Each read is newest-first with a limit, which is right
 * while the numbers are small enough to read as a list. The funnel is the one
 * that will outgrow it: past FUNNEL_LIMIT events in a period the counts are of
 * the newest events only, and the page says so.
 */

export const REPORT_LIMIT = 200;
export const ERROR_LIMIT = 100;
export const FUNNEL_LIMIT = 5000;

export type StoredReport = QuestionReport & { id: string };
export type StoredError = ClientError & { id: string };

export async function listQuestionReports(): Promise<StoredReport[]> {
  const snapshot = await getDocs(query(collection(getDb(), QUESTION_REPORTS), orderBy('createdAt', 'desc'), limit(REPORT_LIMIT)));
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as QuestionReport) }));
}

export async function resolveQuestionReport(id: string): Promise<string> {
  const resolvedAt = new Date().toISOString();
  await updateDoc(doc(getDb(), QUESTION_REPORTS, id), { resolvedAt });
  return resolvedAt;
}

export async function listClientErrors(): Promise<StoredError[]> {
  const snapshot = await getDocs(query(collection(getDb(), CLIENT_ERRORS), orderBy('createdAt', 'desc'), limit(ERROR_LIMIT)));
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as ClientError) }));
}

/** Funnel events on or after `sinceIso`, newest first. */
export async function listFunnelEvents(sinceIso: string): Promise<FunnelEvent[]> {
  const snapshot = await getDocs(
    query(collection(getDb(), FUNNEL_EVENTS), where('createdAt', '>=', sinceIso), orderBy('createdAt', 'desc'), limit(FUNNEL_LIMIT)),
  );
  return snapshot.docs.map((d) => d.data() as FunnelEvent);
}
