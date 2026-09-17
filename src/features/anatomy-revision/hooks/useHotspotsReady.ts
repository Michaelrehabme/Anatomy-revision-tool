import { useEffect, useState } from 'react';
import { attachHotspots } from '../data/seed/hotspots';

/**
 * True once the hotspot polygons have been attached to the images.
 *
 * Only for the two authoring tools, which read `ALL_IMAGES` straight from the
 * seed instead of going through a repository — everything a student sees gets
 * its images from `useAnatomyContent`, and the repository has already awaited
 * the load before it hands them over. Without this the editor would open on a
 * picture with no outlines on it and look like the data had been lost.
 */
export function useHotspotsReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    attachHotspots().then(
      () => {
        if (!cancelled) setReady(true);
      },
      (err) => {
        console.error('Failed to load hotspot data:', err);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}
