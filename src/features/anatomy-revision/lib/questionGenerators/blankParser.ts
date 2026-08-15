import type { Rng } from '../rng';

export interface ParsedBlank {
  before: string;
  after: string;
  answer: string;
}

/**
 * Connectors that split a free-text attachment/articulation statement into a
 * "subject" clause (muscle/ligament/joint name) and a "site" clause (where it
 * attaches/articulates), tried leftmost-match-wins across the whole list —
 * covers both the " with " pattern articulations use almost universally
 * ("Knee joint with the femur") and the em-dash pattern bone attachments use
 * ("Gluteus maximus insertion — gluteal tuberosity").
 */
const CONNECTORS = [' with ', ' — ', ' – ', ' - '];

/** Landmark attachments are often role-word-only, with no site clause (the landmark itself IS the site). */
const ROLE_WORD = /\b(origins?|insertions?|attachments?|attaches|attach)\b/i;
const TRAILING_ROLE_WORD = /\s+(origins?|insertions?|attachments?|attaches|attach)$/i;

/**
 * A handful of statements are written as full sentences ("Latissimus dorsi
 * has a variable attachment here", "Glenoid labrum deepens the socket")
 * rather than a "<subject> <role word>" noun phrase — a verb ahead of the
 * role word is a reliable signal that blanking "everything before the role
 * word" would produce an unnatural answer, so those are left unparsed.
 */
const SUBJECT_VERB_BLOCKLIST = /\b(has|have|is|was|were|runs|deepens|deepen|forms)\b/i;

function stripParentheticals(text: string): string {
  return text.replace(/\s*\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
}

function stripLeadingArticle(text: string): { article: string; rest: string } {
  const match = text.match(/^(the|a|an)\s+/i);
  if (!match) return { article: '', rest: text };
  return { article: match[0], rest: text.slice(match[0].length).trim() };
}

function stripTrailingRoleWord(text: string): { core: string; suffix: string } {
  const match = text.match(TRAILING_ROLE_WORD);
  if (!match || match.index === undefined) return { core: text, suffix: '' };
  return { core: text.slice(0, match.index).trim(), suffix: match[0] };
}

function findConnector(cleaned: string): { connector: string; index: number } | null {
  const lower = cleaned.toLowerCase();
  let best: { connector: string; index: number } | null = null;
  for (const connector of CONNECTORS) {
    const index = lower.indexOf(connector);
    if (index === -1) continue;
    if (!best || index < best.index) best = { connector, index };
  }
  return best;
}

function connectorBlank(cleaned: string, found: { connector: string; index: number }, rng: Rng): ParsedBlank | null {
  const subjectRaw = cleaned.slice(0, found.index).trim();
  const siteRaw = cleaned.slice(found.index + found.connector.length).trim();
  if (!subjectRaw || !siteRaw) return null;

  const { core: subjectCore, suffix: subjectSuffix } = stripTrailingRoleWord(subjectRaw);
  const { article, rest: siteCore } = stripLeadingArticle(siteRaw);

  const subjectOption: ParsedBlank | null = subjectCore
    ? { before: '', after: `${subjectSuffix}${found.connector}${siteRaw}`, answer: subjectCore }
    : null;
  const siteOption: ParsedBlank | null = siteCore
    ? { before: `${subjectRaw}${found.connector}${article}`, after: '', answer: siteCore }
    : null;

  if (subjectOption && siteOption) return rng() < 0.5 ? subjectOption : siteOption;
  return subjectOption ?? siteOption;
}

function roleWordBlank(cleaned: string): ParsedBlank | null {
  const match = cleaned.match(ROLE_WORD);
  if (!match || match.index === undefined || match.index === 0) return null;

  const subject = cleaned.slice(0, match.index).trim();
  if (!subject || SUBJECT_VERB_BLOCKLIST.test(subject)) return null;

  const tail = cleaned.slice(match.index);
  return { before: '', after: ` ${tail}`, answer: subject };
}

/**
 * Turns a single free-text attachment/articulation statement into a
 * fill-in-the-blank (before/answer/after), or returns null if the statement
 * doesn't fit a recognised pattern — callers should skip it rather than emit
 * a low-quality question.
 */
export function parseBlank(statement: string, rng: Rng): ParsedBlank | null {
  const cleaned = stripParentheticals(statement);
  if (!cleaned) return null;

  const connector = findConnector(cleaned);
  if (connector) return connectorBlank(cleaned, connector, rng);

  return roleWordBlank(cleaned);
}
