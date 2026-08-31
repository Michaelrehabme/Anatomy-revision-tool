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
  error: string | null;
  retry: () => void;
}

const EMPTY_DATA = {
  structures: [] as AnatomyStructure[],
  images: [] as AnatomyImageAsset[],
  structuresById: new Map<string, AnatomyStructure>(),
  imagesById: new Map<string, AnatomyImageAsset>(),
};

/**
 * Loads the full (unfiltered) structure/image catalogue once the repository
 * is ready, and indexes both by id. This is the single fetch App.tsx needs
 * for the whole session lifecycle — question generation wants the full
 * dataset (see generateSet.ts's comment on building indexes over it), and
 * session views need id -> object lookups to render questions.
 */
export function useAnatomyContent(repository: AnatomyRepository | null): AnatomyContent {
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!repository) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([repository.listStructures(), repository.listImageAssets()])
      .then(([structures, images]) => {
        if (cancelled) return;
        setData({
          structures,
          images,
          structuresById: new Map(structures.map((s) => [s.id, s])),
          imagesById: new Map(images.map((i) => [i.id, i])),
        });
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError('Could not load anatomy content. Check your connection and try again.');
        setLoading(false);
        console.error('Failed to load anatomy content:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [repository, attempt]);

  return { ...data, loading, error, retry: () => setAttempt((n) => n + 1) };
}
