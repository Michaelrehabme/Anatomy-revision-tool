import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ALL_IMAGES, ALL_STRUCTURES } from '../features/anatomy-revision/data/seed/index';
import type { AnatomyStructure } from '../features/anatomy-revision/types/structure';

/**
 * Builds the bone / landmark / joint counterpart of ta2-mapping.resolved.json:
 * which Z-Anatomy objects to highlight for each structure that still has no
 * real image.
 *
 *   npx tsx src/scripts/generateSkeletalMapping.ts
 *
 * WHY THIS IS NEEDED. Every bone and landmark image in the app is one of the
 * 14 AI-generated atlas slides, and they cannot simply be deleted — they are
 * the sole image for 163 structures. Replacing them means rendering those
 * structures from Z-Anatomy, and rendering them means knowing which objects
 * in a 4,569-mesh scene each one is.
 *
 * WHAT IT CAN AND CANNOT DO. Roughly half resolve by name. The rest are two
 * kinds the model does not name the way we do:
 *
 *   - GROUPS. "Carpals (grouped)" is eight separate meshes; "Ribs" is
 *     twenty-four. Z-Anatomy's own collections cover many of these, so a
 *     collection whose name matches is expanded to its members.
 *   - SUB-ARTICULATIONS. Z-Anatomy has no "Humeroulnar joint" object or
 *     collection; the joint is where two named bone surfaces meet. Those
 *     cannot be guessed and are written out as unresolved for a human to
 *     fill in.
 *
 * Existing decisions are never overwritten: a structure already carrying
 * blenderObjects in the output file keeps them, so hand-resolved entries
 * survive a regeneration. Delete an entry to have it re-guessed.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const INDEX = `${ROOT}/src/scripts/data/zAnatomyObjects.json`;
const OUT = `${ROOT}/ta2-mapping-skeletal.resolved.json`;

interface ZIndex {
  objects: string[];
  collections: Record<string, string[]>;
}

export interface SkeletalMappingEntry {
  id: string;
  name: string;
  category: string;
  region: string;
  blenderObjects: string[];
  /** How the entry was arrived at, so a reviewer knows what to trust. */
  resolution: 'object-name' | 'collection-name' | 'manual' | 'unresolved';
  /** Label anchors carrying a usable position, when no geometry exists. */
  anchorObjects?: string[];
  /** Set by hand when a guess was wrong or a group needed composing. */
  note?: string;
}

/**
 * Z-Anatomy suffixes a mesh with its side (.l/.r), and with .j/.i/.s for
 * joints, insertions and surfaces. Parentheses in our own names ("(grouped)",
 * "(C3–C6)") are dropped because they describe the grouping rather than name
 * a structure the model would know.
 */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.[a-z]{1,2}$/, '')
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Singular form, so "Carpals" can find a "Carpal bones" collection. */
function singular(value: string): string {
  return value.replace(/\b(\w+?)ies\b/g, '$1y').replace(/\b(\w+?)s\b/g, '$1');
}

/**
 * Words that carry no anatomical information here. "Bone" is the big one:
 * Z-Anatomy writes "Scaphoid bone" where we write "Scaphoid", and dropping it
 * alone resolves most of the carpals and tarsals.
 */
const NOISE = new Set(['of', 'the', 'a', 'bone', 'bones', 'grouped']);

/**
 * Z-Anatomy's mesh suffixes, and which of them are the right geometry for
 * each kind of structure.
 *
 *   .l / .r   the paired object itself
 *   (none)    an unpaired object — vertebrae, sternum
 *   .i        a muscle-insertion patch on a bone's surface
 *   .j        an articular surface
 *
 * Every category takes real geometry only. `.i` and `.j` look like they name
 * the surface features we want and do not — see ANCHOR_SUFFIXES below, which
 * is the reason most landmarks cannot be rendered as highlight panels at all.
 */
const SUFFIX_PREFERENCE: Record<string, string[]> = {
  bone: ['l', 'r', ''],
  landmark: ['l', 'r', ''],
  joint: ['l', 'r', ''],
};

/**
 * Suffixes that are Z-Anatomy's LABELLING SYSTEM, not anatomy. Probing every
 * mesh in the scene: all 344 `.i` objects and 1,221 of the 1,228 `.j` objects
 * carry two vertices or fewer. They are anchors for the add-on's leader lines,
 * and they cannot be rendered as a highlight because there is nothing there.
 *
 * This is not a gap in the mapping, it is how the model works. A bone is a
 * mesh; a landmark on that bone is a named point, because "greater tubercle"
 * is not separable geometry — it is a region of the humerus. `.i` anchors sit
 * at the world origin and carry no position either, which is why mapping the
 * acetabulum to one rendered a picture of the feet.
 *
 * `.j` anchors do carry a real position (the sacral promontory anchor sits at
 * sacral height), so they can locate a marker or a hotspot on a rendered
 * bone — but that is a different kind of image from a highlighted panel, and
 * it is recorded as unresolved here rather than pretended otherwise.
 */
const ANCHOR_SUFFIXES = new Set(['i', 'j']);

const suffixOf = (name: string): string => /\.([a-z]{1,2})$/.exec(name)?.[1] ?? '';

/**
 * Groups whose members Z-Anatomy names individually rather than ordinally,
 * so no amount of token folding collects them: the carpals are eight
 * separately-named bones, the vertebral ranges are explicit levels, and the
 * phalanges are named per digit and per row.
 *
 * A pattern rather than a list of objects, so the mapping survives a
 * Z-Anatomy update that adds or renames a member. Matched against the full
 * mesh name, so the .l/.r pair is picked up together.
 */
const GROUP_PATTERNS: Record<string, RegExp> = {
  carpals: /^(scaphoid|lunate|triquetrum|pisiform|trapezium|trapezoid|capitate|hamate) bone\.[lr]$/i,
  tarsals: /^(talus|calcaneus|cuboid bone|navicular bone|(medial|lateral|intermediate) cuneiform bone)\.[lr]$/i,
  'cervical-vertebrae': /^Vertebra C[3-6]$/i,
  'thoracic-vertebrae': /^Vertebra T(1[0-2]|[1-9])$/i,
  'lumbar-vertebrae': /^Vertebra L[1-5]$/i,
  'phalanges-proximal-hand': /^Proximal phalanx of .* of hand\.[lr]$/i,
  'phalanges-middle-hand': /^Middle phalanx of .* of hand\.[lr]$/i,
  'phalanges-distal-hand': /^Distal phalanx of .* of hand\.[lr]$/i,
  'phalanges-proximal-foot': /^Proximal phalanx of .* of foot\.[lr]$/i,
  'phalanges-middle-foot': /^Middle phalanx of .* of foot\.[lr]$/i,
  'phalanges-distal-foot': /^Distal phalanx of .* of foot\.[lr]$/i,
};

/**
 * Keeps only the meshes whose suffix suits the category, in preference order:
 * the first suffix that yields anything wins, so a bone never mixes its own
 * geometry with the patches stuck to it.
 */
function preferByCategory(objects: string[], category: string): string[] {
  const order = SUFFIX_PREFERENCE[category] ?? ['l', 'r', ''];
  for (const suffix of order) {
    const kept = objects.filter((o) => suffixOf(o) === suffix);
    if (kept.length > 0) {
      // .l and .r are one structure in two halves; take both together.
      if (suffix === 'l' || suffix === 'r') {
        return objects.filter((o) => suffixOf(o) === 'l' || suffixOf(o) === 'r');
      }
      return kept;
    }
  }
  return objects;
}

/**
 * Our names use the adjectival form where Z-Anatomy uses the noun — "Femoral
 * Head" against "Head of femur", "Lateral Mass of Atlas" against a mesh on the
 * atlas. Folding one to the other lets a token comparison see through it.
 */
const STEMS: Record<string, string> = {
  femoral: 'femur',
  humeral: 'humerus',
  tibial: 'tibia',
  fibular: 'fibula',
  radial: 'radius',
  ulnar: 'ulna',
  sacral: 'sacrum',
  scapular: 'scapula',
  clavicular: 'clavicle',
  vertebral: 'vertebra',
  costal: 'rib',
  carpal: 'carpus',
  tarsal: 'tarsus',
};

function tokens(value: string): string[] {
  return normalize(value)
    .split(' ')
    .map((t) => singular(t))
    .map((t) => STEMS[t] ?? t)
    .filter((t) => t.length > 0 && !NOISE.has(t));
}

const key = (value: string) => [...new Set(tokens(value))].sort().join(' ');

function candidateNames(structure: AnatomyStructure): string[] {
  const out = new Set<string>();
  for (const value of [structure.name, ...(structure.aliases ?? [])]) {
    const k = key(value);
    if (k) out.add(k);
  }
  return [...out];
}

function main(): void {
  if (!existsSync(INDEX)) {
    throw new Error(
      `${INDEX} is missing. Produce it first:\n` +
        `  ./tools/blender-*/blender.exe --background atlas/Z-Anatomy/Startup.blend \\\n` +
        `      --python src/scripts/blender/dumpObjectNames.py -- --out ${INDEX}`,
    );
  }

  const index = JSON.parse(readFileSync(INDEX, 'utf8')) as ZIndex;

  // Objects grouped by token key, so one lookup returns both sides at once.
  const byObjectName = new Map<string, string[]>();
  for (const name of index.objects) {
    const k = key(name);
    if (!k) continue;
    const bucket = byObjectName.get(k);
    if (bucket) bucket.push(name);
    else byObjectName.set(k, [name]);
  }

  const byCollectionName = new Map<string, string[]>();
  for (const [name, members] of Object.entries(index.collections)) {
    const k = key(name);
    if (k) byCollectionName.set(k, members);
  }

  /**
   * A Z-Anatomy name whose tokens are all present in ours — "Greater tubercle"
   * for our "Greater Tubercle of Humerus". Only used when exactly one distinct
   * key qualifies: two candidates means the name is ambiguous and a guess
   * would be worse than leaving it for review. The most specific (longest)
   * match wins among ties on the same key.
   */
  /**
   * Z-Anatomy names each member of a set individually and ordinally — "First
   * rib", "Fifth metacarpal bone" — where we carry one structure for the
   * group. Dropping the ordinal makes every member collapse onto the group's
   * own name, so "Ribs" collects all twenty-four rather than matching the
   * "Rib.i" surface patch that happens to share the word.
   */
  const ORDINALS = new Set([
    'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh',
    'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth',
  ]);

  const groupMatch = (structureKey: string): string[] => {
    const want = structureKey.split(' ').filter((t) => !ORDINALS.has(t)).sort().join(' ');
    if (!want) return [];
    const hits: string[] = [];
    for (const name of index.objects) {
      const theirs = [...new Set(tokens(name).filter((t) => !ORDINALS.has(t)))].sort().join(' ');
      if (theirs === want) hits.push(name);
    }
    // Only a genuine set; a single hit is the ordinary case handled elsewhere.
    return hits.length > 2 ? hits : [];
  };

  const subsetMatch = (structureKey: string): string[] => {
    const want = new Set(structureKey.split(' '));
    if (want.size < 2) return [];
    const hits: { k: string; objects: string[] }[] = [];
    for (const [k, objects] of byObjectName) {
      const theirs = k.split(' ');
      if (theirs.length < 2) continue;
      if (theirs.every((t) => want.has(t))) hits.push({ k, objects });
    }
    if (hits.length === 0) return [];
    const best = hits.sort((a, b) => b.k.split(' ').length - a.k.split(' ').length);
    if (best.length > 1 && best[0].k.split(' ').length === best[1].k.split(' ').length) return [];
    return best[0].objects;
  };

  // Only structures with no image, or whose only images are the AI ones.
  const aiImageIds = new Set(ALL_IMAGES.filter((i) => /AI-generated/i.test(i.credit ?? '')).map((i) => i.id));
  const needsImage = (s: AnatomyStructure) => {
    const ids = s.imageIds ?? [];
    return ids.length === 0 || !ids.some((id) => !aiImageIds.has(id));
  };
  const targets = ALL_STRUCTURES.filter((s) => s.category !== 'muscle' && needsImage(s));

  const existing = new Map<string, SkeletalMappingEntry>();
  if (existsSync(OUT)) {
    const prior = JSON.parse(readFileSync(OUT, 'utf8')) as { mapping: SkeletalMappingEntry[] };
    for (const entry of prior.mapping ?? []) existing.set(entry.id, entry);
  }

  const mapping: SkeletalMappingEntry[] = [];

  for (const structure of targets) {
    const prior = existing.get(structure.id);
    // A hand-filled entry is the point of the file; never clobber it.
    if (prior && prior.blenderObjects.length > 0 && prior.resolution !== 'unresolved') {
      mapping.push({ ...prior, name: structure.name, region: structure.region });
      continue;
    }

    const names = candidateNames(structure);
    let objects: string[] = [];
    let resolution: SkeletalMappingEntry['resolution'] = 'unresolved';

    // Named-member sets first — these cannot be reached by token folding.
    const pattern = GROUP_PATTERNS[structure.id];
    if (pattern) {
      const hit = index.objects.filter((o) => pattern.test(o));
      if (hit.length > 0) {
        objects = hit;
        resolution = 'manual';
      }
    }

    // Then ordinal sets: "Ribs" must collect the ribs, not match the lone
    // "Rib.i" patch that shares its only word.
    const isGroup =
      objects.length === 0 && (/\(grouped\)/i.test(structure.name) || /\b\w+(?:s|ies)\b/.test(structure.name));
    if (isGroup) {
      for (const name of names) {
        const hit = groupMatch(name);
        if (hit.length > 0) {
          objects = hit;
          resolution = 'object-name';
          break;
        }
      }
    }

    if (objects.length === 0) {
      for (const name of names) {
        const hit = byObjectName.get(name);
        if (hit && hit.length > 0) {
          objects = hit;
          resolution = 'object-name';
          break;
        }
      }
    }

    if (objects.length === 0) {
      for (const name of names) {
        const members = byCollectionName.get(name);
        if (members && members.length > 0) {
          objects = members;
          resolution = 'collection-name';
          break;
        }
      }
    }

    if (objects.length === 0) {
      for (const name of names) {
        const hit = subsetMatch(name);
        if (hit.length > 0) {
          objects = hit;
          resolution = 'object-name';
          break;
        }
      }
    }

    // Anchors are not geometry. Dropping them here rather than at render time
    // is what keeps the counts in this file honest: an entry either names
    // something that can be drawn, or it is unresolved.
    const renderable = preferByCategory(objects, structure.category).filter(
      (o) => !ANCHOR_SUFFIXES.has(suffixOf(o)),
    );
    const anchorsOnly = renderable.length === 0 && objects.length > 0;
    if (anchorsOnly) resolution = 'unresolved';

    mapping.push({
      id: structure.id,
      name: structure.name,
      category: structure.category,
      region: structure.region,
      blenderObjects: renderable,
      resolution,
      ...(anchorsOnly
        ? {
            anchorObjects: objects.filter((o) => suffixOf(o) === 'j'),
            note: 'Z-Anatomy models this as a label anchor, not geometry — it cannot be highlighted. See ANCHOR_SUFFIXES.',
          }
        : {}),
      ...(prior?.note ? { note: prior.note } : {}),
    });
  }

  const counts = {
    total: mapping.length,
    resolved: mapping.filter((m) => m.blenderObjects.length > 0).length,
    unresolved: mapping.filter((m) => m.blenderObjects.length === 0).length,
    byResolution: mapping.reduce<Record<string, number>>((acc, m) => {
      acc[m.resolution] = (acc[m.resolution] ?? 0) + 1;
      return acc;
    }, {}),
  };

  writeFileSync(
    OUT,
    JSON.stringify(
      {
        schemaVersion: 1,
        generator: 'src/scripts/generateSkeletalMapping.ts',
        note:
          'Bone, landmark and joint structures that still need a real image. ' +
          'Hand-edited entries are preserved on regeneration; set resolution to "manual" when you fill one in.',
        counts,
        mapping: mapping.sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id)),
      },
      null,
      1,
    ),
  );

  console.log(`Wrote ${OUT}`);
  console.log(`  ${counts.resolved}/${counts.total} resolved`, JSON.stringify(counts.byResolution));
  const byCat: Record<string, { hit: number; total: number }> = {};
  for (const m of mapping) {
    byCat[m.category] ??= { hit: 0, total: 0 };
    byCat[m.category].total += 1;
    if (m.blenderObjects.length > 0) byCat[m.category].hit += 1;
  }
  for (const [cat, v] of Object.entries(byCat)) console.log(`  ${cat.padEnd(10)} ${v.hit}/${v.total}`);
}

main();
