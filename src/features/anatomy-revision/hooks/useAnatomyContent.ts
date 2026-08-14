import { useEffect, useState } from 'react';
import type { AnatomyStructure } from '../types/structure';
import type { AnatomyImageAsset } from '../types/image';
import type { AnatomyRepository } from '../data/repository';

export interface AnatomyContent {
  structures: AnatomyStructure[];
  images: AnatomyImageAsset[];
  structuresById: Map<string, AnatomyStructure>;
  imagesById: Map<string, AnatomyImageAsset>;
  loading: boolean;
}

const EMPTY: AnatomyContent = {
  structures: [],
  images: [],
  structuresById: new Map(),
  imagesById: new Map(),
  loading: true,
};

/**
 * Loads the full (unfiltered) structure/image catalogue once the repository
 * is ready, and indexes both by id. This is the single fetch App.tsx needs
 * for the whole session lifecycle — question generation wants the full
 * dataset (see generateSet.ts's comment on building indexes over it), and
 * session views need id -> object lookups to render questions.
 */
export function useAnatomyContent(repository: AnatomyRepository | null): AnatomyContent {
  const [content, setContent] = useState<AnatomyContent>(EMPTY);

  useEffect(() => {
    if (!repository) return;
    let cancelled = false;

    Promise.all([repository.listStructures(), repository.listImageAssets()]).then(
      ([structures, images]) => {
        if (cancelled) return;
        setContent({
          structures,
          images,
          structuresById: new Map(structures.map((s) => [s.id, s])),
          imagesById: new Map(images.map((i) => [i.id, i])),
          loading: false,
        });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [repository]);

  return content;
}
