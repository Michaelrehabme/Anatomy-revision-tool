import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/** Forward slashes even on Windows — Rollup's alias plugin compares and rewrites ids as POSIX-style strings. */
const demoFile = (name: string) =>
  fileURLToPath(new URL(`./src/features/educator/demo/${name}`, import.meta.url)).replace(/\\/g, '/');

/**
 * Educator demo mode (`npm run dev:educator-demo`) — see README.
 * Swaps the three Firebase-backed educator modules and the claim guard for
 * the fixture versions in src/features/educator/demo/, so /educator can be
 * reviewed with no Firebase project and no custom claim.
 *
 * Done as an alias rather than an `if (DEMO)` branch inside each repository
 * so that production code carries no demo path at all, and so the dev-server
 * check below is the only thing standing between a deployment and an
 * always-allow guard — one condition, in one place, rather than four.
 *
 * Each `find` matches the WHOLE relative specifier its importers use
 * ('../data/cohortsRepository', '../../../educator/data/cohortsRepository') —
 * a regex alias replaces only the matched portion, so a pattern that matched
 * just the tail would leave the '..' prefix glued to an absolute path.
 */
const educatorDemoAliases = [
  { find: /^.*\/data\/cohortsRepository$/, replacement: demoFile('cohortsRepository.demo.ts') },
  { find: /^.*\/data\/assignmentsRepository$/, replacement: demoFile('assignmentsRepository.demo.ts') },
  { find: /^.*\/data\/cohortAnalytics$/, replacement: demoFile('cohortAnalytics.demo.ts') },
  // Screens import the guard as both './components/RequireEducator' and '../RequireEducator'.
  { find: /^.*\/RequireEducator$/, replacement: demoFile('RequireEducator.demo.tsx') },
  // Admin-side role screens, so /admin/people is reviewable without a real grant.
  { find: /^.*\/RequireAdmin$/, replacement: demoFile('adminDemo.tsx') },
  { find: /^.*\/roles\/useCurrentRole$/, replacement: demoFile('adminDemo.tsx') },
  { find: /^.*\/roles\/rolesRepository$/, replacement: demoFile('adminDemo.tsx') },
  { find: /^.*\/data\/usersRepository$/, replacement: demoFile('adminDemo.tsx') },
  // An empty local repository leaves the account screen's chart with nothing to draw.
  { find: /^.*\/data\/repository$/, replacement: demoFile('repositoryDemo.ts') },
  // Local mode disables auth, which would hide the account screen's Classes section.
  { find: /^.*\/context\/AuthProvider$/, replacement: demoFile('authDemo.ts') },
];

export default defineConfig(({ command, mode }) => {
  // `command === 'serve'` is the hard guarantee: `npm run build` cannot resolve
  // to the demo modules whatever the mode or env says.
  const demo = command === 'serve' && (mode === 'educator-demo' || process.env.VITE_EDUCATOR_DEMO === '1');

  return {
    plugins: [react(), tailwindcss()],
    resolve: demo ? { alias: educatorDemoAliases } : {},
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.ts',
    },
  };
});
