import musclesRaw from '../source/muscles.raw.json';
import ta2Raw from '../source/ta2-mapping.raw.json';
import type { MuscleStructure, NerveRef } from '../../types/structure';
import type { Region, SubRegion } from '../../types/region';

/**
 * All 122 muscles, generated from Downloads/muscles.json + ta2-mapping.json
 * (copied verbatim into data/source/*.raw.json) rather than hand-typed —
 * this is a transform, not a seed literal, specifically to eliminate
 * transcription risk at this volume and stay in sync if the source files
 * are ever regenerated. See README "Adding a new structure" for the
 * update workflow.
 *
 * Fields with no equivalent in the source data (imageIds, eligibility,
 * difficulty, tags) are derived below rather than hand-maintained:
 * - imageIds: left empty here, populated by lib/linkImages.ts in index.ts
 *   by matching this muscle's name/aliases against every image's
 *   panelStructureNames.
 * - difficulty: no principled per-muscle signal exists in the source data,
 *   so every generated muscle defaults to 'medium' — adjust individual
 *   entries by hand later if you want finer-grained difficulty tiers.
 * - tags: reuses the source `groups` array.
 */

interface RawMuscleEntry {
  id: string;
  name: string;
  latin: string | null;
  region: string;
  groups: string[];
  partOf: string | null;
  origin: string[];
  insertion: string[];
  nerve: NerveRef[];
  actions: string[];
  actionText: string;
  clinical: string | null;
  notes: string | null;
  needsReview: boolean;
  nerveInferred: boolean;
  source: { deck?: string; author?: string; slides?: number[] } | null;
}

interface RawTa2Entry {
  id: string;
  ta2_english?: string;
  ta2_latin?: string;
}

const RAW_MUSCLES = (musclesRaw as unknown as { muscles: RawMuscleEntry[] }).muscles;
const TA2_BY_ID = new Map(
  (ta2Raw as unknown as { mapping: RawTa2Entry[] }).mapping.map((entry) => [entry.id, entry]),
);

/**
 * Best-effort region -> subregion heuristic from the muscle's `groups`
 * keywords. Not authoritative — the source data has no explicit subregion
 * field, so this is a reasonable default, not a guarantee. Override
 * individual entries by hand if one lands wrong.
 */
function inferSubregion(region: string, groups: string[]): SubRegion | undefined {
  const g = groups.join(' ').toLowerCase();

  switch (region) {
    case 'shoulder-arm':
      return /elbow/.test(g) ? 'elbow' : 'shoulder';
    case 'forearm-hand':
      return /elbow/.test(g) ? 'elbow' : 'wrist-hand';
    case 'hip-thigh':
      return /knee|quad|hamstring/.test(g) ? 'knee' : 'hip';
    case 'lower-leg-foot':
      return /knee|popliteus/.test(g) ? 'knee' : 'ankle-foot';
    case 'back-core':
      if (/neck|cervical/.test(g)) return 'neck';
      if (/abdom|core|pelvic-floor|pelvic/.test(g)) return 'torso';
      return 'spine';
    default:
      return undefined;
  }
}

/**
 * Handful of known aliases the source data can't derive on its own —
 * mostly cases where an atlas image splits/labels a muscle more finely
 * than muscles.json does. Found by cross-checking every atlas
 * panelStructureNames entry against the generated structures (see the
 * project's content-expansion review); NOT a general-purpose mechanism,
 * just a short, documented list. Muscles referenced by an atlas panel but
 * absent from muscles.json entirely (e.g. gemelli, psoas minor,
 * subclavius, coccygeus, levator ani, articularis genus, "Iliopsoas" as a
 * combined entity) are NOT patched here — that's a real content gap in the
 * source dataset, not a naming mismatch, and adding invented muscle data
 * to satisfy a panel label would be worse than leaving it unlinked.
 */
const EXTRA_ALIASES: Record<string, string[]> = {
  // muscles.json has one combined "Semispinalis" entry; the neck/back atlas
  // slide splits it into three regionally-highlighted panels.
  semispinalis: ['Semispinalis capitis', 'Semispinalis cervicis', 'Semispinalis thoracis'],
};

function buildAliases(id: string): string[] {
  const ta2 = TA2_BY_ID.get(id);
  const ta2Aliases = ta2 ? [ta2.ta2_english, ta2.ta2_latin].filter((v): v is string => !!v) : [];
  return [...ta2Aliases, ...(EXTRA_ALIASES[id] ?? [])];
}

export const MUSCLE_STRUCTURES: MuscleStructure[] = RAW_MUSCLES.map((m): MuscleStructure => {
  const region = m.region as Region;
  return {
    id: m.id,
    name: m.name,
    category: 'muscle',
    latin: m.latin,
    region,
    subregion: inferSubregion(m.region, m.groups),
    groups: m.groups,
    partOf: m.partOf,
    origin: m.origin,
    insertion: m.insertion,
    nerve: m.nerve,
    actions: m.actions,
    actionText: m.actionText,
    description: m.actionText,
    aliases: buildAliases(m.id),
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'medium',
    tags: m.groups,
    clinical: m.clinical,
    notes: m.notes,
    needsReview: m.needsReview,
    source: m.source,
  };
});
