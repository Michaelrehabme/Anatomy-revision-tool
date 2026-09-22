import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ALL_STRUCTURES } from '../features/anatomy-revision/data/seed';
import type { Region, SubRegion } from '../features/anatomy-revision/types/region';

/**
 * Builds the first ligament tranche from measured data, not from typing.
 *
 *   npx tsx src/scripts/generateLigamentSeed.ts
 *
 * Writes three things:
 *   src/features/anatomy-revision/data/seed/structures.ligaments.seed.ts
 *   ta2-mapping-ligaments.resolved.json     (id -> atlas mesh names, for rendering)
 *   docs/ligament-attachments-review.md     (what a human has to confirm)
 *
 * WHICH LIGAMENTS. The ones the visibility survey (checkLigamentVisibility.py)
 * found plainly visible — half the strap in clear view from some angle — in
 * MSK scope. The survey undercounts (the anterior talofibular traced a real
 * target once eight angles were rendered), so this is a floor, and a second
 * tranche will come from rendering the rest and keeping what traces.
 *
 * WHERE EACH ONE LIVES comes from the atlas's own collections: a ligament in
 * "Left foot" is ankle-foot, one in "Knee joint" is knee. Region follows the
 * convention the joints seed already uses for that subregion.
 *
 * WHAT IT ATTACHES TO comes from deriveLigamentAttachments.py — the bones the
 * mesh touches — mapped to app structure ids, preferring the specific bone
 * (talus) over the group it sits in (tarsals), per the rule that a joint is
 * named by its articular part and not the whole pelvis. Every entry starts
 * `needsReview: true`, because touching is not attaching.
 *
 * THE REVIEW LANDS IN ligament-attachment-corrections.json, and this script
 * applies it. That file — not this generator and not the generated seed — is
 * where a human decision lives, so a decision survives a re-run: an entry
 * either replaces the derived attachments or confirms them, and either way
 * clears needsReview. Anything absent from it stays derived and unreviewed,
 * which is the honest default.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(`${ROOT}/${p}`, 'utf8'));

const visibility: { ligament: string; bestShare: number; bestView: number }[] = read('ligament-visibility.json').ligaments;
const attachments: { ligament: string; attachments: { bone: string; share: number }[] }[] = read('ligament-attachments.json').ligaments;
const collections: Record<string, string[]> = read('ligament-collections.json');
const skeletal: { id: string; category: string; blenderObjects?: string[] }[] = read('ta2-mapping-skeletal.resolved.json').mapping;

/**
 * THE SECOND TRANCHE. The survey undercounts — the ATFL traced a real target
 * once eight angles were rendered — so the rest are rendered first and only
 * the ones that trace are seeded. Three switches make that possible without
 * ever seeding an untested ligament:
 *
 *   --min-visible 0     consider every ligament in scope, not only the plainly visible
 *   --candidates FILE   write the ligaments not yet seeded, with their meshes, subregion
 *                       and attachment bones, and STOP (the seed is not touched)
 *   --traced FILE       a JSON array of ids whose renders traced; a ligament under the
 *                       first tranche's threshold is seeded only if it is listed
 */
const argv = process.argv.slice(2);
const argOf = (name: string) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : undefined);
const MIN_VISIBLE = Number(argOf('min-visible') ?? 0.5);
/** The first tranche's threshold, which decides who needed a traced render to get in. */
const TRANCHE_ONE_VISIBLE = 0.5;
const candidatesOut = argOf('candidates');
const tracedIds: Set<string> | null = argOf('traced') ? new Set(JSON.parse(readFileSync(argOf('traced')!, 'utf8'))) : null;

/** Strip the side and part suffixes Z-Anatomy uses: ".l", ".r", ".o1l", ".or". */
const baseName = (n: string) => n.replace(/\.(o\d?)?[lr]$/, '');
// The parenthetical is kept: "Posterior meniscotibial ligament (Lateral
// meniscus)" and "(Medial meniscus)" are two ligaments, and dropping it made
// them one id.
const kebab = (n: string) =>
  n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Mesh name -> app structure id, most specific first. */
const boneIds = new Map<string, { id: string; category: string }[]>();
for (const e of skeletal) for (const b of e.blenderObjects ?? []) {
  const list = boneIds.get(b) ?? [];
  list.push({ id: e.id, category: e.category });
  boneIds.set(b, list);
}
function boneId(mesh: string): string | null {
  const list = boneIds.get(mesh);
  if (!list) return null;
  // A landmark entry is the specific bone (talus); the bone entry is its
  // group (tarsals). Specific wins.
  return (list.find((x) => x.category === 'landmark') ?? list[0]).id;
}

const EXCLUDE = ['Head', 'Larynx', 'Temporomandibular joint', 'Cranial syndesmosis', 'Eye*', 'Tympanic membrane',
  'Sense organs', 'Facial nerve (VII)', '4: Muscular system', 'Fibrous joints of larynx', 'Thyrohyoid membrane',
  'Quadrangular membrane', 'Accessory visual structures', '6: Lymphoid organs'];

/** Collection name fragments -> subregion, checked in order; limb parts first. */
const SUBREGION_RULES: [RegExp, SubRegion][] = [
  [/^(Left|Right) foot$/, 'ankle-foot'],
  [/^(Left|Right) hand$/, 'wrist-hand'],
  [/Knee joint|meniscus|Tibial collateral|Superior tibiofibular|Fibrous joints of free lower limb/i, 'knee'],
  [/Hip joint|Iliofemoral|Sacro-iliac|Pubic symphysis|pelvic girdle|Sacrotuberous|Obturator membrane/i, 'hip'],
  [/Elbow joint|Fascia of upper limb/i, 'elbow'],
  [/Radiocarpal|Distal radio-ulnar|carpal|Pisiform/i, 'wrist-hand'],
  [/Glenohumeral|Acromioclavicular|Sternoclavicular|Coracoclavicular|pectoral girdle/i, 'shoulder'],
  [/Subtalar|Tibiofibular syndesmosis|Talocalcaneonavicular|tarsal|Calcaneocuboid|Cuneo|Cuboideonavicular|Bifurcate|Transverse tarsal|Metatarsophalangeal|Interphalangeal joints of foot/i, 'ankle-foot'],
  [/Vertebral column|Fibrous joints of vertebral column|Back/i, 'spine'],
  [/Thorax|head of rib|Costotransverse|Fibrous joints of thorax/i, 'torso'],
];
const NAME_RULES: [RegExp, SubRegion][] = [
  [/forearm/i, 'elbow'],
  [/of leg/i, 'knee'],
];
const REGION_FOR: Record<SubRegion, Region> = {
  shoulder: 'shoulder-arm', elbow: 'shoulder-arm', 'wrist-hand': 'forearm-hand', hip: 'hip-thigh', knee: 'hip-thigh',
  'ankle-foot': 'lower-leg-foot', spine: 'back-core', torso: 'back-core', neck: 'back-core',
};

const ABBREVIATIONS: Record<string, string> = {
  'anterior-cruciate-ligament': 'ACL', 'posterior-cruciate-ligament': 'PCL', 'anterior-talofibular-ligament': 'ATFL',
  'calcaneofibular-ligament': 'CFL', 'posterior-talofibular-ligament': 'PTFL', 'tibial-collateral-ligament': 'MCL',
  'fibular-collateral-ligament': 'LCL', 'acromioclavicular-ligament': 'AC ligament', 'ulnar-collateral-ligament': 'UCL',
};

interface Correction {
  attachmentStructureIds?: string[];
  description?: string;
  confirmed?: boolean;
  source?: string;
  /** How the decision was reached: 'verified' means a named source was checked. */
  grade?: string;
  /** Set when the ids were pinned rather than typed out by a reviewer. */
  pinned?: string;
  /**
   * The works checked, carried into the seed entry's `notes`. A citation that
   * lives only in a working file is gone by the time a student queries the
   * answer, and one of these decisions is a RETRACTION of a confident
   * correction — the reason it stands has to travel with it.
   */
  sources?: string[];
  why?: string;
}
const CORRECTIONS: Record<string, Correction> = existsSync(`${ROOT}/ligament-attachment-corrections.json`)
  ? read('ligament-attachment-corrections.json').corrections
  : {};

/**
 * A labrum, meniscus or articular disc SITS BETWEEN two bones and is attached
 * to one of them. Contact says nothing about which: the acetabular labrum
 * touches the femoral head it embraces MORE than the acetabular rim it grows
 * from (0.54 against 0.42), so no share rule can pick the right one, and the
 * pair looks as clean as a real strap between two bones. They get their own
 * tier so they sort with the doubtful rather than the settled, and the 22 Sep
 * 2026 cross-check found all four of them wrong in the same direction.
 */
const ARTICULAR = /labrum|meniscus|articular disc/i;

/**
 * Ligaments that genuinely run between two points of ONE bone, so "only one
 * bone" is the right answer rather than half an answer. Without this they
 * come back in the doubtful tier at every re-run.
 */
const SINGLE_BONE_BY_DESIGN: Record<string, string> = {
  'coraco-acromial-ligament': 'coracoid process to acromion, both scapula',
  'inferior-transverse-scapular-ligament': 'spans the spinoglenoid notch of the scapula',
  'superior-transverse-scapular-ligament': 'bridges the suprascapular notch of the scapula',
  'inferior-pubic-ligament': 'joins both pubic bones, which the atlas holds as one hip-bone mesh',
};

function tierFor(name: string, derived: { bone: string; share: number }[]): string {
  if (ARTICULAR.test(name)) return 'articular';
  if (derived.length === 1 && SINGLE_BONE_BY_DESIGN[kebab(name)]) return 'one bone (by design)';
  if (derived.length === 2) return 'clean pair';
  if (derived.length === 1) return 'one bone';
  if (derived.length === 0) return 'none';
  return derived.length === 3 && derived[2].share < 0.15 ? 'pair + trace' : 'many';
}

const joints = ALL_STRUCTURES.filter((s) => s.category === 'joint');
function jointFor(colls: string[]): string | undefined {
  for (const c of colls) {
    const key = c.toLowerCase().replace(/ joint$/, '').replace(/-/g, '');
    if (key.length < 5) continue;
    const j = joints.find((s) => (s.name + ' ' + s.aliases.join(' ')).toLowerCase().replace(/-/g, '').includes(key));
    if (j) return j.id;
  }
  return undefined;
}

// ---- group meshes by ligament ----
interface Lig { name: string; meshes: string[]; colls: Set<string>; best: number; derived: { bone: string; share: number }[] }
const byName = new Map<string, Lig>();
for (const v of visibility) {
  const name = baseName(v.ligament);
  const l = byName.get(name) ?? { name, meshes: [], colls: new Set(), best: 0, derived: [] };
  l.meshes.push(v.ligament);
  for (const c of collections[v.ligament] ?? []) l.colls.add(c);
  l.best = Math.max(l.best, v.bestShare);
  byName.set(name, l);
}
for (const a of attachments) {
  const l = byName.get(baseName(a.ligament));
  if (!l) continue;
  // Merge both sides by base bone name, keeping the larger share.
  for (const at of a.attachments) {
    const bone = at.bone;
    const prev = l.derived.find((d) => baseName(d.bone) === baseName(bone));
    if (prev) prev.share = Math.max(prev.share, at.share);
    else l.derived.push({ bone, share: at.share });
  }
}

// ---- select the tranche ----
const chosen: (Lig & { id: string; subregion: SubRegion; region: Region; ids: string[]; tier: string })[] = [];
const dropped: string[] = [];
for (const l of byName.values()) {
  const colls = [...l.colls];
  if (colls.some((c) => EXCLUDE.includes(c))) continue;
  if (l.best < MIN_VISIBLE) continue;
  const rule = SUBREGION_RULES.find(([re]) => colls.some((c) => re.test(c)));
  // A few sit only in a limb collection; the name says where they are.
  const nameRule = NAME_RULES.find(([re]) => re.test(l.name));
  if (!rule && !nameRule) { dropped.push(`${l.name}  [${colls.join(', ')}]`); continue; }
  const subregion = (rule ?? nameRule)![1];
  const derived = l.derived.filter((d) => d.share >= 0.05).sort((a, b) => b.share - a.share);
  const ids = [...new Set(derived.map((d) => boneId(d.bone)).filter((x): x is string => !!x))];
  const tier = tierFor(l.name, derived);
  chosen.push({ ...l, derived, id: kebab(l.name), subregion, region: REGION_FOR[subregion], ids, tier });
}
chosen.sort((a, b) => a.subregion.localeCompare(b.subregion) || a.name.localeCompare(b.name));

if (candidatesOut) {
  const seeded = new Set(ALL_STRUCTURES.filter((st) => st.category === 'ligament').map((st) => st.id));
  const candidates = chosen
    .filter((l) => !seeded.has(l.id))
    .map((l) => ({
      id: l.id,
      name: l.name,
      subregion: l.subregion,
      best: l.best,
      meshes: l.meshes.sort(),
      attachmentBones: l.derived.map((d) => d.bone),
    }));
  writeFileSync(candidatesOut, JSON.stringify({ minVisible: MIN_VISIBLE, candidates }, null, 1));
  console.log(`${candidates.length} candidate ligament(s) not yet seeded -> ${candidatesOut}`);
  process.exit(0);
}

// Below the first tranche's threshold a ligament must have traced in a render.
if (tracedIds) {
  const before = chosen.length;
  for (let i = chosen.length - 1; i >= 0; i--) {
    if (chosen[i].best < TRANCHE_ONE_VISIBLE && !tracedIds.has(chosen[i].id)) chosen.splice(i, 1);
  }
  console.log(`${before - chosen.length} under-threshold ligament(s) left out: no traced render`);
} else if (MIN_VISIBLE < TRANCHE_ONE_VISIBLE) {
  console.error('--min-visible below the first tranche needs --traced: never seed a ligament that has not traced.');
  process.exit(1);
}

// ---- seed ----
const q = (s: string) => `'${s.replace(/'/g, "\\'")}'`;
const entries = chosen.map((l) => {
  const jointId = jointFor([...l.colls]);
  const abbr = ABBREVIATIONS[l.id];
  const fix = CORRECTIONS[l.id];
  const ids = fix?.attachmentStructureIds ?? l.ids;
  const bonesText = l.derived.map((d) => baseName(d.bone).toLowerCase()).slice(0, 3);
  const description = fix?.description
    ?? (bonesText.length >= 2
      ? `Ligament of the ${l.subregion.replace('-', ' and ')}, running between the ${bonesText[0]} and the ${bonesText[1]}.`
      : `Ligament of the ${l.subregion.replace('-', ' and ')}.`);
  // A reviewed entry records WHY in `notes`, because the derived contact will
  // keep disagreeing with it and the next person to look needs the reason.
  const notes = fix?.why
    ? [fix.why, fix.source ? `(${fix.source})` : '', fix.sources?.length ? `Sources: ${fix.sources.join('; ')}.` : '']
        .filter(Boolean)
        .join(' ')
    : null;
  return `  {
    id: ${q(l.id)},
    name: ${q(l.name)},
    category: 'ligament',
    region: ${q(l.region)},
    subregion: ${q(l.subregion)},
    description: ${q(description)},
    aliases: [${abbr ? q(abbr) : ''}],${abbr ? `\n    abbreviation: ${q(abbr)},` : ''}
    attachmentStructureIds: [${ids.map(q).join(', ')}],${jointId ? `\n    jointId: ${q(jointId)},` : ''}
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: true },
    difficulty: 'medium',
    tags: ['ligament'],${notes ? `\n    notes: ${q(notes)},` : ''}${fix?.confirmed ? '' : '\n    needsReview: true,'}
  },`;
});

const seed = `import type { LigamentStructure } from '../../types/structure';

/**
 * Ligament structures — the first tranche. GENERATED by
 * src/scripts/generateLigamentSeed.ts from the atlas surveys; do not hand-edit
 * the generated fields, edit the generator or the review sheet.
 *
 * Every entry is needsReview: true. attachmentStructureIds were derived from
 * which bones the ligament mesh touches (deriveLigamentAttachments.py) and
 * mapped to app ids, preferring the specific bone (talus) over its group
 * (tarsals). Touching is not attaching — the review sheet at
 * docs/ligament-attachments-review.md is where a human confirms each one, and
 * clearing needsReview is the record of that.
 *
 * Descriptions are placeholders naming the derived attachments, to be replaced
 * by authored text in the same review pass.
 */
export const LIGAMENT_STRUCTURES: LigamentStructure[] = [
${entries.join('\n')}
];
`;
writeFileSync(`${ROOT}/src/features/anatomy-revision/data/seed/structures.ligaments.seed.ts`, seed);

// ---- render mapping ----
writeFileSync(`${ROOT}/ta2-mapping-ligaments.resolved.json`, JSON.stringify({
  schemaVersion: 1,
  generator: 'src/scripts/generateLigamentSeed.ts',
  note: 'Ligament id -> Z-Anatomy mesh names (both sides, all parts). Feeds renderLigamentPlates.py.',
  mapping: chosen.map((l) => ({ id: l.id, name: l.name, category: 'ligament', region: l.region, blenderObjects: l.meshes.sort() })),
}, null, 1));

// ---- review sheet ----
const rows = chosen.map((l) => {
  // A mesh with no structure id is DROPPED from the seed, and used to be
  // dropped silently: the costoclavicular ligament lost the first rib's costal
  // cartilage that way and kept a sternum contact instead. Say so in the row.
  const derived = l.derived
    .map((d) => `${baseName(d.bone)} ${Math.round(d.share * 100)}%${boneId(d.bone) ? '' : ' _(not a structure)_'}`)
    .join(', ');
  const fix = CORRECTIONS[l.id];
  const ids = fix?.attachmentStructureIds ?? l.ids;
  const verdict = !fix
    ? ''
    : fix.attachmentStructureIds
      ? `**corrected** — ${fix.why ?? ''}`
      : `**confirmed** — ${fix.why ?? ''}`;
  return `| ${l.name} | ${l.subregion} | ${derived || '—'} | ${ids.join(', ') || '—'} | ${l.tier} | ${Math.round(l.best * 100)}% | ${verdict} |`;
});
const sheet = `# Ligament attachments — review sheet

Generated by \`src/scripts/generateLigamentSeed.ts\`. ${chosen.length} ligaments in the first tranche
(plainly visible in the atlas, MSK scope).

**How to read it.** "Derived" is which bones the ligament mesh touches, with the share of its
vertices in contact. That is evidence for an attachment, not a substitute for knowing: a ligament
passing over a bone touches it too (the acetabular labrum reports the femur it wraps). "Seed ids" is
what the seed currently carries, and a contact marked _(not a structure)_ reached a mesh the app does
not model, so it was dropped rather than seeded. Read the doubtful tiers first — *articular*, *many*
and *one bone* — then the clean pairs. *articular* is a labrum, meniscus or disc, where contact
cannot say which bone it grows from and which it merely meets; *one bone (by design)* is settled.

**How to review.** Decisions live in \`ligament-attachment-corrections.json\`, which the generator applies —
never hand-edit the generated seed, or the next re-run loses the decision. The last column shows what has been
settled so far; there is also a page for ticking through on a phone.

| Ligament | Area | Derived (share of mesh in contact) | Seed ids | Tier | Visible | Confirmed / correction |
|---|---|---|---|---|---|---|
${rows.join('\n')}

## Not included

${dropped.length ? dropped.map((d) => `- ${d}`).join('\n') : '_none_'}

Ligaments under ${Math.round(MIN_VISIBLE * 100)}% visible in the survey are the second tranche; see the
rotation finding in the ligament preview (the survey undercounts strap-on views).
`;
writeFileSync(`${ROOT}/docs/ligament-attachments-review.md`, sheet);

const reviewed = chosen.filter((l) => CORRECTIONS[l.id]).length;
const corrected = chosen.filter((l) => CORRECTIONS[l.id]?.attachmentStructureIds).length;
console.log(`reviewed: ${reviewed} of ${chosen.length} (${corrected} corrected, ${reviewed - corrected} confirmed as derived)`);
const unknownFix = Object.keys(CORRECTIONS).filter((id) => !chosen.some((l) => l.id === id));
if (unknownFix.length) console.log(`WARNING corrections for ids not in the tranche: ${unknownFix.join(', ')}`);
// A settled decision that the derivation now disagrees with is worth a look —
// the mesh mapping may have improved, or a trace contact may have crept in.
// The decision still wins; this only says where to look.
const drifted = chosen
  .filter((l) => CORRECTIONS[l.id]?.attachmentStructureIds)
  .map((l) => ({ l, fixed: CORRECTIONS[l.id].attachmentStructureIds! }))
  .filter(({ l, fixed }) => l.ids.length && (l.ids.length !== fixed.length || l.ids.some((i) => !fixed.includes(i))))
  .map(({ l, fixed }) => `  ${l.id}: reviewed [${fixed.join(', ')}], derivation now says [${l.ids.join(', ')}]`);
if (drifted.length) console.log(`${drifted.length} reviewed ligament(s) the derivation disagrees with:\n${drifted.join('\n')}`);
const tiers: Record<string, number> = {};
for (const l of chosen) tiers[l.tier] = (tiers[l.tier] ?? 0) + 1;
console.log(`${chosen.length} ligaments in the tranche; tiers: ${JSON.stringify(tiers)}`);
const bySub: Record<string, number> = {};
for (const l of chosen) bySub[l.subregion] = (bySub[l.subregion] ?? 0) + 1;
console.log(`by area: ${JSON.stringify(bySub)}`);
console.log(`with a joint matched: ${chosen.filter((l) => jointFor([...l.colls])).length}`);
console.log(`unmapped bones: ${[...new Set(chosen.flatMap((l) => l.derived.map((d) => d.bone)).filter((b) => !boneId(b)))].join(', ') || 'none'}`);
if (dropped.length) console.log(`dropped (no area rule): ${dropped.length}\n  ${dropped.join('\n  ')}`);
