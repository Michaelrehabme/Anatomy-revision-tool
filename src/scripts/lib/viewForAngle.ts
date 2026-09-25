import type { ViewType } from '../../features/anatomy-revision/types/image';

/**
 * What a turntable frame is called, from its angle and whether the plate is
 * drawn on one side of the body or across the midline.
 *
 * ONE RULE FOR EVERY TURNTABLE, because three copies of it disagreed. Every
 * renderer puts the camera at (-sin θ, -cos θ) round the subject, and every
 * one of them frames a limb on its LEFT copy (side_of() tries ".l" first). The
 * atlas faces -Y with its left side at +X, so at 90 degrees the camera sits at
 * -X — on the body's right — and looks at a left limb from the inside. 90 is
 * MEDIAL and 270 is LATERAL.
 *
 * The ligament publisher had that right. The sub-region publisher had it
 * backwards, with a comment arguing that a region plate "turns the other way",
 * and the joint and muscle publishers copied it. Checked on the renders, 25 Sep
 * 2026: the leg sub-region at 270 shows the fibula running down to the lateral
 * malleolus with the fibular tendons behind it; at 90 the medial malleolus and
 * the tendons of tibialis posterior; the knee joint at 270 shows the fibular
 * head face-on; and the deltoid, a lateral muscle, is largest at 270 and not
 * visible at all from 90. Every one of those was labelled the other way round.
 *
 * A MIDLINE PLATE HAS NO MEDIAL SIDE. The spine, the neck, the pubic symphysis,
 * a muscle drawn with both sides highlighted: turned 90 degrees either way the
 * camera is looking at the body's side, so both 90 and 270 are lateral views,
 * and the obliques are anterolateral and posterolateral whichever way round.
 */
export function viewForAngle(angle: number, midline: boolean): ViewType {
  const a = ((angle % 360) + 360) % 360;
  if (a === 0) return 'anterior';
  if (a === 180) return 'posterior';
  if (a === 90 || a === 270) return midline || a === 270 ? 'lateral' : 'medial';
  // Obliques: which half of the circle decides medial or lateral on a
  // one-sided plate; 0-180 is the side facing the midline.
  const front = a < 90 || a > 270;
  const towardMidline = a < 180;
  if (midline || !towardMidline) return front ? 'anterolateral' : 'posterolateral';
  return front ? 'anteromedial' : 'posteromedial';
}
