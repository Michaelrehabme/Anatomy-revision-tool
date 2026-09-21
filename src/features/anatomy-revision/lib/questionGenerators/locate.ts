import { rotationAngle, rotationSetKey, rotationTilt } from '../rotationFrames';
import { primaryAreaOf } from '../../types/structure';
import type { AnatomyStructure } from '../../types/structure';
import type { AnatomyImageAsset } from '../../types/image';
import type { LocateQuestion } from '../../types/question';
import type { HotspotPolygon } from '../../types/image';
import { polygonsWidth } from '../hotspot/polygonGeometry';

/**
 * How wide a traced target has to be before it is fair to ask someone to tap
 * it, in normalized image units — about 3 CSS pixels across on a phone, or 11
 * once TAP_SLACK is added either side. The floor is about being ABLE TO SEE the
 * target, which is why it is needed at all when the slack would happily grade a
 * thinner one: a two-pixel thread of muscle can be hit but it cannot be aimed
 * at, and flexor carpi radialis on the lateral forearm plate is exactly that.
 *
 * A HOTSPOT CAN BE CORRECT AND STILL BE UNANSWERABLE. The region plates are
 * depth-subtracted so each muscle claims only what is actually visible, and on
 * the lateral forearm that leaves flexor carpi radialis as a sliver a couple of
 * pixels wide between brachioradialis and the wrist. "Tap flexor carpi
 * radialis" over that picture is not a question about anatomy; it is a question
 * about pixel precision, and it marks a student wrong for pointing at the right
 * muscle. The same plate asks it perfectly well from the anterior view, so this
 * drops the angle rather than the structure wherever another angle exists.
 *
 * 50 of 687 locate questions fall below this, and 26 structures lose locate
 * altogether — extensor digitorum, flexor digitorum superficialis, the deep
 * thumb muscles — because no angle in the set shows more than a thread of them.
 * They keep their MCQ and identify questions, and the way to win locate back is
 * a closer camera, not a looser rule: that is what the sub-region plates are
 * for (see images.seed.ts). Scored point/line targets are exempt — they carry
 * their own fingertip floor (MIN_ZONE_PX in publishLandmarks.ts) and a
 * near-miss halo besides.
 */
export const MIN_TAPPABLE_WIDTH = 0.0075;

/** True when this hotspot is wide enough across to aim at. */
export function isTappableTarget(hotspot: HotspotPolygon): boolean {
  if (hotspot.targetRadius) return true;
  return polygonsWidth(hotspot.polygons, hotspot.area) >= MIN_TAPPABLE_WIDTH;
}

/**
 * True when this picture shows the structure at a size worth asking about.
 *
 * A picture can carry MORE THAN ONE HOTSPOT for the same structure — 55 of them
 * do, mostly ligaments split around whatever crosses them — and any one part
 * being big enough makes the question fair, so this asks about the picture and
 * the structure rather than about a single traced piece.
 */
export function isTappableIn(image: AnatomyImageAsset, structureId: string): boolean {
  return (image.hotspots ?? []).some((h) => h.structureId === structureId && isTappableTarget(h));
}

export interface LocateGenOptions {
  toleranceMultiplier?: number;
}

/**
 * Builds locate-the-structure questions — one per (image, hotspot) pair.
 * Only images with populated `hotspots` produce questions; this generator
 * MUST degrade gracefully to an empty array rather than error when no
 * hotspot data exists yet (true for all seed images today — see
 * data/seed/images.seed.ts). Single-structure images need a hotspot too
 * (covering the whole/visible structure outline) since "click the
 * structure" requires knowing where within the image it actually is, not
 * just that the image depicts it.
 */
export function buildLocateQuestions(
  structures: AnatomyStructure[],
  images: AnatomyImageAsset[],
  options: LocateGenOptions = {},
): LocateQuestion[] {
  const structureById = new Map(structures.map((s) => [s.id, s]));
  const questions: LocateQuestion[] = [];

  // A ROTATION SET IS ONE PICTURE, NOT EIGHT. Images rendered every 45 degrees
  // share an id apart from an "-aNNN-" angle segment. One question per
  // (set, structure): the opening frame is the angle where the structure's
  // hotspot is largest, and every frame that carries a hotspot for it is a
  // frame the student may turn to. Without this a ligament visible from six
  // angles would be six questions, and the scheduler would drill it six times
  // over for one fact.
  // The naming rule lives in lib/rotationFrames.ts. This generator used to
  // keep its own copy, so when tilted frames (aNNNuMMM) arrived it read each
  // one as a picture of its own and asked the foot ligaments on each other's.
  const setKey = rotationSetKey;
  const sets = new Map<string, AnatomyImageAsset[]>();
  for (const image of images) {
    const key = setKey(image.id);
    if (key) sets.set(key, [...(sets.get(key) ?? []), image]);
  }
  const angleOf = (id: string) => (rotationAngle(id) ?? 0) + rotationTilt(id) / 1000;
  const emitted = new Set<string>();

  /**
   * ASK A STRUCTURE ON THE PICTURE THAT WAS FRAMED FOR IT.
   *
   * A ligament plate draws every strap in the frame, not just its subject, so
   * each one is tappable on its neighbours' plates too — and, before this,
   * every one of those became its own question. The anterior tibiofibular
   * ligament had four, and the opening picture went to whichever traced
   * largest: the plantar metatarsophalangeal plate, by 0.0001 of a percentage
   * point. That plate is framed on the forefoot, so the ankle sat at its edge.
   * Others were worse than off-centre — the leg's interosseous membrane opened
   * on a KNEE plate, the intercostal membrane on an ELBOW one.
   *
   * Largest-area is the right tie-break BETWEEN ANGLES of one set and the
   * wrong one between sets, because it compares a picture composed for this
   * structure against one composed for something else. Only the first is a
   * question about where the structure is; the rest are questions about
   * spotting it in someone else's picture, and there were 151 of them.
   *
   * A set names its subject in panelStructureNames[0] (see
   * ligamentPlates.generated.ts). Sets with no subject — the sub-region
   * turntables, framed on a region rather than a structure — declare an empty
   * list and are left exactly as they were.
   */
  const subjectBySet = new Map<string, string | undefined>();
  for (const [key, frames] of sets) {
    const named = frames.find((f) => f.panelStructureNames?.length);
    subjectBySet.set(key, named?.panelStructureNames?.[0]?.toLowerCase());
  }
  const ownSetCache = new Map<string, boolean>();
  /**
   * Whether this structure has a set of its own that can actually carry the
   * question. Tappability matters, not just ownership: a ligament too slight
   * to aim at on its own plate keeps the neighbours' plates rather than losing
   * locate altogether — the same trade the angle filter makes below.
   */
  const hasUsableOwnSet = (structure: AnatomyStructure): boolean => {
    const cached = ownSetCache.get(structure.id);
    if (cached !== undefined) return cached;
    const names = new Set([structure.name, ...structure.aliases].map((n) => n.toLowerCase()));
    let usable = false;
    for (const [key, frames] of sets) {
      const subject = subjectBySet.get(key);
      if (subject === undefined || !names.has(subject)) continue;
      if (frames.some((f) => isTappableIn(f, structure.id))) {
        usable = true;
        break;
      }
    }
    ownSetCache.set(structure.id, usable);
    return usable;
  };

  for (const image of images) {
    if (!image.hotspots?.length) continue;
    const key = setKey(image.id);
    const frames = key ? [...sets.get(key)!].sort((a, b) => angleOf(a.id) - angleOf(b.id)) : null;

    const seen = new Set<string>();
    for (const hotspot of image.hotspots) {
      const structure = structureById.get(hotspot.structureId);
      if (!structure || !structure.eligibility.locate) continue;
      // One question per structure per picture, not one per traced piece.
      if (seen.has(structure.id)) continue;
      seen.add(structure.id);
      if (!isTappableIn(image, structure.id)) continue;

      let opening = image;
      let frameIds: string[] | undefined;
      if (frames) {
        // Someone else's plate, and this structure has one of its own: skip it.
        const subject = subjectBySet.get(key!);
        const isOwnSet =
          subject !== undefined &&
          [structure.name, ...structure.aliases].some((n) => n.toLowerCase() === subject);
        if (subject !== undefined && !isOwnSet && hasUsableOwnSet(structure)) continue;

        // A frame the target is a sliver in is not an angle to turn to: the tap
        // is graded against whichever frame is showing, so an unfair frame is an
        // unfair question however the student got there.
        const withTarget = frames.filter((f) => isTappableIn(f, structure.id));
        const questionKey = `${key}|${structure.id}`;
        if (emitted.has(questionKey)) continue;
        emitted.add(questionKey);
        opening = withTarget.reduce((best, f) => {
          const area = (f.hotspots ?? []).find((h) => h.structureId === structure.id)?.area ?? 0;
          const bestArea = (best.hotspots ?? []).find((h) => h.structureId === structure.id)?.area ?? 0;
          return area > bestArea ? f : best;
        }, withTarget[0]);
        frameIds = withTarget.map((f) => f.id);
      }

      questions.push({
        id: `locate-${frames ? key! : image.id}-${structure.id}`,
        type: 'locate',
        structureId: structure.id,
        region: structure.region,
        subregion: structure.subregion,
        area: primaryAreaOf(structure),
        category: structure.category,
        difficulty: structure.difficulty,
        promptKind: 'identify',
        imageId: opening.id,
        imageMode: opening.mode,
        targetStructureId: structure.id,
        toleranceMultiplier: options.toleranceMultiplier,
        prompt:
          opening.mode === 'atlas-slide'
            ? `Tap ${structure.name} on the image.`
            : `Tap the ${structure.name}.`,
        ...(frameIds && frameIds.length > 1 ? { frameImageIds: frameIds } : {}),
      });
    }
  }

  return questions;
}
