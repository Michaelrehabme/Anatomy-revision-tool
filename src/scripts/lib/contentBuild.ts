import { createHash } from 'node:crypto';
import type { AnatomyStructure } from '../../features/anatomy-revision/types/structure';
import { AREAS, type Area } from '../../features/anatomy-revision/types/region';
import { buildAreaFacts, buildStructureIndex } from '../../features/anatomy-revision/data/content/split';
import { buildVocabulary } from '../../features/anatomy-revision/data/content/vocabulary';

/**
 * The seed, cut into what buildContent.ts writes to disk: the bundled index,
 * the bundled vocabulary, one payload of facts per area, and the version that
 * names this set of facts.
 *
 * Returned as STRINGS, the exact bytes of each file, because the bytes are
 * what has to be reproducible: the version is a hash of them, a client keeps
 * a fetched area until the version changes, and a build that wrote the same
 * content in a different key order would send every student back for nine
 * areas they already hold.
 */
export interface ContentBuild {
  /** JSON array of StructureIndexEntry, seed order. */
  index: string;
  /** JSON DistractorVocabulary. */
  vocabulary: string;
  /** Per area: JSON `{ area, structures, version }`. */
  areas: Record<Area, string>;
  /** JSON ContentVersionFile. */
  versionFile: string;
  version: string;
}

/** What `.content/version.json` holds. */
export interface ContentVersionFile {
  version: string;
  structures: number;
  /** Each area's own hash, size and count — for the build log, and for telling which area a change touched. */
  areas: Record<Area, { hash: string; bytes: number; structures: number }>;
}

/** Hex characters of SHA-256 kept. 64 bits: a label for a deploy's facts, not a security boundary. */
export const CONTENT_VERSION_LENGTH = 16;

const hashOf = (text: string): string =>
  createHash('sha256').update(text).digest('hex').slice(0, CONTENT_VERSION_LENGTH);

/**
 * JSON with every object's keys in code-point order, at every depth.
 *
 * JSON.stringify writes keys in the order they were inserted, and insertion
 * order is an accident of how a seed literal happened to be typed or which
 * spread built it. Sorting makes the output a function of the content alone.
 * Arrays keep their order — the order of a muscle's origins is content.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return v;
    const source = v as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(source)
        .sort()
        .map((k) => [k, source[k]]),
    );
  });
}

export function buildContent(structures: readonly AnatomyStructure[]): ContentBuild {
  const facts = buildAreaFacts(structures);
  const bodies = Object.fromEntries(
    AREAS.map((area) => [area, canonicalJson(facts[area].structures)]),
  ) as Record<Area, string>;

  // THE VERSION IS A HASH OF THE FACTS AND NOTHING ELSE. The index and the
  // vocabulary travel in the bundle and are replaced by every deploy; only the
  // facts are fetched and kept. A release that renames an alias or re-renders
  // a picture changes the index, leaves every fact as it was, and so must not
  // tell a student's device that the areas it holds are out of date.
  const version = hashOf(AREAS.map((area) => `${area}\n${bodies[area]}`).join('\n'));

  const versionFile: ContentVersionFile = {
    version,
    structures: structures.length,
    areas: Object.fromEntries(
      AREAS.map((area) => [
        area,
        {
          hash: hashOf(bodies[area]),
          bytes: Buffer.byteLength(bodies[area]),
          structures: facts[area].structures.length,
        },
      ]),
    ) as ContentVersionFile['areas'],
  };

  return {
    index: canonicalJson(buildStructureIndex(structures)),
    vocabulary: canonicalJson(buildVocabulary(structures)),
    areas: Object.fromEntries(
      AREAS.map((area) => [area, canonicalJson({ area, structures: facts[area].structures, version })]),
    ) as Record<Area, string>,
    versionFile: canonicalJson(versionFile),
    version,
  };
}
