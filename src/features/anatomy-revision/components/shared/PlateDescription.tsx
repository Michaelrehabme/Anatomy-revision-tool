import { createContext, useContext, useEffect, useState } from 'react';
import type { AnatomyImageAsset } from '../../types/image';
import type { AnatomyStructure } from '../../types/structure';
import type { PlateConceal } from '../../lib/plateLabel';

/**
 * What a description is written from: every image (a highlight plate reads
 * its context twin's hotspots) and every structure (for names and
 * attachments). Provided once by each session shell, so the question screens
 * between it and the viewer do not each have to pass the catalogue down.
 */
export interface PlateCatalogue {
  imagesById: ReadonlyMap<string, AnatomyImageAsset>;
  structuresById: ReadonlyMap<string, AnatomyStructure>;
}

const PlateCatalogueContext = createContext<PlateCatalogue | null>(null);
export const PlateCatalogueProvider = PlateCatalogueContext.Provider;

/**
 * The long description of the picture that is showing, as visually hidden text
 * the viewer points at with aria-describedby (WCAG 1.1.1). Not an `alt`: an
 * alt attribute is read in one breath with no way to pause in it, and these
 * run to several sentences.
 *
 * The generator is fetched with import() the first time a picture is shown.
 * It and the sentences it writes stay out of the entry chunk, which is within
 * a few kilobytes of the size a service worker will precache.
 *
 * Renders nothing outside a PlateCatalogueProvider, and nothing until the
 * generator has arrived: a picture with a name and no description is where the
 * app was before, not a fault.
 */
export function PlateDescription({
  id,
  image,
  subjectId,
  conceal,
}: {
  id: string;
  image: AnatomyImageAsset;
  subjectId?: string;
  conceal?: PlateConceal;
}) {
  const catalogue = useContext(PlateCatalogueContext);
  const [describe, setDescribe] = useState<typeof import('../../lib/plateDescription').describePlate | null>(null);

  useEffect(() => {
    if (!catalogue) return;
    let live = true;
    void import('../../lib/plateDescription').then((m) => {
      if (live) setDescribe(() => m.describePlate);
    });
    return () => {
      live = false;
    };
  }, [catalogue]);

  const text = catalogue && describe ? describe({ image, subjectId, conceal, ...catalogue }) : '';
  // Always in the DOM so the viewer's aria-describedby never points at nothing.
  return (
    <figcaption id={id} className="sr-only" data-plate-description>
      {text}
    </figcaption>
  );
}
