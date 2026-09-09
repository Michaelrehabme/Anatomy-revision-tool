import { defineConfig } from 'vite';
import { baseConfig, educatorDemoAliases } from './vite.config';

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
export default defineConfig(() => ({
  ...baseConfig(),
  resolve: { alias: educatorDemoAliases },
  build: {
    // Its own directory so a demo build can never be mistaken for dist/, which
    // is what netlify.toml publishes for the real site.
    outDir: 'dist-demo',
    emptyOutDir: true,
  },
  define: {
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
