import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ALL_STRUCTURES } from '../features/anatomy-revision/data/seed/index';
import { isLigament } from '../features/anatomy-revision/types/structure';
import { LIGAMENT_PLATES } from '../features/anatomy-revision/data/seed/ligamentPlates.generated';

/**
 * Packs the ligament attachment review into one file the review page inlines.
 *
 *   npx tsx src/scripts/ligamentReviewData.ts --out ligament-review.data.json
 *
 * WHY A PICTURE PER ROW. The question being reviewed is "does this ligament
 * really attach to these bones", and the derived evidence is a list of names
 * and percentages. Looking at the strap answers it far faster than reading
 * about it, so every row carries its own best-angle highlight render — the
 * same picture the identify question shows.
 *
 * Everything else comes from the same three surveys the seed was built from,
 * so the page and `docs/ligament-attachments-review.md` cannot drift: the
 * markdown is for reading at a desk, this is for ticking through on a phone.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(`${ROOT}/${p}`, 'utf8'));

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
const outPath = args.out ?? 'ligament-review.data.json';
const width = Number(args.width ?? 420);

const attachments: { ligament: string; attachments: { bone: string; share: number }[] }[] = read('ligament-attachments.json').ligaments;
const visibility: { ligament: string; bestShare: number }[] = read('ligament-visibility.json').ligaments;
const mapping: { id: string; blenderObjects: string[] }[] = read('ta2-mapping-ligaments.resolved.json').mapping;

const baseName = (n: string) => n.replace(/\.(o\d?)?[lr]$/, '');
const structureById = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));

/** Every angle published for a ligament, best (largest target) first. */
const platesFor = new Map<string, typeof LIGAMENT_PLATES>();
for (const p of LIGAMENT_PLATES.filter((p) => p.kind === 'highlight')) {
  platesFor.set(p.structureId, [...(platesFor.get(p.structureId) ?? []), p]);
}
async function pictureFor(id: string): Promise<{ uri: string; view: string } | null> {
  const plates = platesFor.get(id) ?? [];
  // The published angles are already only those where the target traces; the
  // first by angle is as good a representative as any, and anterior-most
  // reads most naturally.
  const plate = plates.sort((a, b) => a.angle - b.angle)[0];
  if (plate) {
    const file = `${ROOT}/public/anatomy/ligaments/${id}-a${String(plate.angle).padStart(3, '0')}-highlight.webp`;
    if (existsSync(file)) {
      const buf = await sharp(file).resize({ width, withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
      return { uri: 'data:image/jpeg;base64,' + buf.toString('base64'), view: plate.view };
    }
  }
  // Nothing published: the ligament is hidden from every angle. Fall back to
  // a raw render so the row still shows what was looked at.
  const dir = `${ROOT}/renders/ligaments-tranche1/${id}`;
  if (!existsSync(dir)) return null;
  const angle = readdirSync(dir).filter((n) => /^a\d{3}$/.test(n)).sort()[0];
  if (!angle || !existsSync(`${dir}/${angle}/highlight.png`)) return null;
  const buf = await sharp(`${dir}/${angle}/highlight.png`)
    .flatten({ background: '#ffffff' })
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality: 78, mozjpeg: true })
    .toBuffer();
  return { uri: 'data:image/jpeg;base64,' + buf.toString('base64'), view: 'unpublished' };
}

const rows: unknown[] = [];
for (const m of mapping) {
  const lig = structureById.get(m.id);
  if (!lig || !isLigament(lig)) continue;

  const derived = new Map<string, number>();
  for (const a of attachments) {
    if (baseName(a.ligament) !== m.name) continue;
    for (const at of a.attachments) {
      if (at.share < 0.05) continue;
      const bone = baseName(at.bone);
      derived.set(bone, Math.max(derived.get(bone) ?? 0, at.share));
    }
  }
  const evidence = [...derived.entries()].sort((a, b) => b[1] - a[1]).map(([bone, share]) => ({ bone, share }));
  const tier = evidence.length === 2 ? 'clean pair'
    : evidence.length === 1 ? 'one bone'
    : evidence.length === 0 ? 'none'
    : evidence.length === 3 && evidence[2].share < 0.15 ? 'pair + trace'
    : 'many';

  const best = Math.max(0, ...visibility.filter((v) => baseName(v.ligament) === m.name).map((v) => v.bestShare));
  const plates = platesFor.get(m.id) ?? [];

  rows.push({
    id: m.id,
    name: lig.name,
    area: lig.subregion,
    tier,
    visibility: best,
    evidence,
    seedIds: lig.attachmentStructureIds,
    seedNames: lig.attachmentStructureIds.map((bid) => structureById.get(bid)?.name ?? bid),
    angles: plates.length,
    picture: await pictureFor(m.id),
  });
}

writeFileSync(`${ROOT}/${outPath}`, JSON.stringify(rows));
const bytes = readFileSync(`${ROOT}/${outPath}`).length;
console.log(`${rows.length} ligament(s) -> ${outPath} (${(bytes / 1024 / 1024).toFixed(2)}MB)`);
const byTier: Record<string, number> = {};
for (const r of rows as { tier: string }[]) byTier[r.tier] = (byTier[r.tier] ?? 0) + 1;
console.log('tiers:', JSON.stringify(byTier));
console.log('without a picture:', (rows as { picture: unknown }[]).filter((r) => !r.picture).length);
