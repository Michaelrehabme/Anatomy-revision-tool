import type { AnatomyImageAsset } from '../../types/image';
import { HotspotOverlay } from '../LocateStructureSession/HotspotOverlay';
import { promptHighlightHotspots } from '../../lib/promptHighlight';

/**
 * The green zone over an identify or MCQ picture, for the frame that is showing.
 *
 * ImageViewer hands its overlay callback the CURRENT frame every time the
 * student turns the plate. Every prompt screen used to close over hotspots it
 * had looked up once from the opening frame, so turning the picture repainted
 * the bones and left the -a000- outline where the structure used to be. This
 * component takes the frame it is given and looks the highlight up on that,
 * which is the one thing the five screens have to agree on.
 */
export function PromptHighlightOverlay({ image, structureId }: { image: AnatomyImageAsset; structureId: string }) {
  const hotspots = promptHighlightHotspots(image, structureId);
  return hotspots.length > 0 ? <HotspotOverlay hotspots={hotspots} highlightStructureId={structureId} /> : null;
}
