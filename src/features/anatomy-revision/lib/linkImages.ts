import type { AnatomyStructure } from '../types/structure';
import type { AnatomyImageAsset } from '../types/image';

/**
 * Normalizes a name for matching: lowercase, trim, strip a trailing
 * parenthetical like "(ASIS)" or "(hand)" and a trailing "muscle(s)" suffix
 * (TA2 English terms conventionally end with it, e.g. "Fibularis longus
 * muscle" — atlas panel labels never do), collapse whitespace. This is
 * intentionally loose — it only needs to line up panel labels typed onto
 * atlas images against structure names/aliases typed into seed files, both
 * of which are ours to keep consistent.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+muscles?$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Auto-links AnatomyImageAsset entries to structures by matching each
 * image's panelStructureNames (atlas-slide) or structureId
 * (single-structure) against every structure's name/aliases/id.
 *
 * This exists so structures.*.seed.ts files never need hand-maintained
 * imageIds — at ~300 structures x 24 images that would be both tedious and
 * a constant source of drift. Instead, get the panel label transcribed
 * correctly (verbatim, matching the image) and/or add an alias, and linking
 * happens automatically. Called once in data/seed/index.ts.
 *
 * Returns NEW structure objects (does not mutate the input array) with
 * imageIds populated; any imageIds already present on a structure are kept
 * and de-duplicated against the auto-linked set rather than discarded.
 */
export function linkImages(
  structures: AnatomyStructure[],
  images: AnatomyImageAsset[],
): AnatomyStructure[] {
  const lookup = new Map<string, string[]>(); // normalized name -> structure ids
  for (const s of structures) {
    for (const key of [s.name, s.id, ...s.aliases]) {
      const norm = normalize(key);
      if (!norm) continue;
      const existing = lookup.get(norm);
      if (existing) existing.push(s.id);
      else lookup.set(norm, [s.id]);
    }
  }

  const imageIdsByStructureId = new Map<string, Set<string>>();
  const addLink = (structureId: string, imageId: string) => {
    const set = imageIdsByStructureId.get(structureId);
    if (set) set.add(imageId);
    else imageIdsByStructureId.set(structureId, new Set([imageId]));
  };

  for (const image of images) {
    const labels = image.mode === 'atlas-slide' ? (image.panelStructureNames ?? []) : [image.structureId ?? ''];

    for (const label of labels) {
      const norm = normalize(label);
      if (!norm) continue;
      const matchedIds = lookup.get(norm);
      if (!matchedIds) continue;
      for (const structureId of matchedIds) addLink(structureId, image.id);
    }
  }

  return structures.map((s) => {
    const linked = imageIdsByStructureId.get(s.id);
    if (!linked) return s;
    return { ...s, imageIds: [...new Set([...s.imageIds, ...linked])] };
  });
}
