import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

/**
 * Renders the app icon set from the brand SVGs in brand/svg/.
 *
 * A script rather than a folder of PNGs somebody once exported, because the
 * mark has a size ladder — the ring count comes down as it shrinks so the
 * deltoid target never fills in — and eight hand-exported files drift the
 * moment one of them is redrawn. Re-run after touching brand/:
 *
 *   npx tsx src/scripts/generateIcons.ts
 *
 * The sources live in brand/, not public/brand/, because everything under
 * public/ is copied verbatim into the build: the fourteen delivered SVGs are
 * ~220KB that no page ever requests. Only what this script writes ships.
 *
 * They are kept exactly as delivered, C2PA manifest and all. The manifest is
 * most of each file's bytes, but it is the provenance record for an
 * AI-assisted asset — the same disclosure question CR-026 tracks for the
 * generated anatomy renders — and dropping it to save bytes in files we do not
 * serve would be trading the wrong thing.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SVG = `${ROOT}/brand/svg`;
const OUT = `${ROOT}/public/icons`;

/**
 * The size ladder from brand/readme.md: two rings at 64px and up, one ring
 * between, none at 32 and below. Only the two ends are used by this script —
 * see the favicon note below for why 32 takes the ringless cut.
 */
const markFull = readFileSync(`${SVG}/mark-full.svg`);
const markSmall = readFileSync(`${SVG}/mark-small.svg`);

/**
 * The app icon is the navy square, not the bare mark — that is what the
 * designer exported at 180, 192 and 512, and it is the one cut that cannot
 * disappear into a launcher background we do not control. It is full-bleed
 * with the figure inset well inside Android's 80% safe circle, so the same
 * art serves the `any` and `maskable` purposes.
 */
const appIcon = readFileSync(`${SVG}/app-icon-navy.svg`);

const faviconAdaptive = readFileSync(`${ROOT}/brand/favicon-adaptive.svg`);

/**
 * sharp rasterises an SVG at `density` DPI against its intrinsic size, where
 * 72 DPI draws it at 1:1. The marks are 120px intrinsic and the app icons
 * 1024px, so a fixed density would render one of them from the wrong pixel
 * grid — upscaling a 120px raster to 512 is a blurred icon. Read the width off
 * the file instead.
 */
function render(svg: Buffer, size: number) {
  const intrinsic = Number(/width="(\d+(?:\.\d+)?)"/.exec(svg.toString('utf8'))?.[1]);
  if (!intrinsic) throw new Error('SVG has no intrinsic width attribute');
  return sharp(svg, { density: Math.ceil((72 * size) / intrinsic) }).resize(size, size, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const written: string[] = [];

  const write = async (name: string, buffer: Buffer, note: string) => {
    writeFileSync(`${OUT}/${name}`, buffer);
    written.push(`${name.padEnd(24)}${`${(buffer.length / 1024).toFixed(1)} KB`.padStart(9)}   ${note}`);
  };

  // PWA icons. Opaque navy square, matching the delivered app-icon-navy PNGs.
  for (const size of [192, 256, 384, 512]) {
    await write(`icon-${size}.png`, await render(appIcon, size).png().toBuffer(), 'app-icon-navy');
  }

  // Same art again for the maskable purpose: Android crops it to the
  // launcher's own shape, and the figure already sits inside the safe circle.
  await write(
    'icon-maskable-512.png',
    await render(appIcon, 512).png().toBuffer(),
    'app-icon-navy, full-bleed',
  );

  // iOS composites any transparency onto black and rounds the corners itself,
  // so this is flattened to drop the alpha channel entirely.
  await write(
    'apple-touch-icon.png',
    await render(appIcon, 180).flatten({ background: '#1f2a44' }).png().toBuffer(),
    'app-icon-navy, no alpha',
  );

  // Favicons, transparent, both from the ringless cut.
  //
  // The readme puts mark-single-ring in a "32-64px" band, which reads as
  // though 32 should carry a ring. It should not: the designer's own
  // favicon-32.png export is the ringless mark, and rendering the single-ring
  // cut at 32 shows why — the ring lands as a two-pixel teal smear behind the
  // shoulder rather than a ring. 32 is the boundary, and the boundary belongs
  // to the smaller variant. mark-single-ring is therefore unused here; it is
  // for the mark at ~48px in the interface, not for a favicon.
  await write('favicon-32.png', await render(markSmall, 32).png().toBuffer(), 'mark-small');
  await write('favicon-16.png', await render(markSmall, 16).png().toBuffer(), 'mark-small');

  // Modern browsers prefer the SVG and rasterise it themselves at whatever
  // size they need, which is why this one carries the dark-mode swap.
  writeFileSync(`${ROOT}/public/favicon.svg`, faviconAdaptive);
  written.push(
    `${'../favicon.svg'.padEnd(24)}${`${(faviconAdaptive.length / 1024).toFixed(1)} KB`.padStart(9)}   mark-small, theme-adaptive`,
  );

  // A large mark on transparent, for the marketing site and any press or
  // slide use — not referenced by the app, and not in public/.
  mkdirSync(`${ROOT}/brand/png`, { recursive: true });
  const mark512 = await render(markFull, 512).png().toBuffer();
  writeFileSync(`${ROOT}/brand/png/mark-full-512.png`, mark512);

  console.log(written.join('\n'));
  console.log(`\n${written.length} files written for public/, plus brand/png/mark-full-512.png`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
