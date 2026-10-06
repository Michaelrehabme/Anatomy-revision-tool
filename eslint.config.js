import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  /*
   * These are the same paths .gitignore excludes, and they have to be repeated
   * because ESLint's flat config does not read .gitignore. Without them lint
   * walks tools/ — a vendored 2GB Blender install with a bundled Playwright —
   * and reports a thousand errors in vendored JavaScript nobody here wrote,
   * which buries the handful in src/ that matter.
   *
   * android/ is the Capacitor trial's native project (docs/native-wrapper-trial.md):
   * `cap sync` copies the built bundle into it, and linting a minified copy of
   * dist/ is the same mistake as linting dist/.
   */
  { ignores: ['dist', 'dist-demo', 'coverage', 'tools', 'atlas', 'renders', 'deploy', 'atlas-panel-exports', 'android', '.content'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  /*
   * STRUCTURE FACTS ARE IMPORTED IN ONE PLACE
   * (docs/DESIGN-CONTENT-BEHIND-SERVER.md, step 7).
   *
   * A build made with VITE_CONTENT_SOURCE=server carries no facts: the app
   * fetches them per area for whoever is entitled. That holds only while the
   * app reaches the seed through data/content/bundledContent.ts, which such a
   * build swaps for a file that imports none of it. One stray
   * `import { ALL_STRUCTURES } from '../data/seed'` in a component puts every
   * origin and nerve back in the bundle, and nothing would fail.
   *
   * NOT ALL OF data/seed, which is what the design first said: the pictures,
   * the plates and the hotspot polygons live there too and are public. What
   * is banned is the seed's index (which pulls in every structure), the
   * structure files themselves, the generated blood supply, and the raw
   * muscle source.
   *
   * Tests, the build scripts and the seed's own files may import it; so may
   * bundledContent.ts, which is the one place. The build check
   * (src/scripts/checkBundleForFacts.ts) is the second line: it reads the
   * built chunks of a server build and fails if a fact is in any of them.
   *
   * ONE FILE OF FACTS IS MEANT TO BE IN EVERY BUILD, and this rule does not
   * and must not catch it: data/diagnostic/fixedSample.v<N>.json, the
   * diagnostic's fixed paper — fifteen finished questions, public by the
   * owner's decision (lib/diagnosticSample.ts lists what it publishes). It is
   * not the seed and imports nothing from it; it was written from the seed
   * once, by a script. The build check is where the exception is policed:
   * the paper's strings are allowed in the built file that carries the paper
   * and nowhere else (src/scripts/lib/bundleFacts.ts). Do not add a second
   * such file by analogy. A fact that should be public goes in that paper, as
   * a question, under a new version.
   */
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      'src/**/__tests__/**',
      'src/**/*.test.{ts,tsx}',
      'src/test/**',
      'src/scripts/**',
      'src/features/anatomy-revision/data/seed/**',
      'src/features/anatomy-revision/data/content/bundledContent.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^|/)seed(/index)?$',
              message:
                'This imports every structure\'s facts. Use STRUCTURE_INDEX (data/structureIndex) for names, the content hook for facts, or data/images for pictures.',
            },
            {
              regex: '/seed/structures\\.[^/]*seed$|/seed/bloodSupply\\.generated$|/source/[^/]*\\.raw\\.json$',
              message: 'Structure facts may only be imported by data/content/bundledContent.ts.',
            },
          ],
        },
      ],
    },
  },
);
