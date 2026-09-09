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
   */
  { ignores: ['dist', 'dist-demo', 'coverage', 'tools', 'atlas', 'renders', 'deploy', 'atlas-panel-exports'] },
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
);
