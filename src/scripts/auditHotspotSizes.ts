/**
 * Lists the hitboxes that are too big, per family, so they can be re-framed
 * or re-traced. See lib/hotspotSizeAudit.ts for the thresholds and why.
 *
 * Usage:
 *   npx tsx src/scripts/auditHotspotSizes.ts
 *   npx tsx src/scripts/auditHotspotSizes.ts --family landmark
 *   npx tsx src/scripts/auditHotspotSizes.ts --over 0.1        # everything over 10%, ignoring the per-family rules
 *   npx tsx src/scripts/auditHotspotSizes.ts --json > audit.json
 *
 * validateContent runs the same audit and warns with a per-family summary;
 * this is the full list.
 */
import { ALL_IMAGES } from '../features/anatomy-revision/data/seed';
import { attachHotspots } from '../features/anatomy-revision/data/seed/hotspots';
import { auditHotspotSizes, familyOf, type HotspotFamily } from './lib/hotspotSizeAudit';

await attachHotspots();

const args = process.argv.slice(2);
const flag = (name: string) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
};
const family = flag('family') as HotspotFamily | undefined;
const over = flag('over') !== undefined ? Number(flag('over')) : undefined;
const json = args.includes('--json');

const audit = auditHotspotSizes(ALL_IMAGES);

let offenders = audit.offenders;
if (over !== undefined) {
  offenders = ALL_IMAGES.flatMap((image) =>
    (image.hotspots ?? [])
      .filter((h) => h.area > over)
      .map((h) => ({
        imageId: image.id,
        structureId: h.structureId,
        family: familyOf(image.id),
        area: h.area,
        targetRadius: h.targetRadius,
        coreShare: undefined,
        reason: `covers ${(h.area * 100).toFixed(1)}% of the frame`,
      })),
  ).sort((a, b) => b.area - a.area);
}
if (family) offenders = offenders.filter((o) => o.family === family);

if (json) {
  console.log(JSON.stringify({ families: audit.families, offenders }, null, 2));
} else {
  console.log('family     count  median   p90     max   over');
  for (const [name, stats] of Object.entries(audit.families)) {
    if (family && name !== family) continue;
    console.log(
      `${name.padEnd(10)} ${String(stats.count).padStart(5)}  ${(stats.median * 100).toFixed(2).padStart(6)}%  ${(stats.p90 * 100).toFixed(1).padStart(5)}%  ${(stats.max * 100).toFixed(1).padStart(5)}%  ${String(stats.offenders).padStart(4)}`,
    );
  }
  console.log('');
  console.log(`${offenders.length} hitbox(es) over the line${family ? ` in ${family}` : ''}${over !== undefined ? ` (area > ${over})` : ''}:`);
  for (const o of offenders) {
    console.log(`  ${o.imageId.padEnd(52)} ${o.structureId.padEnd(34)} ${(o.area * 100).toFixed(1).padStart(5)}%  ${o.reason}`);
  }
}
