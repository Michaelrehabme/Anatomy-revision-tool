import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { maskToPolygons } from './lib/maskToPolygons';

/**
 * Publishes the landmark images and their target hotspots.
 *
 *   npx tsx src/scripts/publishLandmarks.ts --masks renders/landmarks
 *
 * A landmark is a point, not a shape, so its hotspot is a circle rather than a
 * traced silhouette — the same circle the archery scoring aims at. Its radius
 * is the landmark's REAL size: the model is life-size, so a 20mm trochanter
 * gets a bigger target than an 8mm tuberosity, which is what makes the scoring
 * fair rather than arbitrary.
 *
 * ONLY VIEWS THAT SHOW IT. renderLandmarkMarkers.py casts a ray per view and
 * records whether the landmark is on the near side of its bone. A view where it
 * is not is never published: a target drawn over the far face of a bone asks a
 * student to click a surface they cannot see.
 *
 * The whole target is 2.5x the landmark's radius, so the inner 40% — rings 10
 * to 7 of the archery face — is the landmark itself and everything outside it
 * is a near miss. A floor applies: on a phone the smallest landmarks come out
 * under a fingertip, and a target no finger can hit fairly is not a question.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OUT_DIR = `${ROOT}/public/anatomy/landmarks`;
const OUT_HOTSPOTS = `${ROOT}/src/features/anatomy-revision/data/seed/hotspots.landmarks.generated.ts`;
const OUT_PANELS = `${ROOT}/src/features/anatomy-revision/data/seed/landmarkPanels.generated.ts`;

const VIEW_NAMES: Record<string, string> = {
  'view-00': 'anterior',
  'view-06': 'lateral',
  'view-12': 'posterior',
  // Looking straight down. A single vertebra is rendered on its own from
  // above and from the side — the reviewer's rule, because a pedicle in a
  // stack of vertebrae is unidentifiable and a pedicle from above is obvious.
  'view-top': 'superior',
  // From the inner side — for a feature like the sustentaculum tali, a shelf
  // on the medial calcaneus that the standard three angles never show.
  'view-18': 'medial',
};

/**
 * A LINE IS EASY TO HIT ALONG ITS LENGTH, so it does not need the fingertip
 * floor a point does. Giving the tibial crest the point floor made its rings
 * as wide as the tibia — "the hitbox for 10/10 takes up the whole tibia" — when
 * the crest is 8mm across. A capsule's rings are sized from the ridge's real
 * half-width with a much smaller floor and a tighter halo.
 */
const CAPSULE_MIN_ZONE_PX = 28;
const CAPSULE_MULTIPLE = 1.8;

/** Render pixels. ~15 CSS px of radius on a phone: a fingertip-sized zone. */
const MIN_ZONE_PX = 55;
/** The near-miss halo: the whole target against the landmark's own radius. */
const TARGET_MULTIPLE = 2.5;
/** A circle is emitted as a polygon; 28 sides is smooth at any size shipped. */
const CIRCLE_SIDES = 28;

/**
 * The longest run of a spine whose halo stays on the picture. The framing
 * guarantee fits the landmark's anchor, but a capsule is a line the length of
 * a crest and its halo can still run off the edge — half a target nobody can
 * tap. Shortens the spine rather than clipping it.
 */
function fitSpine(axis: number[][], rN: number): number[][] {
  let best: number[][] = [];
  let run: number[][] = [];
  for (const [x, y] of axis) {
    if (x >= rN && x <= 1 - rN && y >= rN && y <= 1 - rN) {
      run.push([Number(x.toFixed(5)), Number(y.toFixed(5))]);
    } else {
      if (run.length > best.length) best = run;
      run = [];
    }
  }
  return run.length > best.length ? run : best;
}

/**
 * A disc at every vertex plus a quad along every segment. `polygons` is
 * multi-part and pointInAnyPolygon ORs the rings, so their union is the
 * capsule exactly — no hull and no boolean ops.
 */
function capsuleParts(spine: number[][], rN: number): number[][][] {
  const parts: number[][][] = spine.map(([cx, cy]) => {
    const disc: number[][] = [];
    for (let i = 0; i < CIRCLE_SIDES; i++) {
      const t = (i / CIRCLE_SIDES) * Math.PI * 2;
      disc.push([Number((cx + rN * Math.cos(t)).toFixed(5)), Number((cy + rN * Math.sin(t)).toFixed(5))]);
    }
    return disc;
  });
  for (let i = 0; i < spine.length - 1; i++) {
    const [x0, y0] = spine[i];
    const [x1, y1] = spine[i + 1];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * rN;
    const ny = (dx / len) * rN;
    parts.push([
      [Number((x0 + nx).toFixed(5)), Number((y0 + ny).toFixed(5))],
      [Number((x1 + nx).toFixed(5)), Number((y1 + ny).toFixed(5))],
      [Number((x1 - nx).toFixed(5)), Number((y1 - ny).toFixed(5))],
      [Number((x0 - nx).toFixed(5)), Number((y0 - ny).toFixed(5))],
    ]);
  }
  return parts;
}

/** How far apart two spines are at their middles; a twin on top of its original is not a twin. */
function spineGap(a: number[][], b: number[][]): number {
  const ma = a[Math.floor(a.length / 2)];
  const mb = b[Math.floor(b.length / 2)];
  return Math.hypot(ma[0] - mb[0], ma[1] - mb[1]);
}

let twinViews = 0;

/** The mask with every connected patch smaller than `minPx` removed. */
function keepComponents(bits: Uint8Array, w: number, h: number, minPx: number): Uint8Array {
  const out = new Uint8Array(bits.length);
  const seen = new Uint8Array(bits.length);
  for (let start = 0; start < bits.length; start++) {
    if (!bits[start] || seen[start]) continue;
    const patch: number[] = [start];
    seen[start] = 1;
    for (let k = 0; k < patch.length; k++) {
      const i = patch[k];
      const x = i % w;
      const y = (i - x) / w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && bits[j] && !seen[j]) {
          seen[j] = 1;
          patch.push(j);
        }
      }
    }
    if (patch.length >= minPx) for (const i of patch) out[i] = 1;
  }
  return out;
}
/**
 * A traced region's mask is blurred by this many pixels before thresholding.
 *
 * THIS IS WHERE A REGION'S EDGE BECOMES A LINE. The region is chosen face by
 * face on the mesh, so its boundary wobbles in and out at the scale of one
 * triangle however fine the mesh is. Smoothing the rendered mask fixes that
 * where it matters and cannot thin a narrow ridge, which eroding the selection
 * in 3D would.
 */
const MASK_BLUR = 7;
/**
 * Below this share of the frame a traced region is not a fair target: it is a
 * ridge seen edge-on, a few pixels wide, and no finger can hit it.
 */
const MIN_REGION_SHARE = 0.0035;
/**
 * How far a traced region's HITBOX is grown beyond the anatomy, in metres.
 *
 * PERFECT VERSUS GOOD. A region used to grade by containment alone: inside is
 * right, outside is wrong. So making a thin ridge tappable also stopped it
 * telling a tap ON the crest from a tap NEAR it — the very distinction the
 * rings give a point target. The traced outline is now the CORE, the real
 * anatomy and full marks; this much beyond it still passes, at a lower score.
 */
const HITBOX_GROW_M = 0.006;
/** ...and never less than this, or a hairline ridge is still unhittable. */
const MIN_HITBOX_GROW_PX = 16;

/** Grows a binary mask by `radius` pixels — a square-kernel dilation, run separably. */
function dilateMask(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  let src = mask;
  for (const horizontal of [true, false]) {
    const out = new Uint8Array(src.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let on = 0;
        for (let d = -radius; d <= radius && !on; d++) {
          const nx = horizontal ? x + d : x;
          const ny = horizontal ? y : y + d;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (src[ny * width + nx]) on = 1;
        }
        out[y * width + x] = on;
      }
    }
    src = out;
  }
  return src;
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const masksRoot = join(ROOT, args.masks ?? 'renders/landmarks');
const specPath = join(ROOT, args.spec ?? 'landmark-markers.spec.json');
const quality = Number(args.quality ?? '82');

if (!existsSync(masksRoot)) {
  console.error(`No renders at ${masksRoot} — run renderLandmarkMarkers.py first.`);
  process.exit(1);
}

const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const specById = new Map<string, any>(spec.landmarks.map((l: any) => [l.id, l]));

/**
 * THIS SCRIPT REBUILDS THE WHOLE SEED, not the part it was pointed at. Run
 * against a directory holding a handful of test renders it will happily
 * publish a four-landmark atlas over the real one — which is exactly what
 * happened once, silently, and was only caught by counting lines in the output.
 * Refuse unless the renders cover most of the spec, or --partial says it is
 * deliberate.
 */
const axesPath = join(ROOT, args.axes ?? 'landmark-axes.json');
const AXES: Record<string, Record<string, number[][]>> = existsSync(axesPath)
  ? Object.fromEntries(
      Object.entries(JSON.parse(readFileSync(axesPath, 'utf8'))).filter(([k]) => !k.startsWith('_')),
    )
  : {};

const rendered = readdirSync(masksRoot).filter((d) => existsSync(join(masksRoot, d, 'meta.json')));
const coverage = rendered.length / Math.max(1, spec.landmarks.length);
if (coverage < 0.5 && args.partial !== 'true') {
  console.error(
    `${masksRoot} holds ${rendered.length} rendered landmark(s) against ${spec.landmarks.length} in the spec.\n` +
      `Publishing would replace the whole seed with that subset. Re-render everything, or pass --partial true if you mean it.`,
  );
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

interface Row { structureId: string; name: string; region: string; subregion: string; view: string; width: number; height: number }
const rows: Row[] = [];
const hotspots: Record<string, unknown[]> = {};
const skipped: string[] = [];
/** Views a traced region was too small or too thin to publish on. */
const hidden: string[] = [];
/** Capsules whose spine ran past the frame edge and was shortened to fit. */
const trimmedSpines: string[] = [];
let floored = 0;
/** Which targets were raised, so a teaching regression is named rather than counted. */
const flooredNames: string[] = [];
let regionViews = 0;
let capsuleViews = 0;

for (const id of readdirSync(masksRoot).sort()) {
  const metaPath = join(masksRoot, id, 'meta.json');
  if (!existsSync(metaPath)) continue;
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  const entry = specById.get(id);
  if (!entry) {
    skipped.push(`${id}: not in the spec`);
    continue;
  }

  // The renderer records frameSize; older runs do not, so it is recomputed the
  // same way rather than guessed — the two must agree or every radius is wrong.
  const parentSize = meta.parentSize ?? meta.snapDistance / meta.snapFraction;
  const radius = meta.radius ?? entry.radius;
  const frameSize =
    meta.frameSize ?? Math.max(Math.min(Math.max(radius * 25, parentSize * 0.35), parentSize * 0.9), 0.05);

  for (const [viewDir, view] of Object.entries(VIEW_NAMES)) {
    const v = meta.views?.[viewDir];
    // A TRACED REGION IGNORES THE RAY-CAST VISIBILITY FLAG. Its mask is
    // rendered with the whole skeleton in the scene, so a region behind a bone
    // simply does not appear — which is a better judge than a tolerance, and
    // is what finally stops the linea aspera being published on the anterior
    // view of a femur that is standing in front of it.
    const isRegion = Boolean(meta.region && v?.mask);
    if (!v || (!isRegion && !v.visible)) continue;

    const src = join(masksRoot, id, `${viewDir}.png`);
    if (!existsSync(src)) continue;

    let traced: ReturnType<typeof maskToPolygons> | null = null;
    let core: ReturnType<typeof maskToPolygons> | null = null;
    if (isRegion) {
      const maskPath = join(masksRoot, id, `${viewDir.replace('view', 'mask')}.png`);
      if (!existsSync(maskPath)) continue;
      const { data, info: mi } = await sharp(maskPath)
        .greyscale()
        .blur(MASK_BLUR)
        .raw()
        .toBuffer({ resolveWithObject: true });
      let bits = new Uint8Array(mi.width * mi.height);
      let on = 0;
      for (let i = 0; i < bits.length; i++) {
        if (data[i * mi.channels] > 128) {
          bits[i] = 1;
          on++;
        }
      }
      if (on === 0) {
        hidden.push(`${id} ${view}: nothing of the region is visible from here`);
        continue;
      }

      // A LANDMARK THAT IS A GAP. The obturator foramen is not bone; it is
      // the hole the bone makes. The renderer masks the whole bone, and the
      // target is whatever background lies ENCLOSED inside that silhouette —
      // found by flooding the background in from the picture's edge and
      // keeping what the flood cannot reach. A view where another bone
      // crosses the rim opens the gap to the outside, and it is dropped:
      // that is a real occlusion, and the right answer.
      if (meta.hole) {
        const w = mi.width;
        const h = mi.height;
        const reached = new Uint8Array(bits.length);
        const stack: number[] = [];
        const push = (i: number) => {
          if (!bits[i] && !reached[i]) {
            reached[i] = 1;
            stack.push(i);
          }
        };
        for (let x = 0; x < w; x++) {
          push(x);
          push((h - 1) * w + x);
        }
        for (let y = 0; y < h; y++) {
          push(y * w);
          push(y * w + w - 1);
        }
        while (stack.length) {
          const i = stack.pop()!;
          const x = i % w;
          const y = (i - x) / w;
          if (x > 0) push(i - 1);
          if (x < w - 1) push(i + 1);
          if (y > 0) push(i - w);
          if (y < h - 1) push(i + w);
        }
        const gap = new Uint8Array(bits.length);
        let gapPx = 0;
        for (let i = 0; i < bits.length; i++) {
          if (!bits[i] && !reached[i]) {
            gap[i] = 1;
            gapPx++;
          }
        }
        if (gapPx === 0) {
          hidden.push(`${id} ${view}: the gap is not enclosed from here — something crosses its rim`);
          continue;
        }
        bits = gap;
        on = gapPx;
      }
      // DROP THE SPECKS BEFORE GROWING ANYTHING. Blurring and thresholding a
      // silhouette leaves the odd enclosed pixel in a concave corner, and the
      // trace ignores those — but the hitbox is grown from the raw bits, so
      // each speck became a fingertip-sized square of "correct" floating
      // beside the transverse process.
      const minComponentPx = typeof meta.minComponentPx === 'number' ? meta.minComponentPx : 400;
      bits = keepComponents(bits, mi.width, mi.height, minComponentPx);
      on = 0;
      for (let i = 0; i < bits.length; i++) on += bits[i];
      if (on === 0) {
        hidden.push(`${id} ${view}: nothing of the region is big enough to trace`);
        continue;
      }
      // A smaller epsilon than the joint traces use: the reviewer called the
      // first outlines "too geometric", and on a head the straight segments of
      // a coarse simplification read as facets on something that is a sphere.
      const traceOpts = { minComponentPx, epsilon: 1.2, maxVertices: 220 };
      core = maskToPolygons(bits, mi.width, mi.height, traceOpts);
      if (!core.polygons.length) {
        hidden.push(`${id} ${view}: mask traced to nothing`);
        continue;
      }
      const growPx = Math.max(Math.round(HITBOX_GROW_M * (mi.width / frameSize)), MIN_HITBOX_GROW_PX);
      const grown = dilateMask(bits, mi.width, mi.height, growPx);
      // TAPPABILITY IS A PROPERTY OF THE HITBOX, not of the anatomy inside it.
      // Testing the core instead dropped a region for being thin even when the
      // grown outline around it was perfectly easy to hit — and widening the
      // frame for legibility made every core a smaller share of the picture,
      // so the wrong test turned a framing improvement into lost questions.
      let grownPx = 0;
      for (let i = 0; i < grown.length; i++) grownPx += grown[i];
      if (grownPx / grown.length < MIN_REGION_SHARE) {
        hidden.push(
          `${id} ${view}: hitbox covers ${((grownPx / grown.length) * 100).toFixed(2)}% — too small to tap`,
        );
        continue;
      }
      traced = maskToPolygons(grown, mi.width, mi.height, traceOpts);
      if (!traced.polygons.length) traced = core;
    }

    const dest = join(OUT_DIR, `${id}-${view}.webp`);
    const info = await sharp(src).flatten({ background: '#ffffff' }).webp({ quality }).toFile(dest);

    const pxPerMetre = info.width / frameSize;
    const rawZone = radius * pxPerMetre;
    const zone = Math.max(rawZone, MIN_ZONE_PX);
    // Only a circle target can be floored; a traced region has no radius to raise.
    if (rawZone < MIN_ZONE_PX && !traced) {
      floored++;
      flooredNames.push(`${id} ${view}: pass zone ${((MIN_ZONE_PX / pxPerMetre) * 1000).toFixed(1)}mm against a real ${(radius * 1000).toFixed(1)}mm`);
    }
    // A landmark that is a hole wants its pass zone to BE the hole and the
    // near-miss halo kept tight around it — "make the 10/10 ring the size of
    // the gap and shrink the outer rings" — so the spec may narrow the halo.
    const targetPx = zone * (typeof entry.targetMultiple === 'number' ? entry.targetMultiple : TARGET_MULTIPLE);
    const rN = targetPx / info.width;

    const ring: number[][] = [];
    for (let i = 0; i < CIRCLE_SIDES; i++) {
      const a = (i / CIRCLE_SIDES) * Math.PI * 2;
      ring.push([
        Number((v.u + rN * Math.cos(a)).toFixed(5)),
        Number((v.v + rN * Math.sin(a)).toFixed(5)),
      ]);
    }

    // A hand-drawn spine turns the circle into a CAPSULE: the same ten rings,
    // measured from the line instead of from a point, so the whole ridge scores
    // rather than just its middle. See lib/hotspot/accuracy.ts.
    // A capsule the RENDERER derived: the 3-D centre-line of a crest, projected
    // through the same camera as the picture. Takes priority over a hand-drawn
    // spine, which only exists for landmarks the renderer cannot trace.
    const axis = (v.axis as number[][] | undefined) ?? AXES[id]?.[view];
    if (axis && axis.length > 1) {
      // The rule's own width when the renderer traced this line, else the
      // spec radius for a hand-drawn spine.
      // A width over 5cm is not a ridge's half-width, it is a mistake — a
      // rim rule's `width` is a face-dilation count, and one render wrote it
      // through as metres, which made every spine "not fit the frame".
      const halfWidthM =
        typeof v.axisWidth === 'number' && v.axisWidth > 0 && v.axisWidth < 0.05 ? v.axisWidth : radius;
      // A rule may lower the fingertip floor for one line. The reviewer asked
      // twice for the tibial crest to be thinner: at whole-tibia framing the
      // 28px floor is a 9mm half-width, which IS the whole front of the tibia.
      const minZonePx = typeof v.axisMinZonePx === 'number' ? v.axisMinZonePx : CAPSULE_MIN_ZONE_PX;
      const capsuleZone = Math.max(halfWidthM * pxPerMetre, minZonePx);
      const rN = Number(((capsuleZone * CAPSULE_MULTIPLE) / info.width).toFixed(5));
      // KEEP THE WHOLE CAPSULE ON THE PICTURE. The framing guarantee fits the
      // landmark's anchor, but a capsule is a line the length of a crest and
      // its halo can still run off the edge — which is half a target nobody can
      // tap. Drop the points whose halo would leave the frame and keep the
      // longest run that survives, shortening the spine rather than clipping it.
      const best = fitSpine(axis, rN);
      if (best.length < 2) {
        hidden.push(`${id} ${view}: capsule spine does not fit the frame`);
        continue;
      }
      if (best.length < axis.length) {
        trimmedSpines.push(`${id} ${view}: spine trimmed ${axis.length} → ${best.length} points`);
      }
      const spine = best;
      let length = 0;
      for (let i = 0; i < spine.length - 1; i++) {
        length += Math.hypot(spine[i + 1][0] - spine[i][0], spine[i + 1][1] - spine[i][1]);
      }
      const parts = capsuleParts(spine, rN);
      // THE SAME LINE ON THE OTHER SIDE, when the picture shows it: the far
      // leg's tibial crest is in shot on an anterior view, and tapping it is
      // not a mistake.
      const twinSpine = v.twinAxis ? fitSpine(v.twinAxis as number[][], rN) : [];
      const twins = twinSpine.length > 1 && spineGap(spine, twinSpine) > rN * 0.5 ? [twinSpine] : [];
      for (const t of twins) parts.push(...capsuleParts(t, rN));
      if (twins.length) twinViews++;
      // Length-weighted midpoint, since `centroid` still resolves overlaps.
      const mid = spine[Math.floor(spine.length / 2)];
      hotspots[`landmark-${id}-${view}`] = [
        {
          structureId: id,
          polygons: parts,
          area: 2 * rN * length + Math.PI * rN * rN,
          centroid: [mid[0], mid[1]],
          targetRadius: Number(rN.toFixed(5)),
          targetAxis: spine,
          ...(twins.length ? { targetTwins: twins } : {}),
        },
      ];
      capsuleViews++;
      rows.push({
        structureId: id, name: entry.name, region: entry.region, subregion: entry.subregion,
        view, width: info.width, height: info.height,
      });
      continue;
    }

    if (traced) regionViews++;
    const imageId = `landmark-${id}-${view}`;
    // A POINT WITH A TWIN is two targets. Where the two would overlap they are
    // shrunk until they touch instead — two small targets, one each side, is
    // the reviewer's rule, and a merged blob across the midline would pass a
    // tap on the spinous process as "the lamina".
    let pointR = rN;
    let pointTwin: number[] | null = null;
    if (!traced && v.twin?.visible) {
      const gap = Math.hypot(v.twin.u - v.u, v.twin.v - v.v);
      // Closer than the landmark's own size is the same spot seen twice (a
      // lateral view, where the twin is straight behind), not a second target.
      if (gap > (zone / info.width) * 1.5) {
        pointR = Math.min(rN, gap / 2);
        pointTwin = [Number(v.twin.u.toFixed(5)), Number(v.twin.v.toFixed(5))];
        twinViews++;
      }
    }
    const disc = (cx: number, cy: number) => {
      const out: number[][] = [];
      for (let i = 0; i < CIRCLE_SIDES; i++) {
        const t = (i / CIRCLE_SIDES) * Math.PI * 2;
        out.push([Number((cx + pointR * Math.cos(t)).toFixed(5)), Number((cy + pointR * Math.sin(t)).toFixed(5))]);
      }
      return out;
    };
    hotspots[imageId] = traced
      ? [
          {
            structureId: id,
            polygons: traced.polygons,
            area: traced.area,
            centroid: traced.centroid,
            // The anatomy itself, inside the tappable outline: full marks here,
            // a pass in the margin around it. Omitted when growing the hitbox
            // changed nothing, since an identical core would score every tap 10.
            ...(core && core !== traced ? { targetCore: core.polygons } : {}),
            // NO targetRadius, deliberately. A traced region is a shape, and
            // tapping inside it is simply right — "how close to the middle of
            // the iliac crest" is not a question anyone asks. Its absence is
            // what routes grading through point-in-polygon instead of the
            // archery rings; see lib/hotspot/accuracy.ts.
          },
        ]
      : [
          {
            structureId: id,
            polygons: pointTwin ? [disc(v.u, v.v), disc(pointTwin[0], pointTwin[1])] : [ring],
            area: Math.PI * pointR * pointR * (pointTwin ? 2 : 1),
            centroid: [Number(v.u.toFixed(5)), Number(v.v.toFixed(5))],
            // Marks this as a POINT target, and gives the accuracy scoring the
            // radius it measures against. Everything else on an image is a shape.
            targetRadius: Number(pointR.toFixed(5)),
            ...(pointTwin ? { targetTwins: [[pointTwin]] } : {}),
          },
        ];
    rows.push({
      structureId: id, name: entry.name, region: entry.region, subregion: entry.subregion,
      view, width: info.width, height: info.height,
    });
  }
}

const lines = [
  '/**',
  ' * GENERATED FILE — do not edit by hand.',
  ' *',
  ' * Regenerate with:',
  ' *   npx tsx src/scripts/generateLandmarkSpec.ts --out landmark-markers.spec.json',
  ' *   blender atlas/Z-Anatomy/Startup.blend --background \\',
  ' *     --python src/scripts/blender/renderLandmarkMarkers.py -- \\',
  ' *     --spec landmark-markers.spec.json --out renders/landmarks',
  ' *   npx tsx src/scripts/publishLandmarks.ts',
  ' *',
  ' * Each hotspot is a CIRCLE, not a traced outline: a landmark is a point on a',
  ' * bone, and the target is its real size. The whole circle is 2.5x the',
  " * landmark's radius, so its inner 40% is the landmark and the rest is the",
  ' * near-miss halo the accuracy scoring reads.',
  ' */',
  "import type { HotspotPolygon } from '../../types/image';",
  '',
  'export const LANDMARK_HOTSPOTS: Record<string, HotspotPolygon[]> = {',
];
for (const id of Object.keys(hotspots).sort()) {
  lines.push(`  '${id}': ${JSON.stringify(hotspots[id])},`);
}
lines.push('};', '');
writeFileSync(OUT_HOTSPOTS, lines.join('\n'));

const body = rows
  .map(
    (r) =>
      `  { structureId: '${r.structureId}', name: ${JSON.stringify(r.name)}, ` +
      `region: '${r.region}', subregion: '${r.subregion}', ` +
      `view: '${r.view}', width: ${r.width}, height: ${r.height} },`,
  )
  .join('\n');

writeFileSync(
  OUT_PANELS,
  `import type { ViewType } from '../../types/image';
import type { Region, SubRegion } from '../../types/region';

/**
 * GENERATED — do not edit by hand.
 * Regenerate with: npx tsx src/scripts/publishLandmarks.ts
 *
 * One row per file in public/anatomy/landmarks/. Only views where the landmark
 * is actually on the near side of its bone are here.
 */
export interface LandmarkPanel {
  structureId: string;
  name: string;
  region: Region;
  subregion: SubRegion;
  view: ViewType;
  width: number;
  height: number;
}

export const LANDMARK_PANELS: LandmarkPanel[] = [
${body}
];
`,
);

const distinct = new Set(rows.map((r) => r.structureId)).size;
console.log(`${rows.length} image(s) across ${distinct} landmark(s) -> public/anatomy/landmarks/`);
console.log(`${floored} target(s) raised to the fingertip minimum`);
for (const line of flooredNames) console.log(`  ${line}`);
console.log(`${regionViews} view(s) published as a traced region rather than a circle`);
console.log(`${capsuleViews} view(s) published as a capsule along a spine`);
console.log(`${twinViews} view(s) carry a twin target for the other side`);
if (trimmedSpines.length) {
  console.log(`\n${trimmedSpines.length} capsule(s) shortened to stay on the picture:`);
  for (const t of trimmedSpines) console.log(`  ${t}`);
}
if (hidden.length) {
  console.log(`\n${hidden.length} region view(s) not published:`);
  for (const h of hidden) console.log(`  ${h}`);
}
if (skipped.length) {
  console.log(`\n${skipped.length} skipped:`);
  for (const s of skipped) console.log(`  ${s}`);
}
