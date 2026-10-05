import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { BUNDLED_CONTENT as BUNDLED } from '../bundledContent';
import { BUNDLED_CONTENT as SERVER } from '../bundledContent.server';
import { BUNDLED_CONTENT as FIXTURE } from '../bundledContent.fixture';
import { DEMO_FIXTURE_AREAS } from '../demoFixtureAreas';
import { ALL_STRUCTURES } from '../../seed';
import { AREAS } from '../../../types/region';
import { areasOf } from '../../../types/structure';
import { STRUCTURE_FACT_FIELDS, STRUCTURE_FACT_FIELDS_NOT_SERVED } from '../../../types/structureIndex';
import { requiredFactKinds } from '../../../lib/factMastery';
import { structureLevel } from '../../../lib/masteryLevel';
import type { FactMastery, StructureMastery } from '../../../types/attempt';

/**
 * The three things `bundledContent` can be (data/content/contentSource.ts).
 * A build picks one by alias; here all three are imported by name and held
 * against each other, because what must be true is a relation between them:
 * the same structures in the same order, with or without their facts.
 */

const FACT_FIELDS = new Set<string>(STRUCTURE_FACT_FIELDS);
const withoutUnserved = <T extends object>(s: T): T => {
  const copy = { ...s } as Record<string, unknown>;
  for (const field of STRUCTURE_FACT_FIELDS_NOT_SERVED) delete copy[field];
  return copy as T;
};
const wire = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe('a bundled build', () => {
  it('carries every structure with its facts, and is the seed itself', () => {
    expect(BUNDLED.kind).toBe('bundled');
    expect(BUNDLED.structures).toBe(ALL_STRUCTURES);
    expect(BUNDLED.index).toBe(ALL_STRUCTURES);
    expect(BUNDLED.areas).toEqual(AREAS);
    expect(BUNDLED.loader).toBeUndefined();
    // Nothing is missing for a vocabulary to stand in for.
    expect(BUNDLED.vocabulary).toBeUndefined();
  });
});

describe('a server build', () => {
  it('carries every structure in the same order, and not one fact', () => {
    expect(SERVER.kind).toBe('server');
    expect(SERVER.structures).toEqual([]);
    expect(SERVER.areas).toEqual([]);
    expect(SERVER.index.map((s) => s.id)).toEqual(ALL_STRUCTURES.map((s) => s.id));
    for (const entry of SERVER.index) {
      expect(Object.keys(entry).filter((k) => FACT_FIELDS.has(k)), entry.id).toEqual([]);
    }
  });

  it('names, places and pictures every structure exactly as the seed does', () => {
    for (const [i, s] of ALL_STRUCTURES.entries()) {
      const e = SERVER.index[i];
      expect([e.name, e.category, e.region, e.subregion, areasOf(e), e.imageIds], s.id).toEqual([
        s.name, s.category, s.region, s.subregion, areasOf(s), s.imageIds,
      ]);
    }
  });

  // The promise behind the `factKinds` index field: a level worked out for a
  // structure whose facts are NOT on the device is the level its facts would
  // give. Checked with a history that reaches every kind of fact.
  it('gives every structure the mastery level its facts would give', () => {
    const now = new Date('2026-10-05T12:00:00.000Z');
    const mastery = (id: string): StructureMastery => ({
      structureId: id, userId: 'u', attemptsTotal: 6, attemptsCorrect: 6, lastAttemptAt: now.toISOString(),
      rung: 'typed-bare', rungStreak: 3, rungMissStreak: 0,
    });
    for (const [i, s] of ALL_STRUCTURES.entries()) {
      const kinds = requiredFactKinds(s);
      expect(requiredFactKinds(SERVER.index[i]), s.id).toEqual(kinds);
      const facts = new Map<string, FactMastery>(
        kinds.slice(0, 2).map((promptKind) => [
          `${s.id}::${promptKind}`,
          { userId: 'u', structureId: s.id, promptKind, attemptsTotal: 5, attemptsCorrect: 5, streak: 3, missStreak: 0, lastCorrect: true, lastAttemptAt: now.toISOString(), typed: true, bare: true },
        ]),
      );
      const fromFacts = structureLevel(s, mastery(s.id), facts, now);
      const fromIndex = structureLevel(SERVER.index[i], mastery(s.id), facts, now);
      expect(fromIndex, s.id).toEqual(fromFacts);
    }
  });

  it('has a loader and a vocabulary', () => {
    expect(SERVER.loader).toBeDefined();
    expect(SERVER.vocabulary?.nerves.length).toBeGreaterThan(20);
  });
});

describe('a fixture build (the public demo)', () => {
  it('carries the facts of the chosen two areas and no others', () => {
    expect(FIXTURE.kind).toBe('fixture');
    expect(FIXTURE.areas).toEqual([...DEMO_FIXTURE_AREAS]);
    expect(FIXTURE.loader).toBeUndefined();
    const expected = ALL_STRUCTURES.filter((s) => areasOf(s).some((a) => DEMO_FIXTURE_AREAS.includes(a)));
    expect(FIXTURE.structures.map((s) => s.id)).toEqual(expected.map((s) => s.id));
    expect(FIXTURE.structures.length).toBeLessThan(ALL_STRUCTURES.length / 2);
  });

  it('holds those structures exactly as the seed does, less what is served to nobody', () => {
    const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
    for (const s of FIXTURE.structures) {
      expect(wire(s), s.id).toEqual(wire(withoutUnserved(byId.get(s.id)!)));
    }
  });

  it('still names every structure', () => {
    expect(FIXTURE.index.map((s) => s.id)).toEqual(ALL_STRUCTURES.map((s) => s.id));
  });
});

/**
 * vite.config.ts swaps the build's content by rewriting the import
 * specifier `…/bundledContent`. Rollup's alias matches the specifier AS
 * WRITTEN, so an import spelled with an extension, or of a file this test
 * does not know, would quietly keep the seed in a server build. (The demo's
 * Firebase stand-ins regressed exactly this way — see demoIsolation.test.ts.)
 */
describe('how the app reaches its content', () => {
  const SRC = join(process.cwd(), 'src');
  function* walk(dir: string): Generator<string> {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) yield* walk(path);
      else if (/\.(ts|tsx)$/.test(name)) yield path;
    }
  }
  const isTest = (file: string) => file.includes(`${sep}__tests__${sep}`) || /\.test\.tsx?$/.test(file);
  const isScript = (file: string) => file.startsWith(join(SRC, 'scripts'));
  const files = [...walk(SRC)].filter((f) => !isTest(f) && !isScript(f));
  const importsOf = (file: string) =>
    [...readFileSync(file, 'utf8').matchAll(/(?:from|import\()\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);

  it('imports bundledContent only by the specifier the alias rewrites', () => {
    const offenders: string[] = [];
    let importers = 0;
    for (const file of files) {
      for (const spec of importsOf(file)) {
        if (!/bundledContent/.test(spec)) continue;
        importers += 1;
        if (!/^.*\/bundledContent$/.test(spec)) offenders.push(`${file}: ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
    expect(importers).toBeGreaterThanOrEqual(6);
  });

  // The lint rule (eslint.config.js) says the same thing with better error
  // messages; this is the copy that runs with the tests and cannot be
  // switched off by a disable comment.
  it('imports the structure seed from exactly one place', () => {
    const SEED = /(^|\/)seed(\/index)?$|\/seed\/structures\.[^/]*seed$|\/seed\/bloodSupply\.generated$|\/source\/[^/]*\.raw\.json$/;
    const importers = new Set<string>();
    for (const file of files) {
      if (file.includes(`${sep}data${sep}seed${sep}`)) continue; // the seed's own files
      if (importsOf(file).some((spec) => SEED.test(spec))) importers.add(file.slice(SRC.length + 1).split(sep).join('/'));
    }
    expect([...importers]).toEqual(['features/anatomy-revision/data/content/bundledContent.ts']);
  });
});
