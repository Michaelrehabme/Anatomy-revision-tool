import type { AnatomyImageAsset } from '../../types/image';
import { AttributionBadge } from './AttributionBadge';

/**
 * Non-interactive image display for flashcards/MCQ prompts. Sized via
 * aspect-ratio from the asset's natural width/height when known, matching
 * HotspotImage's box-sizing approach for visual consistency even though
 * this component never needs to hit-test clicks itself.
 */
export function AnatomyImageFigure({ image, alt }: { image: AnatomyImageAsset; alt: string }) {
  return (
    <figure>
      <div
        className="w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
        style={image.width && image.height ? { aspectRatio: `${image.width} / ${image.height}` } : undefined}
      >
        <img src={image.filePath} alt={alt} className="h-full w-full object-cover" />
      </div>
      <AttributionBadge image={image} />
    </figure>
  );
}
