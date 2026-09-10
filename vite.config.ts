import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

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
export const educatorDemoAliases = [
  { find: /^.*\/data\/cohortsRepository$/, replacement: demoFile('cohortsRepository.demo.ts') },
  { find: /^.*\/data\/assignmentsRepository$/, replacement: demoFile('assignmentsRepository.demo.ts') },
  { find: /^.*\/data\/cohortAnalytics$/, replacement: demoFile('cohortAnalytics.demo.ts') },
  // Reached from CohortMembership, which is a SHARED component rather than an
  // educator-only one — without this alias the demo build pulls the whole
  // Firebase client in through it, defeating the persistence pin below.
  { find: /^.*\/data\/invitesRepository$/, replacement: demoFile('invitesRepository.demo.ts') },
  // Same problem from the account screen: accountLifecycle imports
  // firebase/auth at the top level to delete the Auth user.
  { find: /^.*\/data\/accountLifecycle$/, replacement: demoFile('accountLifecycle.demo.ts') },
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

/**
 * Service worker config (CR-023 item 3).
 *
 * TWO DELIBERATE DEPARTURES from what that CR asks for.
 *
 * It says to precache the app shell — but NOT the 4.2MB of anatomy imagery,
 * which is runtime-cached instead. Precaching every render would make a first
 * visit download the whole atlas before the app is usable, on a phone, on
 * hospital wifi, to answer one question. Images arrive as they are seen, and
 * the explicit per-area download (CR-023 item 4) is how a student takes a
 * region offline on purpose.
 *
 * It also asks for a NetworkFirst Workbox rule over Firestore. That is the
 * wrong tool and is not implemented: Firestore does not speak plain HTTP GET,
 * it runs a long-lived WebChannel, and putting a Workbox handler in front of
 * it breaks realtime listeners rather than making them offline-capable.
 * Firestore's own persistentLocalCache is the supported mechanism and is
 * wired up in data/firebase.ts instead.
 *
 * registerType is 'prompt', never 'autoUpdate': a silent reload mid-session
 * loses a student's answers.
 */
const pwa = (disable: boolean) =>
  VitePWA({
    // Kept in the plugin list even when disabled so virtual:pwa-register/react
    // still resolves — the demo build imports the same components, it just
    // gets no-ops instead of a service worker.
    disable,
    registerType: 'prompt',
    // public/manifest.webmanifest is committed and generated alongside the
    // icon set (src/scripts/generateIcons.ts). Letting the plugin write its
    // own would give two manifests disagreeing about the brand.
    manifest: false,
    injectRegister: null,
    workbox: {
      // Shell and fonts only. woff2 is here because self-hosting them was
      // half of why offline works at all — a CDN font request fails with no
      // network and blocks first paint.
      globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      globIgnores: ['**/anatomy/**'],
      navigateFallback: '/index.html',
      // The legal pages must stay reachable, but they are inside the SPA, so
      // the fallback covers them. Firestore and Google endpoints are excluded
      // from navigation fallback entirely.
      navigateFallbackDenylist: [/^\/api\//, /^https:\/\//],
      cleanupOutdatedCaches: true,
      runtimeCaching: [
        {
          urlPattern: ({ url }) => url.pathname.startsWith('/anatomy/'),
          handler: 'CacheFirst',
          options: {
            cacheName: 'locusmsk-anatomy-images',
            expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ],
    },
    devOptions: { enabled: false },
  });

/**
 * Everything both this config and vite.config.demo.ts need. A factory rather
 * than a shared object so each config evaluation gets its own plugin
 * instances instead of two loads passing the same ones between them.
 */
export const baseConfig = () => ({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});

export default defineConfig(({ command, mode }) => {
  // `command === 'serve'` is the hard guarantee: `npm run build` cannot resolve
  // to the demo modules whatever the mode or env says. The public demo build
  // reaches them through vite.config.demo.ts, which must be named on the
  // command line — see that file for why it is a separate config and not
  // another mode here.
  const demo = command === 'serve' && (mode === 'educator-demo' || process.env.VITE_EDUCATOR_DEMO === '1');

  const base = baseConfig();

  return {
    ...base,
    // No service worker in the demo build. The demo is a public sales asset
    // whose whole job is to show current work to someone who opens the link
    // once; a stale cached copy served to a course leader is a worse failure
    // than no offline support on a page nobody revises from.
    plugins: [...base.plugins, pwa(demo)],
    resolve: demo ? { alias: educatorDemoAliases } : {},
  };
});
