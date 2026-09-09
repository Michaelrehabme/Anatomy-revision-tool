import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

/**
 * Renders the app icon set from public/brand/*.svg.
 *
 * A script rather than a folder of PNGs somebody once exported, because the
 * mark will change — the brand sheet has a two-ring variant for large sizes
 * that is not in the lockup we were given — and eleven hand-exported files
 * drift the moment one of them is updated. Re-run after touching the SVGs:
 *
 *   npx tsx src/scripts/generateIcons.ts
 *
 * Three kinds of output, and the differences matter:
 *
 * - PWA icons are transparent. The platform decides the ground.
 * - The maskable icon is full-bleed and inset to the 80% safe zone, because
 *   Android crops it to the launcher's own shape and a transparent one gets
 *   composited on a colour we do not choose — navy figure on navy ground.
 * - apple-touch-icon is flattened onto bone. iOS composites transparency onto
 *   black, which turns the navy figure into a dark smudge.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const BRAND = `${ROOT}/public/brand`;
const OUT = `${ROOT}/public/icons`;

const BONE = '#efe9da';

mkdirSync(OUT, { recursive: true });

const mark = readFileSync(`${BRAND}/locusmsk-mark.svg`);
const maskable = readFileSync(`${BRAND}/locusmsk-maskable.svg`);

/** density scales the SVG rasterisation so a 512px render is drawn at 512px, not upscaled from 128. */
const render = (svg: Buffer, size: number) =>
  sharp(svg, { density: Math.ceil((72 * size) / 128) }).resize(size, size, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });

async function main(): Promise<void> {
  const written: string[] = [];

  const write = async (name: string, buffer: Buffer) => {
    writeFileSync(`${OUT}/${name}`, buffer);
    written.push(`${name.padEnd(28)} ${(buffer.length / 1024).toFixed(1)} KB`);
  };

  // Transparent PWA icons.
  for (const size of [192, 256, 384, 512]) {
    await write(`icon-${size}.png`, await render(mark, size).png().toBuffer());
  }

  // Maskable, full-bleed, already inset in the source SVG.
  await write('icon-maskable-512.png', await render(maskable, 512).png().toBuffer());

  // iOS: flattened onto bone, no alpha channel at all.
  await write(
    'apple-touch-icon.png',
    await render(mark, 180).flatten({ background: BONE }).png().toBuffer(),
  );

  // Favicons. At 16px the ring is a smudge, so the brand sheet drops it —
  // this renders the same art small, which is honest about what we have; swap
  // in mark-small.svg if the designed 16px variant becomes available.
  for (const size of [32, 16]) {
    await write(`favicon-${size}.png`, await render(mark, size).png().toBuffer());
  }

  // Modern browsers prefer an SVG favicon and scale it themselves.
  writeFileSync(`${ROOT}/public/favicon.svg`, mark);
  written.push('../favicon.svg (copied from brand/locusmsk-mark.svg)');

  console.log(written.join('\n'));
  console.log(`\n${written.length - 1} icons written to public/icons/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
