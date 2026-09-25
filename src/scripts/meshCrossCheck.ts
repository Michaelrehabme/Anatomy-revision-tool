import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ALL_IMAGES, ALL_STRUCTURES } from '../features/anatomy-revision/data/seed';
import { attachHotspots } from '../features/anatomy-revision/data/seed/hotspots';
import { isBone, isJoint, isLandmark } from '../features/anatomy-revision/types/structure';

await attachHotspots();

/**
 * Tier 1 of the source-check: cross-checks the bones, joints and landmarks
 * against things that are already sourced, without fetching anything.
 *
 *   npx tsx src/scripts/meshCrossCheck.ts            # report
 *   npx tsx src/scripts/meshCrossCheck.ts --write    # also write mesh-cross-check.json
 *
 * WHAT IT CHECKS AGAINST, AND WHY THAT IS WORTH ANYTHING. 198 structures were
 * drafted from standard anatomy and checked against no published work. But
 * three things in this repo DO have provenance, and the seed has to agree with
 * them or something is wrong:
 *
 *   1. The Z-Anatomy mesh (CC BY-SA, credited on /attributions). Every joint
 *      line in joint-lines.spec.json is the contact between two NAMED bone
 *      meshes, and every landmark marker in landmark-markers.spec.json is
 *      anchored to a NAMED mesh part. Where the seed disagrees with the model
 *      the pictures are drawn from, the app contradicts its own images.
 *   2. The seed's own internal reciprocity. If the femur says it meets the
 *      acetabulum at the hip joint, hip-joint has to say so too.
 *   3. The structure graph. A joint articulates two things; a landmark belongs
 *      to a bone; neither can name an id that does not exist.
 *
 * WHAT IT EMPHATICALLY DOES NOT DO. This proves COHERENCE, not truth. A model
 * can show two bones touching; touching is not articulating, which is the
 * lesson the ligament round paid for (see the note in
 * ligament-attachment-corrections.pending.json). It cannot tell you whether a
 * landmark is palpable, what a joint does, or whether a clinical claim holds.
 * Those need the literature pass. This is the sweep that comes first because
 * it is free, covers all 198 at once, and catches the class of error that
 * marks a student wrong.
 *
 * NOTHING IS APPLIED AUTOMATICALLY. Findings are written out for a human to
 * adjudicate, for the same reason the ligament corrections were quarantined:
 * an automated correction to unverified content is not evidence.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const WRITE = process.argv.includes('--write');

type Severity = 'error' | 'review' | 'info';

interface Finding {
  check: string;
  severity: Severity;
  id: string;
  what: string;
  /** What a reviewer should do about it — never applied by this script. */
  suggest?: string;
}

const findings: Finding[] = [];
const add = (f: Finding) => findings.push(f);

const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));

/**
 * part id -> whole id, taken from each landmark's own parentBoneId. The
 * acetabulum is a landmark whose parent is the pelvis, so "acetabulum + pelvis"
 * is a whole paired with its own part — which is exactly the mistake the
 * articular-part rule exists to stop.
 */
const partOf = new Map<string, string>();
for (const s of ALL_STRUCTURES.filter(isLandmark)) {
  if (s.parentBoneId) partOf.set(s.id, s.parentBoneId);
}

/** name/alias -> id, longest first, for reading structure names out of prose. */
const nameIndex: [string, string][] = [];
for (const s of ALL_STRUCTURES) {
  for (const n of [s.name, ...(s.aliases ?? [])]) {
    if (n && n.length > 3) nameIndex.push([n.toLowerCase(), s.id]);
  }
}
nameIndex.sort((a, b) => b[0].length - a[0].length);

function structuresNamedIn(text: string, exclude: string): string[] {
  const hay = text.toLowerCase();
  const hits: string[] = [];
  let masked = hay;
  for (const [name, id] of nameIndex) {
    if (id === exclude || hits.includes(id)) continue;
    if (masked.includes(name)) {
      hits.push(id);
      masked = masked.split(name).join(' '.repeat(name.length));
    }
  }
  return hits;
}

// --- 1. Joints -------------------------------------------------------------

const jointSpec = JSON.parse(readFileSync(`${ROOT}/joint-lines.spec.json`, 'utf8')) as {
  joints: { id: string; a: { id: string }; b: { id: string } }[];
};
const meshPair = new Map(jointSpec.joints.map((j) => [j.id, [j.a.id, j.b.id]]));

for (const j of ALL_STRUCTURES.filter(isJoint)) {
  const ids = j.articulatingStructureIds ?? [];

  // A midline joint between paired bones legitimately names ONE structure:
  // the pubic symphysis joins the left and right pubic bodies, and the seed
  // holds a single `pubis`. Demanding two here would force either a wrong
  // second id or two invented structures (owner, 24 Sep 2026).
  const midline = j.jointType === 'symphysis';

  if (ids.length < (midline ? 1 : 2)) {
    add({
      check: 'joint-arity',
      severity: 'error',
      id: j.id,
      what: `articulates ${ids.length} structure(s): [${ids.join(', ')}]. A joint is where two things meet.`,
      suggest: 'Read the description — it usually names both, and only the machine-readable field is short.',
    });
  }

  for (const id of ids) {
    if (!byId.has(id)) {
      add({ check: 'joint-unknown-id', severity: 'error', id: j.id, what: `names "${id}", which is not a structure.` });
    }
  }

  for (const a of ids) {
    for (const b of ids) {
      if (a !== b && partOf.get(a) === b) {
        add({
          check: 'joint-whole-and-part',
          severity: 'error',
          id: j.id,
          what: `articulates both "${a}" and "${b}", but ${a} is part of ${b}.`,
          suggest: `Name the articular part only: drop "${b}".`,
        });
      }
    }
  }

  // The mesh knows which two bones the picture is drawn from. Ids differ from
  // mesh names, so this is a prompt to look, not a verdict.
  const mesh = meshPair.get(j.id);
  if (mesh && ids.length >= 2) {
    const meshIds = mesh.filter((m) => byId.has(m));
    const unexplained = meshIds.filter((m) => !ids.includes(m) && !ids.some((i) => partOf.get(i) === m));
    if (unexplained.length > 0) {
      add({
        check: 'joint-vs-mesh',
        severity: 'review',
        id: j.id,
        what: `the plate is drawn from [${mesh.join(' + ')}], but the seed articulates [${ids.join(', ')}] — ${unexplained.join(', ')} is in the picture and not in the field.`,
      });
    }
  }
}

// --- 2. Bone articulations, and whether the joints agree -------------------

for (const b of ALL_STRUCTURES.filter(isBone)) {
  for (const text of b.articulations ?? []) {
    const named = structuresNamedIn(text, b.id);
    const partners = named.filter((id) => byId.get(id)?.category !== 'joint');
    const joints = named.filter((id) => byId.get(id)?.category === 'joint');

    if (partners.length === 0) {
      add({
        check: 'bone-articulation-unparsed',
        severity: 'info',
        id: b.id,
        what: `"${text}" names no structure this script recognises — cannot be cross-checked.`,
      });
      continue;
    }

    for (const jid of joints) {
      const joint = byId.get(jid);
      if (!joint || !isJoint(joint)) continue;
      const jIds = joint.articulatingStructureIds ?? [];
      const selfNamed = jIds.includes(b.id) || jIds.some((i) => partOf.get(i) === b.id);
      if (!selfNamed) {
        add({
          check: 'bone-joint-unreciprocated',
          severity: 'review',
          id: b.id,
          what: `says "${text}", but ${jid} does not list ${b.id} among [${jIds.join(', ')}].`,
          suggest: 'One of the two is wrong; the description usually says which.',
        });
      }
    }
  }
}

// --- 3. Landmarks ----------------------------------------------------------

const markerSpec = JSON.parse(readFileSync(`${ROOT}/landmark-markers.spec.json`, 'utf8')) as {
  landmarks: { id: string; parent: string; anchors?: string[]; sizeNote?: string }[];
};
const markers = new Map(markerSpec.landmarks.map((m) => [m.id, m]));

const withHotspot = new Set<string>();
for (const img of ALL_IMAGES) for (const h of img.hotspots ?? []) withHotspot.add(h.structureId);

for (const l of ALL_STRUCTURES.filter(isLandmark)) {
  if (l.parentBoneId && !byId.has(l.parentBoneId)) {
    add({ check: 'landmark-unknown-parent', severity: 'error', id: l.id, what: `parentBoneId "${l.parentBoneId}" is not a structure.` });
  }

  const marker = markers.get(l.id);
  if (marker && l.parentBoneId && marker.parent !== l.parentBoneId) {
    add({
      check: 'landmark-parent-vs-plate',
      severity: 'review',
      id: l.id,
      what: `the seed says it belongs to "${l.parentBoneId}", the plate draws it on "${marker.parent}".`,
    });
  }

  if (!withHotspot.has(l.id)) {
    add({
      check: 'landmark-no-target',
      severity: 'review',
      id: l.id,
      what: 'has no tap target on any image, so it can never be a locate question.',
    });
  }

  if (marker?.sizeNote === 'unclassified') {
    add({
      check: 'landmark-size-guessed',
      severity: 'review',
      id: l.id,
      what: 'its hitbox radius is the 10mm default — the name matched no size class, so nothing measured this.',
      suggest: 'Needs an anatomist to set a real radius; this is the number that decides right from wrong.',
    });
  }
}

// --- report ----------------------------------------------------------------

const order: Severity[] = ['error', 'review', 'info'];
const byCheck = new Map<string, Finding[]>();
for (const f of findings) byCheck.set(f.check, [...(byCheck.get(f.check) ?? []), f]);

console.log('\nMesh cross-check — coherence against the Z-Anatomy plates and the seed\'s own graph.');
console.log('This proves the content agrees with itself and with its pictures. It does NOT prove it true.\n');

for (const sev of order) {
  const checks = [...byCheck.entries()].filter(([, fs]) => fs[0].severity === sev);
  if (checks.length === 0) continue;
  console.log(`${sev.toUpperCase()}`);
  for (const [check, fs] of checks.sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${String(fs.length).padStart(3)}  ${check}`);
    for (const f of fs.slice(0, sev === 'error' ? 99 : 4)) console.log(`         ${f.id}: ${f.what}`);
    if (fs.length > (sev === 'error' ? 99 : 4)) console.log(`         …and ${fs.length - 4} more`);
  }
  console.log('');
}

const errors = findings.filter((f) => f.severity === 'error').length;
console.log(`${findings.length} finding(s): ${errors} error, ${findings.filter((f) => f.severity === 'review').length} for review, ${findings.filter((f) => f.severity === 'info').length} info.`);

if (WRITE) {
  const out = `${ROOT}/mesh-cross-check.json`;
  writeFileSync(
    out,
    JSON.stringify(
      {
        schemaVersion: 1,
        generated: new Date().toISOString().slice(0, 10),
        note:
          'Tier 1 of the source-check: coherence against the Z-Anatomy plates and the seed graph. ' +
          'NOTHING HERE IS APPLIED AUTOMATICALLY — an automated correction to unverified content is not evidence. ' +
          'Adjudicate each finding, fix the seed by hand, and re-run. Regenerated wholesale, so do not hand-edit.',
        counts: { total: findings.length, error: errors },
        findings,
      },
      null,
      1,
    ),
  );
  console.log(`\nWrote ${out}`);
}
