/**
 * Where buildContent.ts writes, relative to the repo root, and the one rule
 * about where it must not.
 *
 * Apart from the script so that vite.config.ts can read the version file from
 * the same place without importing the seed, and so the rule has a test.
 */

/** Server-side output: the per-area facts and the version file. Git-ignored. */
export const CONTENT_DIR = '.content';

/** The version file inside CONTENT_DIR. */
export const CONTENT_VERSION_FILE = `${CONTENT_DIR}/version.json`;

/** Bundle-side output: the index and the vocabulary. Git-ignored until the app imports them. */
export const GENERATED_CONTENT_DIR = 'src/features/anatomy-revision/data/content/generated';

/**
 * Directories whose contents reach the deployed site: public/ is copied into
 * each build verbatim, and the two dist directories ARE the builds.
 */
export const PUBLISHED_DIRS = ['public', 'dist', 'dist-demo'] as const;

/** True when a repo-relative path is, or is inside, a directory that is deployed. */
export function isPublishedPath(relativePath: string): boolean {
  const first = relativePath.replace(/\\/g, '/').replace(/^\.\//, '').split('/')[0];
  return (PUBLISHED_DIRS as readonly string[]).includes(first);
}
