import type { StructureIndexEntry } from '../types/structureIndex';

/**
 * Which of the hip bone's three parts a pelvic landmark is on. The seed hangs
 * every one of them off `pelvis`, and "ischial tuberosity of the pelvis" is
 * the vagueness this file exists to remove.
 */
const HIP_BONE_PART: Record<string, string> = {
  asis: 'ilium',
  aiis: 'ilium',
  psis: 'ilium',
  'iliac-crest': 'ilium',
  'ischial-tuberosity': 'ischium',
  'pubic-tubercle': 'pubis',
};

/** The bones that meet to form a landmark the seed files under the whole pelvis. */
const FORMED_BY: Record<string, string[]> = {
  acetabulum: ['ilium', 'ischium', 'pubis'],
  'obturator-foramen': ['ischium', 'pubis'],
};

/**
 * Every structure a site is part of: its bone, and for a pelvic landmark the
 * bone of the three it is on. Two sites that share one of these are too close
 * to offer one as a wrong answer beside the other — the AIIS is on the ilium,
 * and a ligament to one is a ligament to the other.
 */
export function containerIds(site: StructureIndexEntry): string[] {
  if (site.category !== 'landmark') return [];
  if (HIP_BONE_PART[site.id]) return [HIP_BONE_PART[site.id]];
  if (FORMED_BY[site.id]) return FORMED_BY[site.id];
  // The ilium, ischium and pubis are the bones; "the pelvis" contains nothing finer.
  if (!site.parentBoneId || site.parentBoneId === 'pelvis' || BONE_GROUPS.has(site.parentBoneId)) return [];
  return [site.parentBoneId];
}

/** Parents that are a set of bones, not a bone: a scaphoid is not "of the carpals". */
const BONE_GROUPS = new Set(['carpals', 'tarsals', 'metacarpals', 'metatarsals', 'ribs', 'cervical-vertebrae', 'lumbar-vertebrae']);

const plain = (name: string) => name.replace(/\s*\([^)]*\)/g, '').trim();

/** Landmarks filed under a set of bones that are on one bone of the set. */
const OWN_BONE: Record<string, string> = {
  'sustentaculum-tali': 'Calcaneus',
  'calcaneal-tuberosity': 'Calcaneus',
  'navicular-tuberosity': 'Navicular',
  'scaphoid-tubercle': 'Scaphoid',
  'hook-of-hamate': 'Hamate',
};

/** The adjective of a bone, for "femoral greater trochanter". */
const BONE_ADJECTIVE: Record<string, string> = {
  femur: 'femoral',
  humerus: 'humeral',
  tibia: 'tibial',
  fibula: 'fibular',
  radius: 'radial',
  ulna: 'ulnar',
  scapula: 'scapular',
  clavicle: 'clavicular',
  sternum: 'sternal',
  calcaneus: 'calcaneal',
  talus: 'talar',
  sacrum: 'sacral',
  patella: 'patellar',
};

/** Every name for the bone a site is on, in lower case. Empty when it is on none. */
export function ownBoneNames(site: StructureIndexEntry, byId: ReadonlyMap<string, StructureIndexEntry>): string[] {
  const parentId = site.parentBoneId;
  if (!parentId) return [];
  const names = new Set<string>();
  if (parentId === 'pelvis') ['pelvis', 'hip bone', 'innominate'].forEach((n) => names.add(n));
  if (HIP_BONE_PART[site.id]) names.add(plain(byId.get(HIP_BONE_PART[site.id])?.name ?? HIP_BONE_PART[site.id]).toLowerCase());
  if (OWN_BONE[site.id]) names.add(OWN_BONE[site.id].toLowerCase());
  const parent = byId.get(parentId);
  if (parent) [parent.name, ...parent.aliases].forEach((n) => names.add(plain(n).toLowerCase()));
  return [...names];
}

const lowerNoThe = (value: string) => value.toLowerCase().replace(/\bthe\s+/g, '').replace(/\s+/g, ' ').trim();

const shortNames = new WeakMap<object, Map<string, string>>();

/**
 * A key value with its bone taken off, when what is left is a landmark on that
 * bone: "Lesser trochanter of the femur" is "Lesser Trochanter", and "Posterior
 * surface of the tibia" is left alone, because "posterior surface" names
 * nothing. Null when the value is not a landmark with its bone.
 */
export function siteWithoutBone(value: string, byId: ReadonlyMap<string, StructureIndexEntry>): string | null {
  let names = shortNames.get(byId);
  if (!names) {
    names = new Map();
    for (const site of byId.values()) {
      if (site.category !== 'landmark') continue;
      const bones = ownBoneNames(site, byId);
      const name = plain(site.name);
      const short = bones.reduce((n, bone) => n.replace(new RegExp(`\\s+of\\s+(?:the\\s+)?${bone}$`, 'i'), ''), name);
      for (const bone of bones) names.set(lowerNoThe(`${short} of ${bone}`), short);
    }
    shortNames.set(byId, names);
  }
  return names.get(lowerNoThe(plain(value))) ?? null;
}

/** One name written with its bone, every way a student writes the two together. */
export function withBone(name: string, bones: readonly string[]): string[] {
  return bones.flatMap((bone) => [
    `${name} of ${bone}`,
    `${name} on ${bone}`,
    `${name} ${bone}`,
    `${bone} ${name}`,
    ...(BONE_ADJECTIVE[bone] ? [`${BONE_ADJECTIVE[bone]} ${name}`] : []),
  ]);
}

/**
 * The forms of a landmark's name with its bone said or left unsaid (student
 * report, 1 Nov 2026: "greater trochanter of femur" was marked wrong). Adding
 * the bone never makes a right answer wrong, and in the other direction the
 * picture has settled the bone, so "Greater Tubercle" answers "Greater Tubercle
 * of Humerus". One word left over ("Head", "Spine") names nothing and stays out.
 *
 * Only this landmark's own bone: "lateral condyle of femur" is still wrong for
 * the lateral condyle of the tibia, because that form is never generated for it.
 */
export function namesWithBone(
  site: StructureIndexEntry,
  byId: ReadonlyMap<string, StructureIndexEntry>,
): string[] {
  const bones = ownBoneNames(site, byId);
  const out = new Set<string>();
  for (const value of [site.name, ...site.aliases].map(plain)) {
    const short = bones.reduce((name, bone) => name.replace(new RegExp(`\\s+of\\s+(?:the\\s+)?${bone}$`, 'i'), ''), value);
    if (short.split(' ').length > 1) out.add(short);
    for (const name of new Set([value, short])) {
      if (name.split(' ').length === 1 && name !== value) continue;
      withBone(name, bones).forEach((form) => out.add(form));
    }
  }
  return [...out];
}

/**
 * Where a ligament attaches, as "bony landmark of bone": "Greater Trochanter
 * of the femur", "Coracoid Process of the scapula" (the owner's form, 10 Oct
 * 2026). The landmark alone is still a right answer — this is what is
 * SHOWN, and the bone is there so the student learns which bone it is on.
 *
 * A whole bone, a landmark that is itself a bone (the ilium, the scaphoid)
 * and a landmark whose name already carries its bone ("Head of Fibula") read
 * as they are.
 */
export function siteLabel(site: StructureIndexEntry, byId: ReadonlyMap<string, StructureIndexEntry>): string {
  // As authored, bar the seed's bookkeeping suffix: "Dens (Odontoid Process)"
  // and "Cervical Vertebrae (C3–C6)" keep what their brackets say.
  const name = site.name.replace(' (grouped)', '');
  if (site.category !== 'landmark') return name;
  const parentId = HIP_BONE_PART[site.id] ?? site.parentBoneId;
  if (!parentId || BONE_GROUPS.has(parentId)) return name;
  // The acetabulum is all three bones and the obturator foramen two of them.
  if (parentId === 'pelvis') return ['ilium', 'ischium', 'pubis'].includes(site.id) ? name : `${name} of the hip bone`;
  const parent = byId.get(parentId);
  if (!parent) return name;
  const bone = plain(parent.name);
  // "Ischial Tuberosity", "Femoral Head", "Head of Fibula": the name says its
  // bone already, as a noun or as its adjective, and saying it again is noise.
  const stem = bone.toLowerCase().replace(/(?:um|us|ur|a|is)$/, '');
  if (name.toLowerCase().includes(stem)) return name;
  return `${name} of the ${/^[A-Z]\d/.test(bone) ? bone : bone.toLowerCase()}`;
}
