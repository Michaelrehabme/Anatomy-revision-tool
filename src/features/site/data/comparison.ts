/**
 * The comparison page's data (CR-033 item 17). DRAFT: the page is unlinked and
 * noindexed until the owner approves it.
 *
 * THE RULE. Every line about another product is something a dated screenshot
 * in docs/evidence/ shows, and nothing else: a price, what a plan is called,
 * what its own page lists. Nothing about how good, accurate or effective a
 * competitor is. A competitor changing its price turns a true line into a
 * false one without anybody touching this file, so every line carries the
 * date it was true ON, and the page prints that date beside it.
 *
 * `evidence` is REQUIRED by the type, and comparison.test.tsx fails if a row's
 * file is missing from docs/evidence/, if its date disagrees with the folder
 * it sits in, or if the page renders a row without its "as of" line. A row
 * with no screenshot cannot be added by accident.
 *
 * NOT HERE, AND WHY. Quizlet: the capture is a bot-check page, not prices, so
 * there is nothing to state. Institutional pricing (TeachMeAnatomy Virtual
 * Academy, Complete Anatomy, Visible Body): none of the captures shows a
 * figure. RemNote's monthly and lifetime prices: only the Yearly tab was
 * captured.
 */

export interface Evidence {
  /** File name inside docs/evidence/competitors-<capturedOn>/. */
  file: string;
  /** ISO date of the capture — also the folder suffix, which the test checks. */
  capturedOn: string;
  /** The page that was captured. */
  url: string;
}

export interface ComparisonLine {
  /** What the line is about: "Monthly", "Free tier", "Also listed". */
  label: string;
  /** Exactly what the screenshot shows, in the product's own terms. */
  text: string;
}

export interface ComparisonRow {
  id: string;
  product: string;
  /** One plain clause on what kind of product it is, from its own page. */
  kind: string;
  /** Prices are quoted in the currency the page showed a UK visitor. Never converted. */
  currency: 'GBP' | 'USD';
  lines: ComparisonLine[];
  evidence: Evidence;
}

/** Re-capture before publishing after this date — docs/CLAIMS.md, "Routine". */
export const RECHECK_BY = '2026-12-28';

const CAPTURED = '2026-09-28';

export const COMPARISON_ROWS: ComparisonRow[] = [
  {
    id: 'teachmeanatomy',
    product: 'TeachMeAnatomy',
    kind: 'Anatomy articles, question bank and 3D models',
    currency: 'GBP',
    lines: [
      { label: 'Monthly', text: '£25 a month' },
      { label: 'Quarterly', text: '£45 every 3 months (shown as £15 a month)' },
      { label: 'Yearly', text: '£96 every 12 months (shown as £8 a month)' },
      { label: 'Lifetime', text: '£195, one payment' },
      { label: 'Free tier', text: 'A "Basic" column: 4 articles per month and 600 questions' },
      { label: 'Also listed', text: 'Interactive 3D models, a dissection atlas, audio lectures and flashcards, in the paid column' },
    ],
    evidence: { file: 'teachmeanatomy-pricing.png', capturedOn: CAPTURED, url: 'https://teachmeanatomy.info/sign-up/' },
  },
  {
    id: 'kenhub',
    product: 'Kenhub',
    kind: 'Anatomy atlas, articles, video tutorials and quizzes',
    currency: 'GBP',
    lines: [
      { label: 'Monthly', text: '£25 a month' },
      { label: '3 months', text: '£57 every 3 months (shown as £19 a month)' },
      { label: 'Lifetime', text: '£190, one payment (shown against a struck-through £300)' },
      { label: 'Free tier', text: 'A "Free" column: the anatomy atlas and articles, and Latin and English terminology' },
      { label: 'Also listed', text: 'Video tutorials and quizzes, in the paid column' },
    ],
    evidence: { file: 'kenhub-pricing.png', capturedOn: CAPTURED, url: 'https://www.kenhub.com/en/pricing' },
  },
  {
    id: 'completeanatomy',
    product: 'Complete Anatomy',
    kind: '3D anatomy app',
    currency: 'GBP',
    lines: [
      { label: 'Student', text: '£34.99 for the first year, an annual subscription, shown as a first-year discount against a struck-through £69.99' },
      { label: 'Professional', text: '£94.99, an annual subscription' },
      { label: 'Also listed', text: '"Access on all devices" on both plans' },
    ],
    evidence: { file: 'completeanatomy-pricing.png', capturedOn: CAPTURED, url: 'https://store.3d4medical.com/' },
  },
  {
    id: 'visiblebody',
    product: 'Visible Body Suite',
    kind: '3D anatomy and physiology app',
    currency: 'USD',
    lines: [
      { label: 'Student', text: '$34.99 a year' },
      { label: 'Classroom / Professional', text: '$199 a year' },
    ],
    evidence: {
      file: 'visiblebody-pricing.png',
      capturedOn: CAPTURED,
      url: 'https://www.visiblebody.com/anatomy-and-physiology-apps/vb-suite',
    },
  },
  {
    id: 'remnote',
    product: 'RemNote',
    kind: 'General notes and flashcards tool, not an anatomy product',
    currency: 'USD',
    lines: [
      { label: 'Free tier', text: 'US$0, with unlimited notes and flashcards listed' },
      { label: 'Pro', text: 'US$96 billed yearly (shown as US$8 a month)' },
      { label: 'Pro with AI', text: 'US$216 billed yearly (shown as US$18 a month)' },
    ],
    evidence: { file: 'remnote-pricing.png', capturedOn: CAPTURED, url: 'https://www.remnote.com/pricing' },
  },
];

/** "2026-09-28" as a reader says it. */
export function readableDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${d} ${months[m - 1]} ${y}`;
}

/** The line every row carries. One function, so the page and the test agree on its wording. */
export function asOf(evidence: Evidence): string {
  return `As of ${readableDate(evidence.capturedOn)}`;
}
