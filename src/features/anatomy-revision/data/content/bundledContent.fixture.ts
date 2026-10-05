import indexJson from './generated/structureIndex.json';
import vocabularyJson from './generated/vocabulary.json';
import fixtureJson from './generated/demoFixture.json';
import { ALL_IMAGES } from '../images';
import { linkImages } from '../../lib/linkImages';
import type { StructureIndexEntry } from '../../types/structureIndex';
import type { DistractorVocabulary } from './vocabulary';
import type { BundledContent } from './contentSource';
import { joinLoadedAreas, type AreaFacts } from './split';

/**
 * The content the PUBLIC DEMO carries when it is built from the reduced
 * fixture: the index, the vocabulary, and the facts of two areas
 * (demoFixtureAreas.ts says which two and why). vite.config.demo.ts points
 * `bundledContent` here when VITE_CONTENT_SOURCE is `fixture` or `server`.
 *
 * NO LOADER. The demo has no accounts, so there is no token to send and
 * nobody to ask; the other seven areas are simply not part of it, and the
 * screens say so rather than offering a retry that cannot succeed.
 *
 * Everything in this file is public the moment the demo is deployed. That is
 * the point of the fixture: two areas given away on purpose instead of nine
 * by accident.
 */
const index = linkImages(indexJson as unknown as StructureIndexEntry[], ALL_IMAGES);
const fixture = fixtureJson as unknown as { version: string; areas: AreaFacts[] };

export const BUNDLED_CONTENT: BundledContent = {
  kind: 'fixture',
  index,
  structures: joinLoadedAreas(index, fixture.areas),
  areas: fixture.areas.map((a) => a.area),
  vocabulary: vocabularyJson as unknown as DistractorVocabulary,
  loader: undefined,
};
