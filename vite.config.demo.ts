import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { baseConfig, contentAliases, educatorDemoAliases } from './vite.config';

/**
 * Public demo build (`npm run build:demo`) — the seeded educator dashboard
 * deployed for course leaders to look at, see README "Educator demo mode".
 *
 * A SEPARATE CONFIG, not another mode inside vite.config.ts, because that
 * file's `command === 'serve'` check is what makes it structurally impossible
 * for `npm run build` or `npm run deploy` to resolve to the demo modules —
 * and those modules include an educator guard that always says yes and a role
 * hook that always returns admin. Keeping that invariant textually intact in
 * the production config is worth more than avoiding a second file.
 *
 * The demo is therefore reachable only by naming this file on the command
 * line, which no Netlify environment variable can do.
 */
/**
 * The demo's facts. It has no accounts, so it can never ask the content
 * function: asked for anything but `bundled`, it is built from the two-area
 * fixture (data/content/bundledContent.fixture.ts).
 *
 * `bundled` IS STILL THE DEFAULT, which means the public demo carries every
 * area's facts in its bundle exactly as it does today. Building it with
 * VITE_CONTENT_SOURCE=fixture is what stops that; it is the owner's call
 * (docs/CONTENT-SERVER-STATUS.md, decision 11).
 */
const demoContent = (mode: string) => {
  const source = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }.VITE_CONTENT_SOURCE;
  return source === 'fixture' || source === 'server' ? ('fixture' as const) : ('bundled' as const);
};

export default defineConfig(({ mode }) => ({
  ...baseConfig(),
  // Disabled, but present: the app imports virtual:pwa-register/react, which
  // only exists while the plugin is in the list. A demo is a link someone
  // opens once — a stale service worker serving a course leader last week's
  // build is a worse failure than no offline support on a page nobody revises
  // from.
  plugins: [...baseConfig().plugins, VitePWA({ disable: true })],
  resolve: { alias: [...educatorDemoAliases, ...contentAliases(demoContent(mode))] },
  build: {
    // Its own directory so a demo build can never be mistaken for dist/, which
    // is what netlify.toml publishes for the real site.
    outDir: 'dist-demo',
    emptyOutDir: true,
  },
  define: {
    // The base config's defines are kept: naming `define` here replaces the
    // spread one above rather than merging with it.
    ...baseConfig().define,
    // Folds at build time so App.tsx drops the /admin route and Rollup drops
    // the admin chunk with it — the demo is public, and CR-028 asks for those
    // routes absent rather than merely hidden.
    'import.meta.env.VITE_PUBLIC_DEMO': JSON.stringify('1'),
    // A hard guarantee the public demo cannot reach a real Firebase project
    // even if the demo Netlify site is given VITE_FIREBASE_* by accident:
    // AuthProvider only touches Firebase when this reads 'firestore'.
    'import.meta.env.VITE_PERSISTENCE': JSON.stringify('local'),
  },
}));
