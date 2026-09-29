import type { AnatomyStructure } from '../../types/structure';
import { BLOOD_SUPPLY } from './bloodSupply.generated';
import { MUSCLE_STRUCTURES } from './structures.muscles.seed';
import { BONE_STRUCTURES } from './structures.bones.seed';
import { LANDMARK_STRUCTURES } from './structures.landmarks.seed';
import { SPINE_LANDMARK_STRUCTURES } from './structures.landmarks.spine.seed';
import { UPPER_LIMB_LANDMARK_STRUCTURES } from './structures.landmarks.upper-limb.seed';
import { LOWER_LIMB_LANDMARK_STRUCTURES } from './structures.landmarks.lower-limb.seed';
import { JOINT_STRUCTURES } from './structures.joints.seed';
import { LIGAMENT_STRUCTURES } from './structures.ligaments.seed';
import { CONNECTIVE_STRUCTURES } from './structures.connective.seed';
import { IMAGE_ASSETS } from './images.seed';
import { linkImages } from '../../lib/linkImages';

/**
 * Single merge point for all seed content. When wiring a real content
 * pipeline later (e.g. importing hotspots.json via scripts/importHotspots.ts),
 * this is the module to swap for one that loads from a build step or CMS
 * instead of static imports.
 *
 * imageIds are NOT hand-maintained on individual structures — linkImages()
 * auto-populates them by matching each image's panelStructureNames (or
 * structureId) against every structure's name/id/aliases. See
 * lib/linkImages.ts. Add a new structure or image and the link happens
 * automatically as long as the names/aliases line up.
 */
const UNLINKED_STRUCTURES: AnatomyStructure[] = [
  ...MUSCLE_STRUCTURES,
  ...BONE_STRUCTURES,
  ...LANDMARK_STRUCTURES,
  ...SPINE_LANDMARK_STRUCTURES,
  ...UPPER_LIMB_LANDMARK_STRUCTURES,
  ...LOWER_LIMB_LANDMARK_STRUCTURES,
  ...JOINT_STRUCTURES,
  ...LIGAMENT_STRUCTURES,
  ...CONNECTIVE_STRUCTURES,
];

export const ALL_IMAGES = IMAGE_ASSETS;
// Blood supply is reviewed and generated separately (bloodSupply.generated.ts)
// and joined here by id, so no family's seed file has to carry it.
export const ALL_STRUCTURES: AnatomyStructure[] = linkImages(
  UNLINKED_STRUCTURES.map((s) => (BLOOD_SUPPLY[s.id] ? { ...s, bloodSupply: BLOOD_SUPPLY[s.id] } : s)),
  ALL_IMAGES,
);

export {
  MUSCLE_STRUCTURES,
  BONE_STRUCTURES,
  LANDMARK_STRUCTURES,
  SPINE_LANDMARK_STRUCTURES,
  UPPER_LIMB_LANDMARK_STRUCTURES,
  LOWER_LIMB_LANDMARK_STRUCTURES,
  JOINT_STRUCTURES,
  LIGAMENT_STRUCTURES,
  IMAGE_ASSETS,
};
