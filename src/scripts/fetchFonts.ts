import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Downloads the web fonts from Google Fonts into public/fonts/ and writes the
 * matching @font-face rules to src/fonts.generated.css.
 *
 * Self-hosted rather than linked (CR-023) for two reasons. The CDN request
 * fails with no network, so the first paint of an app whose whole point is
 * revising on a train blocks on a resource that is not there. And requesting a
 * font from fonts.gstatic.com sends the student's IP address to Google — a
 * German court found exactly that an unlawful transfer under GDPR, and this
 * app is being sold to universities that will ask.
 *
 * Latin subsets only: the content is English and anatomical Latin, so the
 * Cyrillic, Greek and Vietnamese subsets Google also serves are dead weight.
 *
 * Re-run after changing a weight or family in src/index.css:
 *
 *   npx tsx src/scripts/fetchFonts.ts
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const FONT_DIR = `${ROOT}/public/fonts`;
const CSS_OUT = `${ROOT}/src/fonts.generated.css`;

/** Exactly the families and weights index.html used to request from the CDN. */
const SPEC =
  'family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400' +
  '&family=IBM+Plex+Sans:wght@400;500;600' +
  '&family=IBM+Plex+Mono:wght@400;500;600' +
  '&display=swap';

/** Google serves woff2 only to a browser-like UA; with the default it returns truetype. */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const KEEP_SUBSETS = new Set(['latin', 'latin-ext']);

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function main(): Promise<void> {
  const css = await fetch(`https://fonts.googleapis.com/css2?${SPEC}`, { headers: { 'User-Agent': UA } }).then((r) => {
    if (!r.ok) throw new Error(`Google Fonts returned ${r.status}`);
    return r.text();
  });

  mkdirSync(FONT_DIR, { recursive: true });

  // Each block is preceded by a /* subset */ comment. Whole blocks are kept
  // and only their src rewritten, so whatever descriptors Google emits —
  // including Newsreader's variable opsz range — survive untouched.
  const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]+\})/g)];
  if (blocks.length === 0) throw new Error('No @font-face blocks parsed — did the response format change?');

  interface Face {
    subset: string;
    block: string;
    url: string;
    family: string;
    weight: string;
    style: string;
  }

  const faces: Face[] = [];
  let skipped = 0;

  for (const [, subset, block] of blocks) {
    if (!KEEP_SUBSETS.has(subset)) {
      skipped += 1;
      continue;
    }
    const url = block.match(/url\((https:\/\/[^)]+\.woff2)\)/)?.[1];
    const family = block.match(/font-family:\s*'([^']+)'/)?.[1];
    const weight = block.match(/font-weight:\s*([^;]+);/)?.[1]?.trim();
    const style = block.match(/font-style:\s*([^;]+);/)?.[1]?.trim() ?? 'normal';
    if (!url || !family || !weight) throw new Error(`Could not parse a ${subset} block for ${family ?? 'unknown'}`);
    faces.push({ subset, block, url, family, weight, style });
  }

  /*
   * Name and download by URL, not by face. Newsreader and IBM Plex Sans are
   * variable fonts: Google serves ONE file per subset and varies the weight
   * through the descriptor, so three @font-face blocks share a URL. Keying on
   * the face instead downloaded identical bytes three times — 20 files for 12
   * distinct ones, which the service worker in CR-023 would then precache.
   */
  const nameByUrl = new Map<string, string>();
  for (const face of faces) {
    if (nameByUrl.has(face.url)) continue;
    const shared = faces.filter((f) => f.url === face.url);
    const weights = new Set(shared.map((f) => f.weight));
    // A file covering several weights is misnamed by any one of them.
    const weightPart = weights.size > 1 ? 'variable' : slug(face.weight);
    const stylePart = face.style === 'italic' ? '-italic' : '';
    nameByUrl.set(face.url, `${slug(face.family)}-${weightPart}${stylePart}-${face.subset}.woff2`);
  }

  let downloaded = 0;
  for (const [url, name] of nameByUrl) {
    const bytes = await fetch(url, { headers: { 'User-Agent': UA } }).then((r) => {
      if (!r.ok) throw new Error(`${url} returned ${r.status}`);
      return r.arrayBuffer();
    });
    writeFileSync(`${FONT_DIR}/${name}`, Buffer.from(bytes));
    downloaded += 1;
  }

  const out = faces.map(
    (face) =>
      `/* ${face.subset} */\n${face.block.replace(
        /url\(https:\/\/[^)]+\.woff2\)/,
        `url('/fonts/${nameByUrl.get(face.url)}')`,
      )}`,
  );

  writeFileSync(
    CSS_OUT,
    `/*\n * GENERATED — do not edit by hand.\n * Regenerate with: npx tsx src/scripts/fetchFonts.ts\n *\n` +
      ` * Self-hosted web fonts (CR-023). Files live in public/fonts/; see that\n` +
      ` * script for why these are not loaded from the Google Fonts CDN.\n */\n\n` +
      out.join('\n\n') +
      '\n',
  );

  console.log(`Downloaded ${downloaded} font files to public/fonts/ (skipped ${skipped} non-Latin subsets).`);
  console.log(`Wrote ${CSS_OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
