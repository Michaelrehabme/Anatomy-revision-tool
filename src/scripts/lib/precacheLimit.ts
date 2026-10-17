/**
 * The largest file the service worker precaches (vite.config.ts) — and so the
 * size at which the build fails. Here so the build and checkPrecacheSize.ts
 * cannot disagree about it.
 */
export const PRECACHE_MAX_FILE_BYTES = 3 * 1024 * 1024;
