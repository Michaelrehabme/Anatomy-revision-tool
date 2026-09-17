import type { AnatomyImageAsset } from '../types/image';

/**
 * A rotation set is one picture, photographed from several angles.
 *
 * The marker is an "-aNNN-" segment in the image id — `sub-forefoot-a030-plate`,
 * `ligament-medial-meniscus-a045-context` — and everything else about the id is
 * the set it belongs to. That convention is what makes a family turnable: render
 * the angles, name them, and the viewer picks them up. Nothing else changes.
 *
 * The locate generator has always grouped frames this way so a ligament seen
 * from six angles is one question rather than six. This module exists because
 * identify and MCQ need the same grouping to let a student turn the picture,
 * and two copies of a regex that defines a data convention is one too many.
 */
const ANGLE = /-a(\d{3})-/;

/** The set an image belongs to, or null when it is a single picture. */
export function rotationSetKey(id: string): string | null {
  return ANGLE.test(id) ? id.replace(ANGLE, '-*-') : null;
}

/** Degrees around the vertical axis, 0 anterior, or null when not a frame. */
export function rotationAngle(id: string): number | null {
  const m = ANGLE.exec(id);
  return m ? Number(m[1]) : null;
}

/**
 * Every angle of `image`'s set, in angle order, `image` included.
 *
 * Returns an empty array for a picture that is not part of a set, so a caller
 * can pass the result straight to a viewer: one frame is not something to turn.
 */
export function rotationFramesFor(
  image: AnatomyImageAsset | undefined,
  images: Iterable<AnatomyImageAsset>,
): AnatomyImageAsset[] {
  if (!image) return [];
  const key = rotationSetKey(image.id);
  if (!key) return [];
  const frames = [...images].filter((f) => rotationSetKey(f.id) === key);
  return frames.length > 1
    ? frames.sort((a, b) => (rotationAngle(a.id) ?? 0) - (rotationAngle(b.id) ?? 0))
    : [];
}
