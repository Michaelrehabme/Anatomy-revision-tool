import type { AnatomyImageAsset } from '../types/image';

/** A frame of a ligament's redraw (data/seed/images.seed.ts, "Redrawn ligaments"). */
export function isRedraw(image: Pick<AnatomyImageAsset, 'id'>): boolean {
  return image.id.startsWith('redraw-');
}

/**
 * A structure's own picture, for a flashcard, a relearn card or its Atlas
 * card: its redraw's opening frame where it has one (owner, 27 Oct 2026),
 * then a picture with its target traced on it, otherwise the first
 * single-structure picture of it, as always.
 *
 * Traced before untraced because eight joints listed their old five-view
 * strip first, which colours the ligaments over the joint and not the joint
 * line (the owner's joint rule, 11 Sep 2026): the transverse tarsal joint's
 * card showed the sole of the foot in blue beside its own traced turntable.
 * A muscle or ligament picture is coloured in and traces nothing, so for
 * those nothing changes.
 */
export function ownPictureOf(structureId: string, images: readonly AnatomyImageAsset[]): AnatomyImageAsset | undefined {
  const own = images.filter((img) => img.mode === 'single-structure' && img.structureId === structureId);
  return (
    own.find(isRedraw) ??
    own.find((img) => (img.hotspots ?? []).some((h) => h.structureId === structureId)) ??
    own[0]
  );
}
