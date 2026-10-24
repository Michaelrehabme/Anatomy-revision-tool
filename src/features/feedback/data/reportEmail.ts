import { REPORT_REASONS, type QuestionReport } from './rows';

/**
 * The email the owner gets for each question a student reports (owner, 24
 * Oct 2026: "then I don't have to check in admin mode for any of the
 * issues"). Sent by netlify/functions/report-emails.ts; built here, with no
 * network, so the wording is tested.
 *
 * Plain text, as the reminders are. Everything in it is what the report row
 * holds and the admin page already shows; the student is named by uid, not
 * by address, because the row holds no address.
 */

export const ADMIN_FEEDBACK_URL = 'https://locusmsk.co.uk/admin/feedback';

export function reasonLabel(reason: string): string {
  return REPORT_REASONS.find((r) => r.id === reason)?.label ?? reason;
}

export function reportEmail(report: QuestionReport): { subject: string; text: string } {
  const reason = reasonLabel(report.reason);
  const note = report.note.trim();
  const subject = `Report: ${report.structureId} — ${reason}`;
  const text = [
    reason,
    ...(note ? ['', `"${note}"`] : []),
    '',
    `Structure: ${report.structureId}`,
    `Area: ${report.area ?? '—'}`,
    `Question: ${report.questionType} · ${report.promptKind}`,
    `Question id: ${report.questionId}`,
    `Reported: ${report.createdAt}`,
    `Build: ${report.build}`,
    `Student: ${report.userId}`,
    '',
    `Mark it resolved: ${ADMIN_FEEDBACK_URL}`,
  ]
    .filter((line, i) => line !== '' || i > 1)
    .join('\n');
  return { subject, text };
}
