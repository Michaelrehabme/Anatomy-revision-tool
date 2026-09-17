import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';
import { fileURLToPath } from 'node:url';

/**
 * Re-renders the hand and foot panels as a palmar/plantar and a dorsal view of
 * the WHOLE hand or foot.
 *
 *   npx tsx src/scripts/renderHandFootPanels.ts
 *   npx tsx src/scripts/renderHandFootPanels.ts --only abductor-pollicis-brevis
 *
 * WHY THESE PANELS ARE DIFFERENT FROM THE OTHER 155. Every panel frames its own
 * subject with slack, which is right for a deltoid and wrong for opponens
 * digiti minimi: the shot comes out as strips of metacarpal with a red thread
 * between them, from three angles that are never named. A student cannot answer
 * "which structure is shown" without first working out which side of the hand
 * they are looking at, and at that framing there is nothing in the picture that
 * says. The middle of the three views made it worse — 90 degrees round the body
 * is edge-on to a hand and has the pelvis behind it.
 *
 * So: frame on the hand, not on the muscle inside it, and take the two views
 * anyone learning the hand is taught to hold in their head. Palmar and dorsal
 * are recognisable at a glance from the thumb and the carpus, which is the
 * whole point — the picture has to say which face of the hand it is.
 *
 * THE ANGLES ARE MEASURED, NOT ASSUMED. Z-Anatomy stands in anatomical position
 * with the palms forward, so for a hand the two faces are simply azimuth 0 and
 * 180 at eye level — confirmed by rendering opponens pollicis (thenar, palmar)
 * and the dorsal interossei against each other. A foot has no such luck: both
 * faces are hidden from every angle on the horizon, and only elevation reaches
 * them. Plus and minus 55 degrees, measured: below 45 the sole is too oblique
 * to read, and past about 65 the camera is far enough under or over the body to
 * bring the pelvis into frame behind the foot.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const RENDERS = join(ROOT, 'renders', 'hand-foot');
const BLEND = join(ROOT, 'atlas', 'Z-Anatomy', 'Startup.blend');

function blenderExe(): string {
  const tools = join(ROOT, 'tools');
  const dir = readdirSync(tools).find((d) => d.startsWith('blender-'));
  if (!dir) throw new Error('No tools/blender-* — see README, "Regenerating the renders themselves".');
  return join(tools, dir, 'blender.exe');
}

/**
 * Structures that live INSIDE a hand or a foot, as opposed to the forearm and
 * leg muscles that merely act on one. An editorial list rather than a rule,
 * the same call as SUPERFICIAL in generateMusclePanels.ts: flexor digitorum
 * profundus crosses the wrist and reads perfectly well framed on its own belly,
 * while the lumbricals it gives rise to do not.
 *
 * The hand and foot JOINTS are deliberately absent. Their panels highlight the
 * capsules and ligaments that cross a joint rather than the joint line itself,
 * which is a live question elsewhere (renderJointMasks.py, publishJointPanels.ts)
 * and not one to settle as a side effect of changing the camera.
 */
const HAND = {
  muscle: [
    'abductor-digiti-minimi-hand', 'abductor-pollicis-brevis', 'adductor-pollicis',
    'dorsal-interossei-hand', 'flexor-digiti-minimi-brevis-hand', 'flexor-pollicis-brevis',
    'lumbricals-hand', 'opponens-digiti-minimi-hand', 'opponens-pollicis', 'palmar-interossei',
  ],
  skeletal: [
    'carpals', 'capitate', 'hamate', 'lunate', 'pisiform', 'scaphoid', 'trapezium', 'trapezoid',
    'triquetrum', 'metacarpals', 'phalanges-proximal-hand', 'phalanges-middle-hand',
    'phalanges-distal-hand',
  ],
  /** The bones the camera is framed on — the hand itself, wrist to fingertips. */
  frameOn: ['carpals', 'metacarpals', 'phalanges-proximal-hand', 'phalanges-middle-hand', 'phalanges-distal-hand'],
  /**
   * view index (of 24) → the face it shows. Palmar first, so it reads left to right.
   *
   * THE DORSAL VIEW LOOKS SLIGHTLY UP. The fingers curl, so from dead level the
   * distal phalanges of the ring and little fingers tilt away and come out as
   * slivers — which reads as "the fourth and fifth are not highlighted". Fifteen
   * degrees below the horizon looks along the fingers instead of across them and
   * all five read; past about thirty the carpus starts to foreshorten instead.
   */
  views: [
    { label: 'a-palmar--left hand', view: 0, elevation: 0 },
    { label: 'b-dorsal--left hand', view: 12, elevation: -15 },
  ],
};

/**
 * The forearm, which is a THIRD case: not a structure inside a hand, but one
 * long enough that framing it on its own belly frames the body behind it.
 * Flexor carpi radialis shipped as a whole skeleton with a red thread down each
 * arm — the muscle is 2% of the picture and the other 98% is ribs.
 *
 * These frame on the forearm and hand together, so a student sees where the
 * muscle starts, where it crosses the wrist and where it ends, and the backdrop
 * is named rather than inherited: humerus, radius, ulna and the hand. A frame
 * deep enough to reach the elbow is also deep enough to catch the near femur,
 * and the composite trims to whatever is opaque.
 */
const FOREARM = {
  muscle: [
    'abductor-pollicis-longus', 'brachioradialis', 'extensor-carpi-radialis-brevis',
    'extensor-carpi-radialis-longus', 'extensor-carpi-ulnaris', 'extensor-digiti-minimi',
    'extensor-digitorum', 'extensor-indicis', 'extensor-pollicis-brevis', 'extensor-pollicis-longus',
    'flexor-carpi-radialis', 'flexor-carpi-ulnaris', 'flexor-digitorum-profundus',
    'flexor-digitorum-superficialis', 'flexor-pollicis-longus', 'palmaris-longus',
    'pronator-quadratus', 'pronator-teres', 'supinator',
  ],
  skeletal: ['radius', 'ulna'],
  frameOn: ['radius', 'ulna', 'carpals', 'metacarpals', 'phalanges-proximal-hand', 'phalanges-middle-hand', 'phalanges-distal-hand'],
  /** Everything the picture may contain. The humerus is here for the muscles that cross the elbow. */
  backdrop: ['humerus', 'radius', 'ulna', 'carpals', 'metacarpals', 'phalanges-proximal-hand', 'phalanges-middle-hand', 'phalanges-distal-hand'],
  views: [
    { label: 'a-anterior--left forearm', view: 0, elevation: 0 },
    { label: 'b-posterior--left forearm', view: 12, elevation: 0 },
  ],
};

const FOOT = {
  muscle: [
    'abductor-digiti-minimi-foot', 'abductor-hallucis', 'adductor-hallucis', 'dorsal-interossei-foot',
    'extensor-digitorum-brevis', 'extensor-hallucis-brevis', 'flexor-digiti-minimi-brevis-foot',
    'flexor-digitorum-brevis', 'flexor-hallucis-brevis', 'lumbricals-foot',
    'opponens-digiti-minimi-foot', 'plantar-interossei', 'quadratus-plantae',
  ],
  skeletal: [
    'tarsals', 'talus', 'calcaneus', 'navicular', 'cuboid', 'medial-cuneiform',
    'intermediate-cuneiform', 'lateral-cuneiform', 'metatarsals', 'phalanges-proximal-foot',
    'phalanges-middle-foot', 'phalanges-distal-foot',
  ],
  frameOn: ['tarsals', 'metatarsals', 'phalanges-proximal-foot', 'phalanges-middle-foot', 'phalanges-distal-foot'],
  views: [
    { label: 'a-plantar--left foot', view: 0, elevation: -55 },
    { label: 'b-dorsal--left foot', view: 0, elevation: 55 },
  ],
};

/**
 * Muscle red and highlight blue, matching what each family already ships. The
 * bone panels are blue because they were rendered before the muscles moved to
 * red, and making them consistent is a separate batch decision — see the commit
 * "Render muscles in muscle red, not highlight blue".
 */
const FAMILIES = [
  { kind: 'muscle', mapping: 'ta2-mapping.resolved.json', highlight: '0.76,0.27,0.25' },
  { kind: 'skeletal', mapping: 'ta2-mapping-skeletal.resolved.json', highlight: '0.22,0.45,0.72' },
] as const;

/** Half a view's width of empty space between the two faces. */
const GAP = 90;
/**
 * A gutter around each trimmed view.
 *
 * Trimming to the alpha bounding box is what makes the two tiles the same
 * scale, and it also guarantees the subject touches all four edges — a splayed
 * hand then reads as though its outer fingers had been cropped off, when in
 * fact the render has room to spare. Eighteen pixels of nothing is enough to
 * show the tip ends where the bone ends.
 */
const PAD = 18;
/** Room under each view for its two-line caption. */
const CAPTION_BAND = 150;

/**
 * Stitches a structure's two views side by side and names each one underneath.
 *
 * THE CAPTION IS THE POINT, not decoration. A hand from the front and a hand
 * from the back are mirror images of each other to anyone who has not yet
 * learned to read the carpus, and asking "which structure is shown" of a
 * picture whose side the student cannot name is asking two questions and
 * marking one. Naming the face gives away nothing about the answer — every
 * choice in the question is a structure of the same hand.
 *
 * This does its own trimming and composing rather than calling
 * compositePanels.ts, which knows nothing about captions and would trim them
 * off or float them a thousand pixels from the hand they belong to.
 */
async function composeCaptioned(dir: string, out: string): Promise<void> {
  const files = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
  const tiles = await Promise.all(
    files.map(async (f) => {
      const buffer = await sharp(join(dir, f))
        .trim({ threshold: 0 })
        .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      const meta = await sharp(buffer).metadata();
      const [face, side] = labelOf(f);
      return { buffer, width: meta.width ?? 0, height: meta.height ?? 0, face, side };
    }),
  );

  const height = Math.max(...tiles.map((t) => t.height));
  const width = tiles.reduce((n, t) => n + t.width, 0) + GAP * (tiles.length - 1);
  const layers: OverlayOptions[] = [];
  let x = 0;
  for (const tile of tiles) {
    layers.push({ input: tile.buffer, left: x, top: Math.floor((height - tile.height) / 2) });
    layers.push({ input: Buffer.from(caption(tile.face, tile.side, tile.width)), left: x, top: height });
    x += tile.width + GAP;
  }

  await sharp({
    create: { width, height: height + CAPTION_BAND, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite(layers).png().toFile(out);
}

/**
 * "a-palmar--left hand.png" -> ["PALMAR", "LEFT HAND"]. The leading letter orders
 * the two views and is not part of the caption; the double dash separates the
 * face from the side it belongs to. A pipe would have read better and is not a
 * legal Windows filename character.
 */
function labelOf(file: string): [string, string] {
  const [face, side] = file.replace(/\.png$/, '').replace(/^[a-z]-/, '').split('--');
  return [face.toUpperCase(), (side ?? '').toUpperCase()];
}

/**
 * A size that fits the tile the caption sits under.
 *
 * A forearm trims to a tall sliver, so its tiles are half the width a hand gives
 * and a fixed size ran off both ends. Letter-spaced capitals in the fallback
 * sans measure close to one em per character once the tracking is counted, which
 * is near enough to solve for a size and clamp — erring large is what clips, so
 * the estimate is deliberately the pessimistic one.
 */
function fitSize(text: string, width: number, max: number): number {
  return Math.min(max, Math.max(15, Math.floor((width * 0.9) / (text.length * 1.08))));
}

/**
 * The face large, the side under it in small print — which is what tells a
 * student they are looking at a LEFT hand, and the thing the two-line shape
 * exists for. One line carrying both ran out of tile on the forearms.
 *
 * Mid grey rather than near-black or near-white: the panel is transparent and
 * sits on whatever the card is, which is cream in one theme and dark in the other.
 */
function caption(face: string, side: string, width: number): string {
  const faceSize = fitSize(face, width, 44);
  const sideSize = Math.max(14, Math.round(faceSize * 0.62));
  const sideFitted = Math.min(sideSize, fitSize(side, width, sideSize));
  return `<svg width="${width}" height="${CAPTION_BAND}" xmlns="http://www.w3.org/2000/svg">` +
    `<text x="${width / 2}" y="${faceSize + 10}" text-anchor="middle" ` +
    `font-family="DejaVu Sans, Helvetica, sans-serif" font-size="${faceSize}" ` +
    `letter-spacing="${Math.round(faceSize * 0.14)}" fill="#8a8580">${face}</text>` +
    `<text x="${width / 2}" y="${faceSize + sideFitted + 32}" text-anchor="middle" ` +
    `font-family="DejaVu Sans, Helvetica, sans-serif" font-size="${sideFitted}" ` +
    `letter-spacing="${Math.round(sideFitted * 0.14)}" fill="#a8a29a">${side}</text></svg>`;
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

interface MappingEntry { id: string; blenderObjects?: string[] }

async function loadMapping(file: string): Promise<Map<string, string[]>> {
  const raw = await import(`file://${join(ROOT, file)}`, { with: { type: 'json' } });
  const doc = raw.default as { mapping: MappingEntry[] } | MappingEntry[];
  const rows = Array.isArray(doc) ? doc : doc.mapping;
  return new Map(rows.filter((r) => r.blenderObjects?.length).map((r) => [r.id, r.blenderObjects!]));
}

function run(exe: string, args: string[], label: string): void {
  process.stdout.write(`\n[${label}] blender…\n`);
  execFileSync(exe, args, { stdio: ['ignore', 'inherit', 'inherit'], cwd: ROOT });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const only = args.only ? new Set(args.only.split(',')) : null;
  const res = args.res ?? '1400';
  const samples = args.samples ?? '64';
  // Slack around the framing box. 1.4 keeps the wrist or the ankle in shot
  // without reaching the far hand; the per-subject default of 2.4 exists to
  // keep bone around a muscle, and here the bone IS the framing box.
  const margin = args.margin ?? '1.4';
  const exe = blenderExe();

  const skeletal = await loadMapping('ta2-mapping-skeletal.resolved.json');
  // Recomposing is the cheap half of this script: the renders take the best part
  // of an hour and the captioning takes seconds, so a change to the caption or
  // to the gutter should not cost another bake. --recompose 1 keeps the staged
  // renders and picks the run up at composeCaptioned.
  const recompose = Boolean(args.recompose);
  const staging = join(RENDERS, 'staged');
  if (!recompose) rmSync(staging, { recursive: true, force: true });

  const objectsFor = (ids: readonly string[]) =>
    ids.flatMap((id) => {
      const objects = skeletal.get(id);
      if (!objects) throw new Error(`No Blender objects for bone "${id}"`);
      return objects;
    });

  for (const part of recompose ? [] : [HAND, FOREARM, FOOT] as { frameOn: readonly string[]; backdrop?: readonly string[]; muscle: readonly string[]; skeletal: readonly string[]; views: { label: string; view: number; elevation: number }[] }[]) {
    const frameOn = objectsFor(part.frameOn);
    // Only the forearm names one; a hand or a foot is framed tightly enough
    // that dropping the far side is all it takes.
    const backdrop = part.backdrop ? objectsFor(part.backdrop) : null;

    for (const family of FAMILIES) {
      const ids = part[family.kind].filter((id) => !only || only.has(id));
      if (ids.length === 0) continue;

      // Both faces in ONE launch. Baking the skeleton costs about a minute and a
      // render about five seconds, so a launch per view would spend most of the
      // run baking the same bones again.
      //
      // The script renders the CROSS PRODUCT of --views and --elevations, which
      // is exactly the two faces when they differ along one axis — the forearm
      // (two azimuths) and the foot (two elevations) — and four renders when they
      // differ along both, as the hand now does. Two of those four are thrown
      // away. That is still cheaper than a second bake, and the staging below
      // takes each face by name rather than by position, so the waste is time
      // rather than a wrong picture.
      const out = join(RENDERS, family.kind);
      run(exe, [
        '--background', BLEND,
        '--python', join(ROOT, 'src', 'scripts', 'blender', 'renderMusclePanels.py'), '--',
        '--mapping', family.mapping,
        '--out', out,
        '--muscles', ids.join(','),
        '--views', [...new Set(part.views.map((v) => v.view))].join(','),
        // "=" and not a space: argparse reads a leading "-" as another flag.
        `--elevations=${[...new Set(part.views.map((v) => v.elevation))].join(',')}`,
        '--frames', '24',
        '--res', res,
        '--samples', samples,
        '--margin', margin,
        '--highlight', family.highlight,
        '--frame-on', frameOn.join(','),
        ...(backdrop ? ['--backdrop', backdrop.join(',')] : []),
      ], `${family.kind} (${ids.length} structures)`);

      // Stage into a flat <id>/<label>.png layout. composeCaptioned takes a
      // directory's files in sorted order, which is why the labels start "a-"
      // and "b-": the palmar or plantar face has to read first.
      for (const { label, view, elevation } of part.views) {
        const frame = `view-${String(view).padStart(2, '0')}.png`;
        // Elevation 0 keeps the flat layout the other panel families use;
        // anything else gets its own subdirectory. See renderMusclePanels.py.
        const leaf = elevation === 0
          ? [frame]
          : [`elev${elevation > 0 ? '+' : '-'}${String(Math.abs(elevation)).padStart(2, '0')}`, frame];
        for (const id of ids) {
          const src = join(out, id, ...leaf);
          if (!existsSync(src)) {
            console.error(`  [warn] ${id}: no render at ${src}`);
            continue;
          }
          mkdirSync(join(staging, id), { recursive: true });
          copyFileSync(src, join(staging, id, `${label}.png`));
        }
      }
    }
  }

  const composited = join(RENDERS, 'composited');
  mkdirSync(composited, { recursive: true });
  for (const id of readdirSync(staging)) {
    await composeCaptioned(join(staging, id), join(composited, `${id}.png`));
    console.log(`  ${id}`);
  }
  run(exe, [
    '--background', '--factory-startup',
    '--python', join(ROOT, 'src', 'scripts', 'blender', 'toWebp.py'), '--',
    '--in', composited,
    '--out', join(ROOT, 'public', 'anatomy', 'panels'),
    '--quality', '82',
  ], 'webp');

  console.log('\nNow regenerate the panel list so the new dimensions ship:');
  console.log('  npx tsx src/scripts/generateMusclePanels.ts');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
