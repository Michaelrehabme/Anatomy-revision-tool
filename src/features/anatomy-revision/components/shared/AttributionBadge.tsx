import type { AnatomyImageAsset } from '../../types/image';

/**
 * Renders whatever credit/licence text is actually stored on the image
 * asset — NEVER hardcode a licence string here. Seed images currently carry
 * explicit "TODO — confirm source licence" placeholders (see
 * data/seed/images.seed.ts); this component renders that verbatim so an
 * unconfirmed licence is visibly unconfirmed in the UI, not silently hidden.
 */
export function AttributionBadge({ image }: { image: AnatomyImageAsset }) {
  const isTodo = image.licence.toLowerCase().includes('todo');

  return (
    <p
      className={`mt-1 text-xs ${isTodo ? 'text-amber-600' : 'text-slate-400'}`}
      title={image.filePath}
    >
      {image.credit} · {image.licence}
    </p>
  );
}
