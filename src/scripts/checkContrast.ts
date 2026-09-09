import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Checks the design tokens in src/index.css against WCAG 2.2 contrast minima.
 *
 * Exists because the brand palette was adopted from a logo sheet, and a colour
 * chosen to look right on a brand board is not the same as one that passes as
 * link text. Cartilage (#3F8F8A) on bone is 3.15:1 — fine for an icon, a fail
 * for a link — which is exactly the kind of thing a university's accessibility
 * review catches and nobody notices by eye.
 *
 * UK public sector bodies must meet WCAG 2.2 AA, and university procurement
 * asks. Run after touching any token:
 *
 *   npx tsx src/scripts/checkContrast.ts
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const css = readFileSync(`${ROOT}/src/index.css`, 'utf8');

/**
 * Hex tokens only. --line is a translucent navy so it composites correctly on
 * both paper and bone, and a ratio against an rgba value is not meaningful
 * without knowing what is behind it — those are reported as skipped rather
 * than guessed at.
 */
function token(name: string): string | null {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  return match ? match[1] : null;
}

function luminance(hex: string): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(parseInt(hex.slice(1, 3), 16));
  const g = channel(parseInt(hex.slice(3, 5), 16));
  const b = channel(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** min 4.5 = AA normal text; 3 = AA large text and non-text UI. */
interface Check {
  fg: string;
  bg: string;
  min: number;
  what: string;
}

const CHECKS: Check[] = [
  { fg: 'ink', bg: 'pg', min: 4.5, what: 'body copy on the page ground' },
  { fg: 'ink', bg: 'sf', min: 4.5, what: 'body copy on cards' },
  { fg: 'ink2', bg: 'pg', min: 4.5, what: 'secondary text on the page ground' },
  { fg: 'ink2', bg: 'sf', min: 4.5, what: 'secondary text on cards' },
  { fg: 'ink3', bg: 'pg', min: 4.5, what: 'muted text on the page ground' },
  { fg: 'ink3', bg: 'sf', min: 4.5, what: 'muted text on cards' },
  { fg: 'accd', bg: 'pg', min: 4.5, what: 'links on the page ground' },
  { fg: 'accd', bg: 'sf', min: 4.5, what: 'links on cards' },
  { fg: 'accd', bg: 'accs', min: 4.5, what: 'text on a selected row' },
  { fg: 'onacc', bg: 'accd', min: 4.5, what: 'label on a filled primary button' },
  { fg: 'onacc', bg: 'acc-fill', min: 4.5, what: 'label on the primary button fill' },
  { fg: 'onacc', bg: 'acc-pressed', min: 4.5, what: 'label on a pressed button' },
  { fg: 'onacc', bg: 'ink', min: 4.5, what: 'text on ink navy surfaces' },
  { fg: 'acc2d', bg: 'acc2s', min: 4.5, what: 'error text on the artery wash' },
  { fg: 'onacc', bg: 'acc2d', min: 4.5, what: 'label on a filled error button' },
  { fg: 'acc2d', bg: 'pg', min: 4.5, what: 'error text on the page ground' },
  { fg: 'acc2d', bg: 'sf', min: 4.5, what: 'error text on cards' },
  { fg: 'acc', bg: 'pg', min: 3, what: 'accent fills and icons (non-text)' },
  // Advisory: WCAG 1.4.11 requires 3:1 only where a border is the sole way
  // to identify a control. These dividers sit alongside labels and colour, so
  // a low ratio here is a design choice rather than a failure — but a number
  // worth seeing when it drifts.
  { fg: 'line', bg: 'pg', min: 0, what: 'borders (advisory, not an AA requirement)' },
];

let failures = 0;
console.log('token pair'.padEnd(22) + 'ratio'.padEnd(9) + 'min'.padEnd(6) + 'result');
console.log('-'.repeat(78));

for (const check of CHECKS) {
  const fg = token(check.fg);
  const bg = token(check.bg);
  if (!fg || !bg) {
    console.log((check.fg + ' on ' + check.bg).padEnd(22) + 'skipped'.padEnd(9) + '-'.padEnd(6) + 'not a hex token  ' + check.what);
    continue;
  }
  const value = ratio(fg, bg);
  const pass = value >= check.min;
  if (!pass) failures++;
  console.log(
    `${check.fg} on ${check.bg}`.padEnd(22) +
      `${value.toFixed(2)}:1`.padEnd(9) +
      `${check.min}`.padEnd(6) +
      `${pass ? 'pass' : 'FAIL'}  ${check.what}`,
  );
}

console.log('-'.repeat(78));
if (failures > 0) {
  console.error(`${failures} contrast ${failures === 1 ? 'failure' : 'failures'}.`);
  process.exit(1);
}
console.log('All pairs meet WCAG 2.2 AA.');
