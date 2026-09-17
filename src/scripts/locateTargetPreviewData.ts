import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ALL_IMAGES } from '../features/anatomy-revision/data/seed';

/**
 * Packs the locate targets for a review page.
 *
 *   npx tsx src/scripts/locateTargetPreviewData.ts --out locate-target-preview.data.json
 *
 * Two questions are being asked of the reviewer, and the page cannot answer
 * either on its own.
 *
 * FIRST, does the archery face read? The rings are now drawn where the scoring
 * actually is, so a tap inside the green can no longer come back "not quite"
 * with nothing to show for it. That only has to be looked at.
 *
 * SECOND, WHERE DOES EACH RIDGE RUN? A landmark's `.j` anchor is a single
 * point — 1,221 of the atlas's 1,228 anchors carry two vertices or fewer (see
 * generateSkeletalMapping.ts) — so nothing in the model knows that the iliac
 * crest is 25cm of curve rather than a dot. The axis cannot be derived; it has
 * to be authored. Rather than guess one here and dress it up as a proposal,
 * the page hands the reviewer draggable handles and exports where they put
 * them. That export is the input to the renderer's axis table.
 *
 * Images go in as data URIs because a published page cannot fetch from disk.
 * That is also why this is a subset by default: 146 targets at full size would
 * not fit on one page.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SPEC = join(ROOT, 'landmark-markers.spec.json');
const RENDERS = join(ROOT, 'renders/landmarks');

/**
 * The default subjects: the three the complaint named, plus a point landmark
 * as a control and the other ridges most likely to need an axis. Override with
 * --subjects a,b,c or take everything with --all.
 */
const DEFAULT_SUBJECTS = [
  'femoral-neck',
  'linea-aspera',
  'iliac-crest',
  'greater-trochanter',
  'intertrochanteric-line',
  'spine-of-scapula',
  'tibial-crest',
  'median-sacral-crest',
  'intertubercular-sulcus',
  'vertebral-body',
];

/**
 * Names that READ as a line. Not a decision — a shortlist for the reviewer,
 * because the word lies often enough that it cannot be one: "spine" catches
 * the spine of the scapula (a ridge a hand long) and the ASIS (a point you can
 * put a thumb on) with equal confidence, and misses "linea aspera" entirely.
 */
const LINEAR_WORDS = /\b(crest|line|linea|aspera|ridge|border|margin|groove|sulcus|shaft)\b/i;
/** Names that read as a flat region, where neither a dot nor a capsule fits. */
const SURFACE_WORDS = /\b(surface|fossa|ala|plateau|body|arch)\b/i;

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const next = argv[i + 1];
    out[argv[i].slice(2)] = next && !next.startsWith('--') ? next : 'true';
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const outPath = join(ROOT, args.out ?? 'locate-target-preview.data.json');
const width = Number(args.width ?? '620');
const quality = Number(args.quality ?? '72');
const subjects = args.all === 'true' ? null : new Set((args.subjects ?? DEFAULT_SUBJECTS.join(',')).split(','));

const spec = JSON.parse(readFileSync(SPEC, 'utf8'));
const specById = new Map<string, any>(spec.landmarks.map((l: any) => [l.id, l]));

interface Row {
  imageId: string;
  structureId: string;
  name: string;
  view: string;
  /** How it is actually graded, which is decided by the shape of the data. */
  kind: 'point' | 'capsule' | 'region';
  /** The traced outline or capsule parts; what a tap is tested against. */
  polygons: number[][][];
  /** Present for a capsule: the spine the rings measure from. */
  targetAxis?: number[][];
  /** Present for a region: the anatomy itself, inside the grown hitbox. */
  targetCore?: number[][][];
  targetTwins?: number[][][];
  /** What the name suggests it is. The reviewer decides, this only sorts the list. */
  suspectedShape: 'point' | 'linear' | 'surface';
  sizeNote?: string;
  /** The landmark's real half-size in metres, per the spec's size class. */
  radiusMetres?: number;
  /** How many metres across the picture is, so a length on screen can be read in mm. */
  frameSize?: number;
  centroid: [number, number];
  /** Absent for a traced region: there is no radius, only an outline. */
  targetRadius?: number;
  /** True when the target already runs off the edge of its own picture. */
  clipped: boolean;
  uri: string;
}

const rows: Row[] = [];
const POINT_ALTERNATES = new Set<string>([]);
const VIEW_KEY_NAMES: Record<string, string> = {
  'view-00': 'anterior', 'view-06': 'lateral', 'view-12': 'posterior', 'view-18': 'medial', 'view-top': 'superior',
};

for (const image of ALL_IMAGES) {
  // Landmarks only, but ALL of them now — a traced region carries no
  // targetRadius, so filtering on one would silently drop exactly the
  // landmarks this review exists to check.
  if (!image.id.startsWith('landmark-')) continue;
  for (const hotspot of image.hotspots ?? []) {
    const r = hotspot.targetRadius;
    if (subjects && !subjects.has(hotspot.structureId)) continue;
    const kind = r ? (hotspot.targetAxis && hotspot.targetAxis.length > 1 ? 'capsule' : 'point') : 'region';

    const src = join(ROOT, 'public', image.filePath.replace(/^\//, ''));
    if (!existsSync(src)) {
      console.warn(`[skip] ${image.id}: no image at ${src}`);
      continue;
    }

    const entry = specById.get(hotspot.structureId);
    const name = entry?.name ?? hotspot.structureId;
    const suspectedShape = LINEAR_WORDS.test(name)
      ? 'linear'
      : SURFACE_WORDS.test(name)
        ? 'surface'
        : 'point';

    // frameSize says how many metres the picture spans, which is the only way
    // a length dragged on screen can be reported back in millimetres.
    let frameSize: number | undefined;
    const metaPath = join(RENDERS, hotspot.structureId, 'meta.json');
    if (existsSync(metaPath)) {
      const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
      const parentSize = meta.parentSize ?? (meta.snapFraction ? meta.snapDistance / meta.snapFraction : undefined);
      const radius = meta.radius ?? entry?.radius;
      frameSize =
        meta.frameSize ??
        (parentSize && radius
          ? Math.max(Math.min(Math.max(radius * 25, parentSize * 0.35), parentSize * 0.9), 0.05)
          : undefined);
    }

    const buf = await sharp(src).resize({ width }).jpeg({ quality }).toBuffer();

    rows.push({
      imageId: image.id,
      structureId: hotspot.structureId,
      name,
      view: image.view,
      suspectedShape,
      sizeNote: entry?.sizeNote,
      radiusMetres: entry?.radius,
      frameSize,
      centroid: hotspot.centroid,
      targetRadius: r,
      kind,
      polygons: hotspot.polygons,
      targetAxis: hotspot.targetAxis,
      targetCore: hotspot.targetCore,
      targetTwins: hotspot.targetTwins,
      clipped: r
        ? hotspot.centroid[0] - r < 0 ||
          hotspot.centroid[0] + r > 1 ||
          hotspot.centroid[1] - r < 0 ||
          hotspot.centroid[1] + r > 1
        : hotspot.polygons.flat().some(([x, y]) => x <= 0.002 || x >= 0.998 || y <= 0.002 || y >= 0.998),
      uri: `data:image/jpeg;base64,${buf.toString('base64')}`,
    });

    // THE SAME PICTURE, GRADED THE OTHER WAY, for a landmark the reviewer asked
    // to compare ("it's right, but I'd like to see it as a point as well").
    // A review-page row only: nothing in the app reads it. Centre and size come
    // from the render's own metadata, scaled exactly as publishLandmarks does.
    if (POINT_ALTERNATES.has(hotspot.structureId) && kind !== 'point' && frameSize && entry?.radius) {
      const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
      const viewKey = Object.keys(meta.views).find((k) => VIEW_KEY_NAMES[k] === image.view);
      const mv = viewKey ? meta.views[viewKey] : undefined;
      if (mv) {
        const zone = Math.max(entry.radius / frameSize, 55 / 1400);
        rows.push({
          ...rows[rows.length - 1],
          imageId: `${image.id}--as-point`,
          view: `${image.view} · as a point`,
          kind: 'point',
          centroid: [mv.u, mv.v],
          targetRadius: zone * 2.5,
          polygons: [],
          targetAxis: undefined,
          targetCore: undefined,
          targetTwins: mv.twin?.visible ? [[[mv.twin.u, mv.twin.v]]] : undefined,
          clipped: false,
        });
      }
    }
  }
}

rows.sort((a, b) => a.name.localeCompare(b.name) || a.view.localeCompare(b.view));
writeFileSync(outPath, JSON.stringify(rows));
// The page loads this as a plain script rather than fetching the JSON: an
// artifact serves its own files, but a global needs no request and no
// error path for one that fails.
// What was done about each flagged structure, shown on the card beside the
// reviewer's own note.
const changes = existsSync('landmark-review-changes.json')
  ? JSON.parse(readFileSync('landmark-review-changes.json', 'utf8'))
  : {};
writeFileSync(
  outPath.replace(/\.json$/, '.js'),
  `window.__TARGETS__=${JSON.stringify(rows)};window.__CHANGES__=${JSON.stringify(changes)};`,
);

const mb = (JSON.stringify(rows).length / 1024 / 1024).toFixed(2);
console.log(`[preview] ${rows.length} target(s) -> ${outPath} (${mb} MB)`);
for (const shape of ['linear', 'surface', 'point'] as const) {
  const n = rows.filter((r) => r.suspectedShape === shape).length;
  console.log(`  ${shape}: ${n}`);
}
const clipped = rows.filter((r) => r.clipped);
if (clipped.length) console.log(`  already clipped by the frame: ${clipped.map((r) => r.imageId).join(', ')}`);
