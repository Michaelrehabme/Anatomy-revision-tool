import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AUTHORED_STRUCTURES } from '../../../features/anatomy-revision/data/seed';
import { CONTENT_VERSION } from '../../../features/anatomy-revision/data/content/version';
import { AREAS } from '../../../features/anatomy-revision/types/region';
import type { AnatomyStructure } from '../../../features/anatomy-revision/types/structure';
import { buildContent, canonicalJson, CONTENT_VERSION_LENGTH, type ContentVersionFile } from '../contentBuild';
import { CONTENT_DIR, CONTENT_VERSION_FILE, GENERATED_CONTENT_DIR, isPublishedPath, PUBLISHED_DIRS } from '../contentPaths';
import { contentIsStale, generatedContentFiles } from '../ensureContent';
import { DEMO_FIXTURE_AREAS } from '../../../features/anatomy-revision/data/content/demoFixtureAreas';

/**
 * What buildContent.ts writes, as bytes. The split itself is tested beside it
 * (data/content/__tests__/split.test.ts); this is about the files: that the
 * same seed always produces the same ones, that the version moves when a fact
 * does and only then, and that none of it can land somewhere it is deployed.
 */

const built = buildContent(AUTHORED_STRUCTURES);

/** The same content with every object's keys inserted in the opposite order. */
function reverseKeys<T>(value: T): T {
  if (Array.isArray(value)) return value.map(reverseKeys) as T;
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .reverse()
      .map(([k, v]) => [k, reverseKeys(v)]),
  ) as T;
}

/** A copy of the seed with one structure changed. */
function withChange(id: string, change: (s: AnatomyStructure) => AnatomyStructure): AnatomyStructure[] {
  const changed = AUTHORED_STRUCTURES.map((s) => (s.id === id ? change(s) : s));
  expect(changed).not.toEqual(AUTHORED_STRUCTURES);
  return changed;
}

describe('canonicalJson', () => {
  it('writes keys in one order whatever order they were inserted in', () => {
    expect(canonicalJson({ b: 1, a: { d: [{ z: 1, y: 2 }], c: null } })).toBe('{"a":{"c":null,"d":[{"y":2,"z":1}]},"b":1}');
  });

  it('keeps arrays in their own order', () => {
    expect(canonicalJson(['b', 'a'])).toBe('["b","a"]');
  });

  it('parses back to the value it was given', () => {
    expect(JSON.parse(canonicalJson(AUTHORED_STRUCTURES[0]))).toEqual(JSON.parse(JSON.stringify(AUTHORED_STRUCTURES[0])));
  });
});

describe('the built content is deterministic', () => {
  it('produces the same bytes and the same version on a second run', () => {
    expect(buildContent(AUTHORED_STRUCTURES)).toEqual(built);
  });

  it('does not depend on the order keys were written in the seed', () => {
    expect(buildContent(reverseKeys(AUTHORED_STRUCTURES))).toEqual(built);
  });

  it('has no timestamp, path or machine detail in any file', () => {
    const everything = [built.index, built.vocabulary, built.versionFile, built.demoFixture, ...Object.values(built.areas)].join('\n');
    expect(everything).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    expect(everything).not.toMatch(/[A-Z]:\\\\|\/Users\/|\/home\//);
  });
});

describe('the content version', () => {
  it('is a short hex hash', () => {
    expect(built.version).toMatch(new RegExp(`^[0-9a-f]{${CONTENT_VERSION_LENGTH}}$`));
  });

  it('is stamped on every area payload and in the version file', () => {
    for (const area of AREAS) {
      const payload = JSON.parse(built.areas[area]) as { area: string; version: string; structures: unknown[] };
      expect(payload.area).toBe(area);
      expect(payload.version).toBe(built.version);
    }
    expect((JSON.parse(built.versionFile) as ContentVersionFile).version).toBe(built.version);
  });

  it('changes when a fact changes, and only that area\'s hash moves', () => {
    const changed = buildContent(
      withChange('patella', (s) => ({ ...s, description: `${s.description} (edited)` })),
    );
    expect(changed.version).not.toBe(built.version);
    const before = (JSON.parse(built.versionFile) as ContentVersionFile).areas;
    const after = (JSON.parse(changed.versionFile) as ContentVersionFile).areas;
    expect(AREAS.filter((area) => before[area].hash !== after[area].hash)).toEqual(['knee']);
  });

  // A student's device keeps an area until the version changes. A release
  // that only touches the bundle side must not send it back for all nine.
  it('does not change when only an index field changes', () => {
    const changed = buildContent(withChange('patella', (s) => ({ ...s, aliases: [...s.aliases, 'Kneecap bone'] })));
    expect(changed.index).not.toBe(built.index);
    expect(changed.version).toBe(built.version);
    expect(changed.areas).toEqual(built.areas);
  });

  // vite.config.ts defines it from the version file when one has been
  // generated, and 'dev' otherwise — which of the two depends on whether this
  // checkout has been built, so both are right here.
  it('reaches the app as a define', () => {
    expect(CONTENT_VERSION).toMatch(new RegExp(`^(dev|[0-9a-f]{${CONTENT_VERSION_LENGTH}})$`));
  });

  it('summarises each area in the version file', () => {
    const file = JSON.parse(built.versionFile) as ContentVersionFile;
    expect(file.structures).toBe(AUTHORED_STRUCTURES.length);
    for (const area of AREAS) {
      const payload = JSON.parse(built.areas[area]) as { structures: unknown[] };
      expect(file.areas[area].structures).toBe(payload.structures.length);
      expect(file.areas[area].bytes).toBeGreaterThan(0);
    }
  });
});

/**
 * The public demo's facts, when it is built from the fixture. Whatever is in
 * this file is in a bundle anyone can open, so the test that matters is that
 * it holds the two areas it says and not a structure more.
 */
describe('the demo fixture', () => {
  const fixture = JSON.parse(built.demoFixture) as { version: string; areas: { area: string; structures: { id: string }[] }[] };

  it('holds exactly the chosen areas, as their payloads hold them', () => {
    expect(DEMO_FIXTURE_AREAS).toHaveLength(2);
    expect(fixture.areas.map((a) => a.area)).toEqual([...DEMO_FIXTURE_AREAS]);
    expect(fixture.version).toBe(built.version);
    for (const held of fixture.areas) {
      const payload = JSON.parse(built.areas[held.area as (typeof AREAS)[number]]) as { structures: unknown[] };
      expect(held.structures).toEqual(payload.structures);
    }
  });

  it('holds the facts of no structure outside those areas', () => {
    const allowed = new Set(
      DEMO_FIXTURE_AREAS.flatMap((area) => (JSON.parse(built.areas[area]) as { structures: { id: string }[] }).structures.map((s) => s.id)),
    );
    const held = fixture.areas.flatMap((a) => a.structures.map((s) => s.id));
    expect(held.filter((id) => !allowed.has(id))).toEqual([]);
    expect(allowed.size).toBeLessThan(AUTHORED_STRUCTURES.length / 2);
  });
});

/**
 * vite.config.ts regenerates the content when it is missing or stale, so a
 * fresh checkout can run its dev server and tests. That same config is what
 * is running this test, so by now the content must be current.
 */
describe('generated content is kept current without anyone running a command', () => {
  it('is present and not older than the seed by the time a test runs', () => {
    expect(contentIsStale()).toBeNull();
  });

  it('writes only to the two git-ignored directories', () => {
    for (const file of generatedContentFiles()) {
      expect(file.startsWith(`${CONTENT_DIR}/`) || file.startsWith(`${GENERATED_CONTENT_DIR}/`), file).toBe(true);
    }
  });
});

describe('where the content is written', () => {
  it('keeps the facts out of every directory that is deployed', () => {
    expect(isPublishedPath(CONTENT_DIR)).toBe(false);
    expect(isPublishedPath(CONTENT_VERSION_FILE)).toBe(false);
    expect(isPublishedPath(GENERATED_CONTENT_DIR)).toBe(false);
  });

  it('knows a published path when it sees one', () => {
    for (const dir of PUBLISHED_DIRS) {
      expect(isPublishedPath(dir)).toBe(true);
      expect(isPublishedPath(`${dir}/content/areas`)).toBe(true);
      expect(isPublishedPath(`./${dir}\\content`)).toBe(true);
    }
    expect(isPublishedPath('publications')).toBe(false);
  });

  // Committed area files would be the paid content in the repository, and an
  // untracked directory makes `npm run deploy` refuse a dirty tree.
  //
  // Read from beside this file, not from the working directory: a test run
  // started in another checkout reaches this file through its worktree, and
  // would otherwise be checking that checkout's .gitignore instead.
  it('is git-ignored, both directories', () => {
    // Through `path`, not `new URL(...)`: under jsdom the global URL is not
    // Node's, and fileURLToPath refuses an instance of it.
    const gitignore = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../.gitignore');
    const ignored = readFileSync(gitignore, 'utf8').split(/\r?\n/);
    expect(ignored).toContain(`/${CONTENT_DIR}/`);
    expect(ignored).toContain(`/${GENERATED_CONTENT_DIR}/`);
  });
});
