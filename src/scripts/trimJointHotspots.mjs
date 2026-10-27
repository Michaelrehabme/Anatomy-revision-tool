/**
 * Applies src/scripts/data/jointHotspotTrims.json to the published joint hotspots.
 *
 * Only the image ids listed there are touched, and each was checked by eye
 * first (src/scripts/renderHotspotOverlay.ts draws a band over its own plate). Re-running
 * jointLineHotspots.ts would re-trace every band instead: the tracing has moved
 * on since these were generated and comes out about a tenth smaller, which is a
 * change to make deliberately, not as a side effect of removing two specks.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const F = 'src/features/anatomy-revision/data/seed/hotspots.joints.generated.ts';
const { trims } = JSON.parse(readFileSync('src/scripts/data/jointHotspotTrims.json', 'utf8'));

const ringArea = (ring) => {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
};
const centre = (ring) => [
  ring.reduce((s, p) => s + p[0], 0) / ring.length,
  ring.reduce((s, p) => s + p[1], 0) / ring.length,
];

const raw = readFileSync(F, 'utf8');
const crlf = raw.includes('\r\n');
let src = raw.replace(/\r\n/g, '\n');

for (const trim of trims) {
  const pattern = new RegExp(
    `('${trim.imageId}':[\\s\\S]*?polygons: )(\\[\\[\\[[\\s\\S]*?\\]\\]\\])(,\\n\\s*area: )([0-9.e-]+)(,\\n\\s*centroid: )\\[([0-9.e-]+), ([0-9.e-]+)\\]`,
  );
  const found = src.match(pattern);
  if (!found) {
    console.log(`no hotspot found for ${trim.imageId}`);
    continue;
  }
  const rings = JSON.parse(found[2]).map((r) => ({ r, a: ringArea(r), c: centre(r) }));
  const main = rings.reduce((a, b) => (b.a > a.a ? b : a));
  const kept = rings.filter(
    (m) =>
      m === main ||
      m.a >= main.a * trim.smallerThanMainShare ||
      Math.hypot(m.c[0] - main.c[0], m.c[1] - main.c[1]) < trim.dropRingsFartherThan,
  );
  const total = rings.reduce((s, m) => s + m.a, 0);
  const after = kept.reduce((s, m) => s + m.a, 0);
  const area = Number(found[4]) * (after / total);
  const cx = kept.reduce((s, m) => s + m.c[0] * m.a, 0) / after;
  const cy = kept.reduce((s, m) => s + m.c[1] * m.a, 0) / after;
  src = src.replace(
    pattern,
    `$1${JSON.stringify(kept.map((m) => m.r))}$3${area}$5[${cx}, ${cy}]`,
  );
  // The line inside a dropped ring goes with it, or the speck is still drawn
  // as a bullseye and still scores. Each core ring belongs to the ring whose
  // centre is nearest its own.
  const corePattern = new RegExp(`('${trim.imageId}':[\\s\\S]*?targetCore: )(\\[\\[\\[[\\s\\S]*?\\]\\]\\])(,\\n)`);
  const core = src.match(corePattern);
  const entryEnd = src.indexOf('\n  ],', src.indexOf(`'${trim.imageId}':`));
  if (core && core.index < entryEnd) {
    const nearest = (c) => rings.reduce((a, b) => (Math.hypot(b.c[0] - c[0], b.c[1] - c[1]) < Math.hypot(a.c[0] - c[0], a.c[1] - c[1]) ? b : a));
    const keptCore = JSON.parse(core[2]).filter((r) => kept.includes(nearest(centre(r))));
    src = src.replace(corePattern, `$1${JSON.stringify(keptCore)}$3`);
  }
  console.log(
    `${trim.imageId}: ${rings.length} -> ${kept.length} rings, ` +
      `${(Number(found[4]) * 100).toFixed(2)}% -> ${(area * 100).toFixed(2)}% of the frame`,
  );
}

writeFileSync(F, crlf ? src.replace(/\n/g, '\r\n') : src);
