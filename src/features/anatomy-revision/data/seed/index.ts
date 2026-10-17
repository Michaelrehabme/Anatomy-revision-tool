import type { AnatomyStructure } from '../../types/structure';
import { isLigament, reviewedAttachmentIds } from '../../types/structure';
import { CLINICAL_LIGAMENTS, LIGAMENT_PICTURE_QUESTIONS } from '../clinicalLigaments';
import { LIGAMENT_ATTACHMENT_DETAIL } from '../ligamentAttachmentDetail';
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
/**
 * Every structure as it is AUTHORED: blood supply joined, pictures not yet
 * linked. Blood supply is reviewed and generated separately
 * (bloodSupply.generated.ts) and joined here by id, so no family's seed file
 * has to carry it.
 *
 * Exported for buildContent.ts, which must cut the index from this and not
 * from ALL_STRUCTURES. Linking gives a muscle the id of every frame of every
 * turntable it appears on, and an index written after linking came to 1.08 MB
 * of image ids — the app derives them at load from the images it already has,
 * and has no use for a second copy in a file.
 */
/**
 * No ligament is asked from a picture for now (owner, 17 Oct 2026); when
 * LIGAMENT_PICTURE_QUESTIONS is turned on, the clinically important ones are
 * (data/clinicalLigaments.ts). Applied here, once, to the data every screen
 * and generator reads, rather than in each generator. Their pictures stay in
 * the Atlas and on flashcards.
 */
function withPictureRule(s: AnatomyStructure): AnatomyStructure {
  if (s.category !== 'ligament') return s;
  if (LIGAMENT_PICTURE_QUESTIONS && CLINICAL_LIGAMENTS.has(s.id)) return s;
  return { ...s, eligibility: { ...s.eligibility, locate: false, picture: false } };
}

/**
 * A ligament is named from its attachments only where no other ligament
 * attaches to exactly the same sites (owner, 17 Oct 2026): the ATFL and PTFL
 * both reach the lateral malleolus and the talus. Worked out here, over all of
 * them, so a session of one area cannot think a ligament unique that is not.
 */
function withAttachmentRule(structures: AnatomyStructure[]): AnatomyStructure[] {
  // A site with a sourced specific part counts as that part: the ATFL and
  // PTFL share "talus + lateral malleolus" but not where on them.
  const key = (s: AnatomyStructure) => {
    if (!isLigament(s)) return '';
    const detail = LIGAMENT_ATTACHMENT_DETAIL[s.id] ?? {};
    return reviewedAttachmentIds(s).map((id) => `${id}:${detail[id] ?? ''}`).sort().join('|');
  };
  const counts = new Map<string, number>();
  for (const s of structures) if (isLigament(s)) counts.set(key(s), (counts.get(key(s)) ?? 0) + 1);
  return structures.map((s) => {
    if (!isLigament(s)) return s;
    const ok = reviewedAttachmentIds(s).length > 0 && counts.get(key(s)) === 1;
    return { ...s, eligibility: { ...s.eligibility, identifyByAttachments: ok } };
  });
}

export const AUTHORED_STRUCTURES: AnatomyStructure[] = withAttachmentRule(
  UNLINKED_STRUCTURES.map((s) => withPictureRule(BLOOD_SUPPLY[s.id] ? { ...s, bloodSupply: BLOOD_SUPPLY[s.id] } : s)),
);
export const ALL_STRUCTURES: AnatomyStructure[] = linkImages(AUTHORED_STRUCTURES, ALL_IMAGES);

/**
 * The same data with every ligament's picture questions ON, as it was before
 * 17 Oct 2026. Not used by the app: it is what the tests of the tap, gap-plate
 * and typed-with-attachment-boxes questions run against, so those builders
 * stay working while they are switched off (data/clinicalLigaments.ts).
 */
export function structuresWithLigamentPictures(): AnatomyStructure[] {
  return linkImages(
    withAttachmentRule(UNLINKED_STRUCTURES.map((s) => (BLOOD_SUPPLY[s.id] ? { ...s, bloodSupply: BLOOD_SUPPLY[s.id] } : s))),
    ALL_IMAGES,
  );
}

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
