import indexJson from './generated/structureIndex.json';
import vocabularyJson from './generated/vocabulary.json';
import { ALL_IMAGES } from '../images';
import { linkImages } from '../../lib/linkImages';
import type { StructureIndexEntry } from '../../types/structureIndex';
import type { DistractorVocabulary } from './vocabulary';
import type { BundledContent } from './contentSource';
import { serverAreaFactsLoader } from './serverLoader';

/**
 * The content a `server` build carries: the index and the vocabulary, and NOT
 * ONE FACT (contentSource.ts). vite.config.ts points `bundledContent` here
 * when VITE_CONTENT_SOURCE=server.
 *
 * Nothing in this file, or reachable from it, imports the structure seed.
 * That is the property the build check tests for by reading the built chunks
 * (src/scripts/checkBundleForFacts.ts), and the reason this is a separate file
 * rather than a branch.
 *
 * The index is cut BEFORE pictures are linked — written linked it was a
 * megabyte of turntable frame ids — so it is linked here, at load, by the same
 * function that links the seed. split.test.ts holds the two to the same
 * result.
 */
export const BUNDLED_CONTENT: BundledContent = {
  kind: 'server',
  index: linkImages(indexJson as unknown as StructureIndexEntry[], ALL_IMAGES),
  structures: [],
  areas: [],
  vocabulary: vocabularyJson as unknown as DistractorVocabulary,
  loader: serverAreaFactsLoader,
};
