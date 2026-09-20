import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * The public demo must not contain the Firebase SDK.
 *
 * vite.config.demo.ts pins VITE_PERSISTENCE to 'local' as "a hard guarantee
 * the public demo cannot reach a real Firebase project" — but that only holds
 * if nothing drags the client in through a static import. Any module that
 * imports firebase/* at the top level puts the whole SDK in the bundle the
 * moment something in the demo's reachable graph imports it, whatever the
 * persistence flag says.
 *
 * THIS REGRESSED TWICE IN ONE DAY and neither time did anything fail:
 * accountLifecycle.ts (account deletion, imported unconditionally by the
 * account screen) and invitesRepository.ts (imported by CohortMembership,
 * which is a SHARED component, not an educator one). Both built cleanly, both
 * passed every test, and both shipped a Firebase client into the demo. The
 * only thing that caught them was grepping dist-demo by hand.
 *
 * So this is a canary rather than a proof. It cannot follow the import graph,
 * but it can notice that the set of Firebase-importing modules has changed,
 * and make whoever changed it answer the question: is this reachable from the
 * demo, and if so, is it aliased in educatorDemoAliases?
 */

const SRC = join(process.cwd(), 'src');

/**
 * Every module importing the SDK, and why the demo does not get it.
 *
 * Adding a module here is a deliberate act. If it is reachable from a shared
 * component or the account screen it needs an alias in vite.config.ts, and a
 * demo stand-in beside this file.
 */
const KNOWN: Record<string, string> = {
  'features/anatomy-revision/data/firebase.ts': 'The SDK wrapper itself. Only reached through the modules below.',
  'features/anatomy-revision/context/AuthProvider.tsx': 'Aliased: authDemo.ts',
  'features/anatomy-revision/data/firestoreRepository.ts': 'Reached via data/repository, aliased: repositoryDemo.ts',
  'features/anatomy-revision/data/accountLifecycle.ts': 'Aliased: accountLifecycle.demo.ts',
  'features/anatomy-revision/data/entitlementRepository.ts': 'Aliased: entitlementRepository.demo.ts',
  'features/anatomy-revision/data/__tests__/authLinking.test.ts': 'A test; never bundled.',
  'features/educator/data/cohortsRepository.ts': 'Aliased: cohortsRepository.demo.ts',
  'features/educator/data/assignmentsRepository.ts': 'Aliased: assignmentsRepository.demo.ts',
  'features/educator/data/assignmentTemplatesRepository.ts': 'Aliased: assignmentTemplatesRepository.demo.ts',
  'features/educator/data/invitesRepository.ts': 'Aliased: invitesRepository.demo.ts',
  'features/educator/data/cohortRollups.ts': 'Reached only via cohortAnalytics, aliased: cohortAnalytics.demo.ts',
  'features/roles/rolesRepository.ts': 'Aliased: adminDemo.tsx',
  'features/admin/data/usersRepository.ts': 'Aliased: adminDemo.tsx',
  'features/admin/data/changeRequestsRepository.ts': 'Admin-only; VITE_PUBLIC_DEMO drops the /admin route and its chunk.',
  'features/admin/data/questionReviewsRepository.ts': 'Admin-only; same.',
  'scripts/backfillCohortRollups.ts': 'A one-off Node script run with tsx; never imported by the app.',
  'features/site/data/siteSettings.ts': 'Aliased: siteSettings.demo.ts — App.tsx reads it on every load.',
};

/**
 * Modules the demo replaces by ALIAS, and the suffix an import of each must
 * end with for vite.config.ts to rewrite it.
 *
 * Rollup's alias plugin matches the import specifier as written, not the file
 * it resolves to. So `../../roles/useCurrentRole` is rewritten to the demo
 * stand-in and `./useCurrentRole` — the natural spelling from a sibling inside
 * features/roles/ — is not, which silently pulls the real module, and the
 * whole Firebase SDK behind it, into the public demo bundle.
 *
 * That is exactly how this regressed: a useAdminEntry hook added in
 * features/roles/ imported its neighbour relatively, and every test here
 * passed, because the canary below only sees DIRECT firebase importers and
 * useCurrentRole reaches the SDK through the local wrapper. Only grepping
 * dist-demo caught it. This check is cheaper than that.
 */
const ALIASED_SUFFIXES = ['roles/useCurrentRole', 'roles/rolesRepository'];

describe('alias-bypassing imports', () => {
  it('imports every demo-aliased module by a specifier the alias actually matches', () => {
    const offenders: string[] = [];

    for (const file of walk(SRC)) {
      if (file.includes(`${sep}demo${sep}`)) continue; // The stand-ins themselves.
      const source = readFileSync(file, 'utf8');

      for (const suffix of ALIASED_SUFFIXES) {
        const name = suffix.split('/')[1];
        const pattern = new RegExp(`from '([^']*${name})'`, 'g');
        for (const [, specifier] of source.matchAll(pattern)) {
          if (specifier.endsWith(suffix)) continue;
          offenders.push(`${relative(SRC, file)} imports '${specifier}' — must end with '${suffix}'`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function firebaseImporters(): string[] {
  return walk(SRC)
    .filter((file) => /from '(firebase\/[a-z]+|firebase-admin\/[a-z]+)'/.test(readFileSync(file, 'utf8')))
    .map((file) => file.slice(SRC.length + 1).split('\\').join('/'))
    .sort();
}

describe('demo build cannot reach Firebase', () => {
  it('has no unaccounted-for module importing the Firebase SDK', () => {
    const unexpected = firebaseImporters().filter((f) => !(f in KNOWN));
    expect(
      unexpected,
      'These import the Firebase SDK and are not accounted for in demoIsolation.test.ts. ' +
        'If any is reachable from a shared component or the account screen, the public demo will ship ' +
        'a Firebase client: add an alias to educatorDemoAliases in vite.config.ts and a stand-in in ' +
        `features/educator/demo/. Unaccounted: ${unexpected.join(', ')}`,
    ).toEqual([]);
  });

  it('lists nothing that has stopped importing Firebase', () => {
    const actual = new Set(firebaseImporters());
    const stale = Object.keys(KNOWN).filter((f) => !actual.has(f)).sort();
    expect(stale, `Listed but no longer imports Firebase — drop it: ${stale.join(', ')}`).toEqual([]);
  });

  it('has a demo stand-in for every aliased data module', () => {
    const config = readFileSync(join(process.cwd(), 'vite.config.ts'), 'utf8');
    const aliased = [...config.matchAll(/demoFile\('([^']+)'\)/g)].map((m) => m[1]);
    const present = readdirSync(join(SRC, 'features/educator/demo'));
    const missing = aliased.filter((f) => !present.includes(f));
    expect(missing, `Aliased in vite.config.ts but absent: ${missing.join(', ')}`).toEqual([]);
  });
});
