import type { AnatomyImageAsset } from '../types/image';

/**
 * A rotation set is one picture, photographed from several angles.
 *
 * The marker is an "-aNNN-" segment in the image id — `sub-forefoot-a030-plate`,
 * `ligament-medial-meniscus-a045-context` — and everything else about the id is
 * the set it belongs to. That convention is what makes a family turnable: render
 * the angles, name them, and the viewer picks them up. Nothing else changes.
 *
 * TILTED FRAMES. A foot is read from above and below as much as from the side,
 * so a set may also carry frames tilted on the other axis: `-a180u045-` is the
 * camera 45 degrees above the horizontal, turned from the 180 degree view, and
 * `-a000d090-` is straight up from below. They belong to the same set as the
 * horizontal frames — one question, one picture a student can turn and tilt —
 * and the viewer keeps them on their own ladder rather than in the turntable.
 *
 * The locate generator has always grouped frames this way so a ligament seen
 * from six angles is one question rather than six. This module exists because
 * identify and MCQ need the same grouping to let a student turn the picture,
 * and two copies of a regex that defines a data convention is one too many.
 */
const ANGLE = /-a(\d{3})(?:([ud])(\d{3}))?-/;

/** The set an image belongs to, or null when it is a single picture. */
export function rotationSetKey(id: string): string | null {
  return ANGLE.test(id) ? id.replace(ANGLE, '-*-') : null;
}

/** Degrees around the vertical axis, 0 anterior, or null when not a frame. */
export function rotationAngle(id: string): number | null {
  const m = ANGLE.exec(id);
  return m ? Number(m[1]) : null;
}

/** Degrees above (+) or below (-) the horizontal; 0 for a turntable frame or a single picture. */
export function rotationTilt(id: string): number {
  const m = ANGLE.exec(id);
  if (!m || !m[2]) return 0;
  return (m[2] === 'u' ? 1 : -1) * Number(m[3]);
}

/**
 * Every angle of `image`'s set, `image` included: the turntable frames in
 * angle order, then any tilted frames from lowest to highest.
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
  if (frames.length < 2) return [];
  const ring = frames.filter((f) => rotationTilt(f.id) === 0).sort((a, b) => (rotationAngle(a.id) ?? 0) - (rotationAngle(b.id) ?? 0));
  const tilts = frames.filter((f) => rotationTilt(f.id) !== 0).sort((a, b) => rotationTilt(a.id) - rotationTilt(b.id));
  return [...ring, ...tilts];
}
