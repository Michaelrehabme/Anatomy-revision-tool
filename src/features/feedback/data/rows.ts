import type { PromptKind, QuestionType } from '../../anatomy-revision/types/question';

/**
 * The rows the app writes about itself, and nothing that needs a browser or a
 * database to build one: names, limits, shapes and the functions that make
 * each row. Kept apart from data/telemetry.ts, which does the writing, so that
 * rules-tests/ can hold firestore.rules to exactly what the client sends.
 */

export const QUESTION_REPORTS = 'questionReports';
export const CLIENT_ERRORS = 'clientErrors';
export const FUNNEL_EVENTS = 'funnelEvents';

/** The limits firestore.rules enforces; kept here so the client truncates rather than being refused. */
export const NOTE_MAX = 1000;
export const MESSAGE_MAX = 500;
export const STACK_MAX = 4000;
export const PATH_MAX = 200;
export const USER_AGENT_MAX = 300;
export const SOURCE_MAX = 60;

export const REPORT_REASONS = [
  { id: 'wrong-answer', label: 'The answer marked right is wrong' },
  { id: 'my-answer-right', label: 'My answer should have counted' },
  { id: 'picture', label: 'The picture is unclear or shows the wrong thing' },
  { id: 'wording', label: 'The question is confusing' },
  { id: 'other', label: 'Something else' },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['id'];

/**
 * What was on the student's screen when they reported it (owner, 25 Oct 2026:
 * the email should "include the screen/question that was shown"). Strings
 * only, so firestore.rules can hold each to a length; lists are joined one
 * item per line. Every field may be empty.
 */
export interface QuestionShown {
  /** The structure the question is about, by name. */
  subject: string;
  prompt: string;
  /** Bullet lines under the prompt (a ligament's attachments), one per line. */
  lines: string;
  /** The choices offered, one per line, in the order shown. */
  choices: string;
  correct: string;
  /** What the student answered, if they had answered before reporting. */
  given: string;
  /** The picture's path on the site, '' for a question with none. */
  picture: string;
}

export const SHOWN_MAX: Record<keyof QuestionShown, number> = {
  subject: 200,
  prompt: 600,
  lines: 1600,
  choices: 1600,
  correct: 300,
  given: 300,
  picture: 200,
};

export interface QuestionReport {
  userId: string;
  questionId: string;
  structureId: string;
  questionType: QuestionType;
  promptKind: PromptKind;
  area: string | null;
  reason: ReportReason;
  note: string;
  build: string;
  createdAt: string;
  /** Set by an admin once it has been dealt with. */
  resolvedAt?: string;
  /** Absent on reports sent before 25 Oct 2026. */
  shown?: QuestionShown;
}

export interface ClientError {
  userId: string;
  source: ErrorSource;
  message: string;
  stack: string;
  path: string;
  userAgent: string;
  build: string;
  createdAt: string;
}

/** `boundary` is a render that threw; the other two are the window's own events. */
export type ErrorSource = 'boundary' | 'error' | 'rejection';

/**
 * The steps between an advert and a paying student, in the order they happen.
 * Each is recorded once per account: the document id is `${uid}_${step}` and
 * the rules refuse a second write to it.
 */
export const FUNNEL_STEPS = [
  { id: 'landing-viewed', label: 'Saw the home page' },
  // A side road: a visitor may try ten questions before making an account, or
  // not. `optional` keeps it out of the main run's percentages (admin/lib/funnel.ts).
  { id: 'trial-started', label: 'Started the trial questions', optional: true },
  { id: 'trial-finished', label: 'Finished the trial questions', optional: true },
  { id: 'signup-started', label: 'Opened the account form' },
  { id: 'account-created', label: 'Created an account' },
  { id: 'email-confirmed', label: 'Confirmed their email' },
  { id: 'area-picked', label: 'Chose an area' },
  { id: 'first-answer', label: 'Answered a question' },
  { id: 'first-session', label: 'Finished a session' },
  { id: 'pricing-viewed', label: 'Saw the prices' },
  { id: 'checkout-opened', label: 'Opened the checkout' },
] as const;

export type FunnelStep = (typeof FUNNEL_STEPS)[number]['id'];

export interface FunnelEvent {
  userId: string;
  step: FunnelStep;
  /** `utm_source` from the address the visitor arrived at, else the referring site's host, else ''. */
  source: string;
  createdAt: string;
}

export interface QuestionReportInput {
  questionId: string;
  structureId: string;
  questionType: QuestionType;
  promptKind: PromptKind;
  area?: string;
  reason: ReportReason;
  note: string;
  shown?: QuestionShown;
}

/** Each field cut to its limit, so the rules never refuse a long question. */
export function clampShown(shown: QuestionShown): QuestionShown {
  const out = {} as QuestionShown;
  for (const key of Object.keys(SHOWN_MAX) as (keyof QuestionShown)[]) out[key] = (shown[key] ?? '').slice(0, SHOWN_MAX[key]);
  return out;
}

export function questionReportRow(uid: string, input: QuestionReportInput, build: string, now: Date): QuestionReport {
  return {
    ...(input.shown ? { shown: clampShown(input.shown) } : {}),
    userId: uid,
    questionId: input.questionId,
    structureId: input.structureId,
    questionType: input.questionType,
    promptKind: input.promptKind,
    area: input.area ?? null,
    reason: input.reason,
    note: input.note.trim().slice(0, NOTE_MAX),
    build,
    createdAt: now.toISOString(),
  };
}

/** The message a thrown value is filed under; '' for one with nothing to say. */
export function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error ?? '')).slice(0, MESSAGE_MAX);
}

export function clientErrorRow(
  uid: string,
  source: ErrorSource,
  error: unknown,
  page: { path: string; userAgent: string },
  build: string,
  now: Date,
): ClientError {
  return {
    userId: uid,
    source,
    message: errorMessage(error),
    stack: (error instanceof Error ? (error.stack ?? '') : '').slice(0, STACK_MAX),
    // The path only: a query string can carry an invite or a payment reference.
    path: page.path.slice(0, PATH_MAX),
    userAgent: page.userAgent.slice(0, USER_AGENT_MAX),
    build,
    createdAt: now.toISOString(),
  };
}

export function funnelEventRow(uid: string, step: FunnelStep, source: string, now: Date): FunnelEvent {
  return { userId: uid, step, source: source.slice(0, SOURCE_MAX), createdAt: now.toISOString() };
}

/** One document per account per step; firestore.rules checks the id is exactly this. */
export function funnelEventId(uid: string, step: FunnelStep): string {
  return `${uid}_${step}`;
}
