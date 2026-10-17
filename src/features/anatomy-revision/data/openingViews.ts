/**
 * THE ANGLE A TAP QUESTION OPENS ON, where the owner has said which view a
 * student expects (17 Oct 2026). Otherwise a turntable opens wherever its
 * target traces largest (lib/questionGenerators/locate.ts), which put the
 * intervertebral joint on an anterior view and the facet joint wherever its
 * band happened to be widest.
 *
 * Degrees around the vertical axis, 0 anterior, 180 posterior; the first angle
 * listed that the picture has, and that shows the target well enough to tap,
 * is used. A structure missing from here opens as before.
 */
export const OPENING_ANGLES: Readonly<Record<string, readonly number[]>> = {
  // From the side, each disc between two vertebral bodies.
  'intervertebral-joint': [90, 270],
  // From behind, where the facet joints are.
  'facet-joint': [180, 150, 210],
};
