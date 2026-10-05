import { defineConfig } from 'vitest/config';

/**
 * Firestore rules tests — run by `npm run test:rules`, which starts the
 * emulator around them. Kept out of `npm test` because they need Java and a
 * running emulator; see rules-tests/firestore.rules.test.ts.
 */
export default defineConfig({
  test: {
    include: ['rules-tests/**/*.test.ts'],
    environment: 'node',
    // One emulator, one database: files must not clear each other's data.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
