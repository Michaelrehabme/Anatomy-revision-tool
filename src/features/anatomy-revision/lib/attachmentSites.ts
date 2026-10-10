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
