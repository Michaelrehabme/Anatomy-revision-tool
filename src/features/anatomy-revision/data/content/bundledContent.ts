import { ALL_STRUCTURES } from '../seed';
import { AREAS } from '../../types/region';
import type { BundledContent } from './contentSource';

/**
 * The content a `bundled` build carries: all of it. THE DEFAULT, and what
 * production runs (see contentSource.ts for the three kinds and how one is
 * chosen).
 *
 * THE ONE FILE IN THE APP THAT MAY IMPORT THE STRUCTURE SEED. Everything else
 * reaches structures through here — data/structureIndex.ts for names,
 * hooks/useAnatomyContent.ts for facts — so that pointing this module's name
 * at bundledContent.server.ts takes every fact out of the bundle in one move.
 * eslint.config.js holds the rest of the app to that.
 *
 * The index IS the seed here, seen through the narrower type: the same
 * objects in the same order, at no cost in bytes, which is what keeps a
 * bundled build's questions exactly what they were before any of this.
 */
export const BUNDLED_CONTENT: BundledContent = {
  kind: 'bundled',
  index: ALL_STRUCTURES,
  structures: ALL_STRUCTURES,
  areas: AREAS,
  vocabulary: undefined,
  loader: undefined,
};
