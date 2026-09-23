import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Checks the design tokens in src/index.css against WCAG 2.2 contrast minima,
 * in every theme scope.
 *
 * Exists because the brand palette was adopted from a logo sheet, and a colour
 * chosen to look right on a brand board is not the same as one that passes as
 * link text. Cartilage (#3F8F8A) on bone is 3.15:1 — fine for an icon, a fail
 * for a link — which is exactly the kind of thing a university's accessibility
 * review catches and nobody notices by eye.
 *
 * UK public sector bodies must meet WCAG 2.2 AA, and university procurement
 * asks. This module is the evidence for the claim on
 * features/legal/AccessibilityPage.tsx, so it is importable (a Vitest wrapper
 * runs it on every `npm test`) rather than a CLI that only a human remembers
 * to run. The CLI lives in checkContrast.ts.
 */

export type ScopeName = 'light' | 'dark' | 'light-hc' | 'dark-hc';

/**
 * The selector that opens each scope's block, whitespace-normalised. A
 * renamed selector must fail loudly rather than silently skipping a scope —
 * a scope that is not found is the failure mode that would report four
 * passing palettes while only ever reading the first one.
 */
const SCOPE_SELECTORS: Record<ScopeName, string> = {
  light: ":root, :root[data-theme='light']",
  dark: ":root[data-theme='dark']",
  'light-hc': ":root[data-contrast='high'], :root[data-theme='light'][data-contrast='high']",
  'dark-hc': ":root[data-theme='dark'][data-contrast='high']",
};

export const SCOPES = Object.keys(SCOPE_SELECTORS) as ScopeName[];

export const SCOPE_LABELS: Record<ScopeName, string> = {
  light: 'Light',
  dark: 'Dark',
  'light-hc': 'Light · high contrast',
  'dark-hc': 'Dark · high contrast',
};

/** Comments are stripped first: a selector is everything since the last `}`,
 *  so a docblock above a rule would otherwise be read as part of its selector. */
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Top-level rules, so a token is read from the block it actually belongs to. */
function rules(source: string): { selector: string; body: string }[] {
  const css = stripComments(source);
  const out: { selector: string; body: string }[] = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open === -1) break;
    // Everything after the last `;` — otherwise the leading `@import ...;`
    // statements ride along on the first selector and it reads as an at-rule.
    const selector = css.slice(i, open).split(';').pop()!.trim();
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    if (!selector.startsWith('@')) out.push({ selector, body: css.slice(open + 1, j - 1) });
    i = j;
  }
  return out;
}

const normalise = (s: string) => s.replace(/\s+/g, ' ').trim();

function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const match of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    out.set(match[1], match[2].trim());
  }
  return out;
}

export function readScopes(css: string): Record<ScopeName, Map<string, string>> {
  const parsed = rules(css);
  const found = {} as Record<ScopeName, Map<string, string>>;
  for (const scope of SCOPES) {
    const wanted = normalise(SCOPE_SELECTORS[scope]);
    const rule = parsed.find((r) => normalise(r.selector) === wanted);
    if (!rule) {
      throw new Error(
        `No rule in src/index.css for the ${scope} scope (expected selector "${SCOPE_SELECTORS[scope]}"). ` +
          'If the selector was renamed, update SCOPE_SELECTORS — a scope that silently goes unchecked is worse than a missing one.',
      );
    }
    found[scope] = declarations(rule.body);
  }
  return found;
}

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** #rrggbb or rgb()/rgba(). Anything else (a var(), a shadow) is not a colour. */
export function parseColour(value: string): Rgba | null {
  const hex = value.trim().match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    return {
      r: parseInt(hex[1].slice(0, 2), 16),
      g: parseInt(hex[1].slice(2, 4), 16),
      b: parseInt(hex[1].slice(4, 6), 16),
      a: 1,
    };
  }
  const rgba = value.trim().match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?\s*\)$/i);
  if (!rgba) return null;
  return { r: +rgba[1], g: +rgba[2], b: +rgba[3], a: rgba[4] === undefined ? 1 : +rgba[4] };
}

/**
 * Composites a translucent colour onto an opaque one.
 *
 * The hairline tokens are translucent navy in light and translucent paper in
 * dark, precisely so they sit correctly on both the ground and a card. A
 * ratio against an rgba value is meaningless without knowing what is behind
 * it — the previous version of this script skipped them for that reason,
 * which meant the borders went unchecked in the one mode where they carry the
 * whole boundary.
 */
function over(fg: Rgba, bg: Rgba): Rgba {
  return {
    r: fg.a * fg.r + (1 - fg.a) * bg.r,
    g: fg.a * fg.g + (1 - fg.a) * bg.g,
    b: fg.a * fg.b + (1 - fg.a) * bg.b,
    a: 1,
  };
}

function luminance({ r, g, b }: Rgba): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function ratio(fg: Rgba, bg: Rgba): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** min 4.5 = AA normal text; 3 = AA large text and non-text UI. */
export interface Check {
  fg: string;
  bg: string;
  min: number;
  what: string;
  /** Checked only in the high-contrast scopes, where the token is opaque. */
  hcOnly?: boolean;
}

export const CHECKS: Check[] = [
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
  { fg: 'onacc', bg: 'acc2', min: 4.5, what: 'label on the artery fill' },
  { fg: 'ink', bg: 'accs', min: 4.5, what: 'text on the selected-row wash' },
  { fg: 'ink', bg: 'acc2s', min: 4.5, what: 'text on the artery wash' },
  { fg: 'onacc', bg: 'acc-fill', min: 4.5, what: 'label on the primary button fill' },
  { fg: 'onacc', bg: 'acc-pressed', min: 4.5, what: 'label on a pressed button' },
  { fg: 'onacc', bg: 'ink', min: 4.5, what: 'text on ink navy surfaces' },
  { fg: 'acc2d', bg: 'acc2s', min: 4.5, what: 'error text on the artery wash' },
  { fg: 'onacc', bg: 'acc2d', min: 4.5, what: 'label on a filled error button' },
  { fg: 'acc2d', bg: 'pg', min: 4.5, what: 'error text on the page ground' },
  { fg: 'acc2d', bg: 'sf', min: 4.5, what: 'error text on cards' },
  // --acc is a FILL, never a text background: --onacc on it is 3.81:1. Nothing
  // asserts that pair because the pairing is forbidden rather than expected —
  // the guard for it is a source check, lib/__tests__/tokenUsage.test.ts.
  { fg: 'acc', bg: 'pg', min: 3, what: 'accent fills and icons (non-text)' },
  { fg: 'acc', bg: 'sf', min: 3, what: 'accent fills on cards (non-text)' },
  // Advisory in the normal scopes at 1.90:1, and deliberately so: the figure's
  // "outline" is a second copy of the silhouette mask showing through behind
  // the fill (see BodyFigure.tsx), not a control boundary — the regions are
  // identified by position and label. It is a requirement in high contrast,
  // where someone has asked for exactly this kind of edge to be visible.
  { fg: 'fig-line', bg: 'fig-off', min: 0, what: 'the body figure outline' },
  // Advisory in the normal scopes: WCAG 1.4.11 requires 3:1 only where a
  // border is the SOLE way to identify a control, and these sit alongside
  // labels and colour. In high contrast they are opaque and are the boundary,
  // so there they are a requirement.
  { fg: 'line', bg: 'pg', min: 0, what: 'borders on the page ground' },
  { fg: 'line', bg: 'sf', min: 0, what: 'borders on cards' },
  { fg: 'line-strong', bg: 'pg', min: 0, what: 'strong borders on the page ground' },
];

export interface Result {
  scope: ScopeName;
  check: Check;
  ratio: number | null;
  min: number;
  pass: boolean;
  note?: string;
}

const isHc = (scope: ScopeName) => scope.endsWith('-hc');

/**
 * High contrast that only reaches AA is not high contrast: text pairs are held
 * to AAA (7:1), and the borders stop being advisory.
 */
function minimumFor(check: Check, scope: ScopeName): number {
  if (!isHc(scope)) return check.min;
  if (check.min >= 4.5) return 7;
  if (check.min === 0) return 3;
  return 4.5;
}

/** Every token declared in light, which every other scope must also declare. */
export function missingTokens(scopes: Record<ScopeName, Map<string, string>>): Record<ScopeName, string[]> {
  const expected = [...scopes.light.keys()];
  const out = {} as Record<ScopeName, string[]>;
  for (const scope of SCOPES) {
    out[scope] = scope === 'light' ? [] : expected.filter((t) => !scopes[scope].has(t));
  }
  return out;
}

/**
 * Resolved lazily, and only when no CSS is passed in. At module scope
 * import.meta.url throws under the jsdom test environment, which would make
 * this module unimportable from the Vitest wrapper that is the whole point of
 * splitting it out of the CLI.
 */
function defaultCss(): string {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  return readFileSync(`${root}/src/index.css`, 'utf8');
}

export function run(css: string = defaultCss()): {
  results: Result[];
  missing: Record<ScopeName, string[]>;
  failures: Result[];
} {
  const scopes = readScopes(css);
  const missing = missingTokens(scopes);
  const results: Result[] = [];

  for (const scope of SCOPES) {
    const tokens = scopes[scope];
    for (const check of CHECKS) {
      const min = minimumFor(check, scope);
      const rawFg = tokens.get(check.fg);
      const rawBg = tokens.get(check.bg);
      const fg = rawFg ? parseColour(rawFg) : null;
      const bg = rawBg ? parseColour(rawBg) : null;
      if (!fg || !bg) {
        results.push({ scope, check, ratio: null, min, pass: true, note: 'not a colour token' });
        continue;
      }
      if (bg.a < 1) {
        results.push({ scope, check, ratio: null, min, pass: true, note: 'translucent background' });
        continue;
      }
      const value = ratio(over(fg, bg), bg);
      results.push({ scope, check, ratio: value, min, pass: value >= min });
    }
  }

  const failures = results.filter((r) => !r.pass);
  return { results, missing, failures };
}
