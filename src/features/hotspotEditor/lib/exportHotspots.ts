import type { AnatomyStructure } from '../../anatomy-revision/types/structure';
import type { DraftsByImageId } from './draftStore';

interface HotspotsFileEntry {
  polygons: number[][][];
  area: number;
  centroid: [number, number];
}

export interface HotspotsFile {
  schemaVersion: number;
  normalised: boolean;
  hotspots: Record<string, Record<string, HotspotsFileEntry>>;
}

/**
 * Produces the exact shape src/scripts/importHotspots.ts validates
 * (hotspotsFileSchema: {schemaVersion, normalised, hotspots: region -> structureId
 * -> {polygons, area, centroid}}), grouped by each hotspot's structure's own
 * region rather than the image's — a hotspot's structure is the source of
 * truth for region, matching how the import script keys its output.
 */
export function buildHotspotsFile(
  drafts: DraftsByImageId,
  structuresById: Map<string, AnatomyStructure>,
): HotspotsFile {
  const hotspots: Record<string, Record<string, HotspotsFileEntry>> = {};

  for (const hotspotList of Object.values(drafts)) {
    for (const hotspot of hotspotList) {
      const structure = structuresById.get(hotspot.structureId);
      if (!structure) continue;

      const byStructure = hotspots[structure.region] ?? (hotspots[structure.region] = {});
      byStructure[hotspot.structureId] = {
        polygons: hotspot.polygons,
        area: hotspot.area,
        centroid: hotspot.centroid,
      };
    }
  }

  return { schemaVersion: 1, normalised: true, hotspots };
}
