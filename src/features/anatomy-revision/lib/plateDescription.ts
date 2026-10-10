import { siteLabel } from './attachmentSites';
import type { StructureIndexEntry } from '../types/structureIndex';
import type { AnatomyImageAsset, HotspotPolygon } from '../types/image';
import { SUBREGION_LABELS, REGION_LABELS } from '../types/region';
import {
  JOINT_TYPE_LABELS,
  isBone,
  isJoint,
  isLandmark,
  isLigament,
  isMuscle,
  reviewedAttachmentIds,
  type AnatomyStructure,
} from '../types/structure';
import { rotationAngle, rotationTilt } from './rotationFrames';
import type { PlateConceal } from './plateLabel';

/**
 * A long description of an anatomy picture, for someone who cannot see it
 * (WCAG 1.1.1), written from the seed and from nothing else.
 *
 * WHY IT IS GENERATED. There are about 5,000 pictures: 122 muscles and 143
 * ligaments rendered from up to twelve angles, twice each. Nobody is going to
 * write 5,000 paragraphs, and a paragraph written once goes stale the day a
 * plate is re-rendered. Everything a description needs is already data — the
 * view and angle are in the image row, what is in frame is the hotspot list,
 * where a structure sits is its hotspot's centroid, and what it attaches to is
 * the structure record — so the description is a function of the seed and is
 * right for as long as the seed is.
 *
 * WHAT IT WILL NOT SAY. It never states anatomy the seed does not hold. Left
 * and right in the picture are called that — "to its left in the picture" —
 * and never medial or lateral, because the image row does not say which side
 * of the body was rendered and the two landmark and joint renders of the same
 * shoulder are mirror images of one another. A ligament's attachments are read
 * through reviewedAttachmentIds, so an unreviewed one is described by position
 * and not by a fact nobody has checked.
 *
 * AND IT MUST NOT ANSWER THE QUESTION. A description that names the highlighted
 * muscle on "Which structure is shown?" has answered it; one that says where
 * the acromion sits on "Tap the acromion" has answered that. `conceal` says
 * which half is the answer:
 *
 *   'name'   identify, before answering — the frame and the kind of picture,
 *            and nothing about the subject. Its neighbours are not listed
 *            either: on multiple choice they are the likeliest distractors,
 *            and naming them would strike them out.
 *   'place'  locate, before answering — the subject is named (the prompt
 *            names it) and everything in frame is listed, but not where
 *            anything is, nor what the subject attaches to: that is what the
 *            question asks when it is answered in words instead
 *            (questionGenerators/describedRegion.ts), in these same labels —
 *            "Origin: …", "Attaches to …" — so the two say one thing and
 *            neither says it early.
 *   absent   after answering, and on cards — everything.
 *
 * Loaded with import() by shared/PlateDescription.tsx so none of this is in
 * the entry chunk (see the bundle limit in vite.config.ts).
 */

export type PlateFamily =
  | 'muscle-context'
  | 'muscle-highlight'
  | 'ligament-context'
  | 'ligament-highlight'
  | 'joint'
  | 'landmark'
  | 'bone'
  | 'subregion'
  | 'gap'
  | 'panel'
  | 'other';

export interface PlateDescriptionInput {
  image: AnatomyImageAsset;
  /** The structure the picture or the question is about, when there is one. */
  subjectId?: string;
  conceal?: PlateConceal;
  imagesById: ReadonlyMap<string, AnatomyImageAsset>;
  /** The structures whose facts are in hand. What is said ABOUT the subject comes from here. */
  structuresById: ReadonlyMap<string, AnatomyStructure>;
  /**
   * Every structure, for names: a plate shows neighbours from areas whose
   * facts may not be on the device, and they still have to be named. Left
   * out, `structuresById` is taken to be everything.
   */
  indexById?: ReadonlyMap<string, StructureIndexEntry>;
}

/** How many structures a description names before it says "and N more". */
const MAX_LISTED = 8;
/** How many neighbours a subject is placed against. */
const MAX_NEIGHBOURS = 3;
/** A structure covering at least this share of the picture is worth placing the subject against. */
const SIZEABLE_AREA = 0.005;

export function plateFamily(image: AnatomyImageAsset): PlateFamily {
  const id = image.id;
  if (id.startsWith('muscle-')) return id.endsWith('-highlight') ? 'muscle-highlight' : 'muscle-context';
  if (id.startsWith('ligament-')) return id.endsWith('-highlight') ? 'ligament-highlight' : 'ligament-context';
  if (id.startsWith('joint-')) return 'joint';
  if (id.startsWith('landmark-')) return 'landmark';
  if (id.startsWith('bone-')) return 'bone';
  if (id.startsWith('sub-')) return 'subregion';
  if (id.startsWith('gap-')) return 'gap';
  if (id.startsWith('panel-')) return 'panel';
  return 'other';
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** "Anterolateral view" — the name the seed gives the angle. */
function viewPhrase(image: AnatomyImageAsset): string {
  return `${image.view[0].toUpperCase()}${image.view.slice(1)} view`;
}

/**
 * ", the camera 60° round from the front and 45° above the horizontal".
 * Two frames of a twelve-frame turntable share a view name, so the degrees are
 * what tell them apart; a picture that is not a frame has none to give.
 */
function cameraPhrase(image: AnatomyImageAsset): string {
  const angle = rotationAngle(image.id);
  const tilt = rotationTilt(image.id);
  const parts: string[] = [];
  if (angle) parts.push(`${angle}° round from the front`);
  if (tilt) parts.push(`${Math.abs(tilt)}° ${tilt > 0 ? 'above' : 'below'} the horizontal`);
  return parts.length ? `, the camera ${parts.join(' and ')}` : '';
}

function areaPhrase(image: AnatomyImageAsset): string {
  const label = image.subregion ? SUBREGION_LABELS[image.subregion] : REGION_LABELS[image.region];
  return label.replace(' & ', ' and ').toLowerCase();
}

/** Where a point sits in the picture, on a three-by-three grid. */
export function gridPosition([x, y]: [number, number]): string {
  const col = x < 1 / 3 ? 'left' : x > 2 / 3 ? 'right' : 'centre';
  const row = y < 1 / 3 ? 'upper' : y > 2 / 3 ? 'lower' : 'middle';
  if (col === 'centre' && row === 'middle') return 'at the centre of the picture';
  if (col === 'centre') return `in the ${row} middle of the picture`;
  if (row === 'middle') return `on the ${col} of the picture, halfway up`;
  return `in the ${row} ${col} of the picture`;
}

/** Where `other` lies as seen from `from`, in the picture's own terms. */
export function pictureDirection(from: [number, number], other: [number, number]): string {
  const dx = other[0] - from[0];
  const dy = other[1] - from[1];
  const horizontal = dx < 0 ? 'to its left' : 'to its right';
  const vertical = dy < 0 ? 'above it' : 'below it';
  if (Math.abs(dx) > 2 * Math.abs(dy)) return horizontal;
  if (Math.abs(dy) > 2 * Math.abs(dx)) return vertical;
  return `${vertical} and ${horizontal.replace('to its ', 'to the ')}`;
}

/**
 * The hotspots that say what is in a picture. A highlight plate carries none
 * of its own — it is the same camera as its context plate with one structure
 * recoloured — so its context twin's are read instead.
 */
function hotspotsFor(image: AnatomyImageAsset, imagesById: ReadonlyMap<string, AnatomyImageAsset>): HotspotPolygon[] {
  const own = image.hotspots ?? [];
  if (own.length > 0 || !image.id.endsWith('-highlight')) return own;
  return imagesById.get(image.id.replace(/-highlight$/, '-context'))?.hotspots ?? [];
}

/** One entry per structure, largest first: a ligament split by what crosses it is still one ligament. */
function structuresInFrame(hotspots: HotspotPolygon[]): { structureId: string; area: number; centroid: [number, number] }[] {
  const byId = new Map<string, { structureId: string; area: number; centroid: [number, number]; biggest: number }>();
  for (const h of hotspots) {
    const seen = byId.get(h.structureId);
    if (!seen) byId.set(h.structureId, { structureId: h.structureId, area: h.area, centroid: h.centroid, biggest: h.area });
    else {
      seen.area += h.area;
      if (h.area > seen.biggest) {
        seen.biggest = h.area;
        seen.centroid = h.centroid;
      }
    }
  }
  return [...byId.values()].sort((a, b) => b.area - a.area);
}

/** A structure's name without the seed's bookkeeping suffix: "Carpals (grouped)" is the carpals. */
function plainName(s: StructureIndexEntry | undefined): string | undefined {
  return s?.name.replace(/ \(grouped\)$/, '');
}

function nameList(ids: string[], structuresById: ReadonlyMap<string, StructureIndexEntry>): string {
  const names = ids.map((id) => plainName(structuresById.get(id))).filter((n): n is string => !!n);
  if (names.length <= MAX_LISTED) return list(names);
  return `${names.slice(0, MAX_LISTED).join(', ')} and ${names.length - MAX_LISTED} more`;
}

/**
 * "This view was rendered twice: with the femur ghosted, and with it hidden."
 *
 * A frame with a second render (types/image.ts, ImageVariant) is two pictures
 * through one camera, and the viewer's switch says which is showing. The
 * description is of the FRAME, so it says what the two are and not which one
 * is on screen: nothing else in it depends on the choice — the camera, the
 * hotspots and the subject are the same in both — and the switch announces
 * its own state as a radio group. It gives nothing away on an open question
 * either: the switch shows the same word to everyone.
 */
function variantSentence(image: AnatomyImageAsset): string {
  const variant = image.variant;
  if (!variant) return '';
  const subject = variant.subject.toLowerCase();
  const plural = subject.endsWith('s');
  // The same two words the switch uses (VARIANT_LABELS in shared/ImageViewer.tsx).
  const [first, second] = variant.kind === 'hidden' ? ['ghosted', 'hidden'] : ['see-through', 'solid'];
  return `This view was rendered twice, with the ${subject} ${first} and with ${plural ? 'them' : 'it'} ${second}; the switch under the picture chooses between the two.`;
}

/** What kind of picture this is and how it is drawn — nothing about any one structure. */
function frameSentences(image: AnatomyImageAsset, family: PlateFamily): string[] {
  return [...drawnSentences(image, family), variantSentence(image)].filter(Boolean);
}

function drawnSentences(image: AnatomyImageAsset, family: PlateFamily): string[] {
  const where = `${areaPhrase(image)}${cameraPhrase(image)}`;
  const view = viewPhrase(image);
  switch (family) {
    case 'muscle-context':
      return [
        `${view} of the ${where}.`,
        `Every muscle in view is drawn in the same red over the skeleton${image.layer === 'deep-muscle' ? ', with the superficial layer taken off' : ''}; none is picked out.`,
      ];
    case 'muscle-highlight':
      return [
        `${view} of the ${where}.`,
        `One muscle is picked out in bright cyan; the muscles around it are drawn pale over the skeleton${image.layer === 'deep-muscle' ? ', with the superficial layer taken off' : ''}.`,
      ];
    case 'ligament-context':
      return [`${view} of the ${where}.`, 'The bones are drawn plainly with every ligament of the joint in the same pale blue; none is picked out.'];
    case 'ligament-highlight':
      return [`${view} of the ${where}.`, 'The bones are drawn plainly with one ligament picked out in bright cyan.'];
    case 'joint':
      return [`${view} of the ${where}.`, 'The skeleton is drawn plainly and framed on one joint; nothing is coloured or marked on the picture itself.'];
    case 'landmark':
      return [`${view} of the ${where}.`, 'The bones are drawn plainly and framed on one bony landmark; nothing is coloured on the picture itself.'];
    case 'bone':
      return [`${view} of the skeleton of the ${where}.`, 'Every bone is drawn in the same plain bone colour; none is picked out.'];
    case 'subregion':
      return [`Close ${view.toLowerCase()} of the ${where}.`, 'The bones are drawn plainly, with any muscles in view in red, close enough for the small structures to be told apart; none is picked out.'];
    case 'gap':
      // Bones only, on purpose (see the gap plates in images.seed.ts): the
      // ligament asked for lies between two of them and is not drawn, and
      // which two is the question. So the bones are not named here either.
      return [
        `${view} of the ${where}.`,
        'Only the bones are drawn, in the same plain bone colour, with no ligament over them; what is asked for on this picture is a gap between two neighbouring bones.',
      ];
    case 'panel':
      // The seed's `view` for a card panel is nominal — a panel is often two
      // or three views side by side — so no view is claimed for one.
      return [
        image.width && image.height && image.width / image.height >= 1.4
          ? `A card picture of the ${where}: the skeleton shown from more than one side, set side by side, with one structure picked out in blue.`
          : `A card picture of the ${where}: the skeleton, with one structure picked out in blue.`,
      ];
    default:
      return [`${view} of the ${where}.`];
  }
}

/** What the seed says the subject is joined to — the "named neighbours" that are anatomy rather than picture. */
function relationSentences(subject: AnatomyStructure, structuresById: ReadonlyMap<string, StructureIndexEntry>): string[] {
  const names = (ids: string[]) => ids.map((id) => plainName(structuresById.get(id))).filter((n): n is string => !!n);
  if (isMuscle(subject)) {
    const out: string[] = [];
    if (subject.origin.length) out.push(`Origin: ${subject.origin.join('; ')}.`);
    if (subject.insertion.length) out.push(`Insertion: ${subject.insertion.join('; ')}.`);
    return out;
  }
  if (isLigament(subject)) {
    const out: string[] = [];
    // "the greater trochanter of the femur": the part, and the bone it is on.
    const bones = reviewedAttachmentIds(subject).flatMap((id) => {
      const site = structuresById.get(id);
      return site ? [siteLabel(site, structuresById)] : [];
    });
    if (bones.length) out.push(`It attaches to the ${list(bones.map((b) => b.toLowerCase()))}.`);
    const joint = subject.jointId ? plainName(structuresById.get(subject.jointId)) : undefined;
    if (joint) out.push(`It belongs to the ${joint}.`);
    return out;
  }
  if (isLandmark(subject)) {
    const bone = subject.parentBoneId ? plainName(structuresById.get(subject.parentBoneId)) : undefined;
    const out: string[] = [];
    if (bone) out.push(`It is part of the ${bone.toLowerCase()}.`);
    if (subject.attachments.length) out.push(`Attached here: ${subject.attachments.join('; ')}.`);
    // Left out until the question in words began offering it as part of the
    // right answer: a description that then said less than the answer just
    // given would read as contradicting it.
    if (subject.articulations?.length) out.push(`Articulates: ${subject.articulations.join('; ')}.`);
    return out;
  }
  if (isJoint(subject)) {
    const parts = names(subject.articulatingStructureIds);
    return [
      `It is a ${JOINT_TYPE_LABELS[subject.jointType]}${parts.length ? ` formed by the ${list(parts.map((p) => p.toLowerCase()))}` : ''}.`,
    ];
  }
  if (isBone(subject) && subject.articulations.length) return [`It forms: ${subject.articulations.join('; ')}.`];
  return [];
}

function howMarked(family: PlateFamily): string {
  switch (family) {
    case 'muscle-highlight':
    case 'ligament-highlight':
      return 'is the structure in cyan';
    case 'panel':
      return 'is picked out in blue';
    case 'gap':
      return 'is not drawn: it lies in the gap between two bones, and that gap is what is described here';
    default:
      return 'is the structure in question';
  }
}

/** Where the subject sits in the picture and what is next to it there. */
function placeSentences(
  subject: StructureIndexEntry,
  family: PlateFamily,
  inFrame: ReturnType<typeof structuresInFrame>,
  hotspots: HotspotPolygon[],
  structuresById: ReadonlyMap<string, StructureIndexEntry>,
): string[] {
  const own = inFrame.find((s) => s.structureId === subject.id);
  if (!own) return [`${plainName(subject)} ${howMarked(family)}.`];

  const share = Math.round(own.area * 100);
  const size = share >= 1 ? `, covering about ${share}% of it` : ', and is small at this scale';
  const out = [`${plainName(subject)} ${howMarked(family)}. It lies ${gridPosition(own.centroid)}${size}.`];

  if (hotspots.some((h) => h.structureId === subject.id && (h.targetTwins?.length ?? 0) > 0)) {
    out.push('The picture shows both sides of the body, and it appears on each.');
  }

  // The nearest structures, preferring ones large enough to matter: beside a
  // deltoid, the sliver of coracobrachialis showing under it is the nearest
  // centroid and the least useful thing to be told about. The bar drops for
  // a small subject — a scaphoid's neighbours are the carpals round it, not
  // the nearest big muscle.
  const byDistance = inFrame
    .filter((s) => s.structureId !== subject.id && structuresById.has(s.structureId))
    .map((s) => ({ ...s, distance: Math.hypot(s.centroid[0] - own.centroid[0], s.centroid[1] - own.centroid[1]) }))
    .sort((a, b) => a.distance - b.distance);
  const sizeable = byDistance.filter((s) => s.area >= Math.min(SIZEABLE_AREA, own.area / 4));
  const neighbours = (sizeable.length >= MAX_NEIGHBOURS ? sizeable : byDistance).slice(0, MAX_NEIGHBOURS);
  if (neighbours.length) {
    const parts = neighbours.map((n) => `${plainName(structuresById.get(n.structureId))} is ${pictureDirection(own.centroid, n.centroid)}`);
    out.push(`In this view, ${list(parts)}.`);
  }
  return out;
}

/**
 * The whole description, as sentences. Kept as a list so a caller can render
 * them as separate paragraphs; describePlate joins them.
 */
export function describePlateSentences({ image, subjectId, conceal, imagesById, structuresById, indexById }: PlateDescriptionInput): string[] {
  const family = plateFamily(image);
  const hotspots = hotspotsFor(image, imagesById);
  const inFrame = structuresInFrame(hotspots);
  // Two lookups, because they answer different questions. WHERE a structure
  // is in the picture and what it is called need only the index. What it
  // attaches to is a fact, and is said only when that fact is in hand.
  const names: ReadonlyMap<string, StructureIndexEntry> = indexById ?? structuresById;
  const subject = names.get(subjectId ?? image.structureId ?? '');
  const subjectFacts = subject ? structuresById.get(subject.id) : undefined;
  const out = frameSentences(image, family);

  if (conceal === 'name') {
    out.push(
      family === 'landmark' || family === 'joint' || family === 'bone' || family === 'subregion' || family === 'muscle-context' || family === 'ligament-context'
        ? 'The question marks one structure on it in colour.'
        : '',
      'Naming that structure is the question, so it is not described here; a full description is given once you have answered.',
    );
    return out.filter(Boolean);
  }

  // Everything named in the picture. Listed on a locate question too: it says
  // what there is to tap and nothing about where any of it is. The relations
  // (relationSentences) are NOT given until the question is answered — they
  // are the right option of the same question asked in words.
  const others = inFrame.filter((s) => s.structureId !== subject?.id).map((s) => s.structureId);
  const inFrameSentence = (ids: string[], lead: string) => (ids.length ? `${lead}: ${nameList(ids, names)}.` : '');

  if (conceal === 'place' && family === 'gap') {
    // Every other locate picture lists what is in frame, because the names
    // say nothing about where anything is. Here they would: each of these
    // ligaments is named after the two bones it joins, and the bones it joins
    // are the answer. So the gaps are counted and none is named.
    out.push(
      `${inFrame.length === 1 ? 'One gap' : `${inFrame.length} gaps`} between the bones can be chosen in this view.`,
      'Which gap it is, and where, is the question, so neither is described here; a full description is given once you have answered.',
    );
    return out.filter(Boolean);
  }

  if (conceal === 'place') {
    out.push(
      inFrameSentence(inFrame.map((s) => s.structureId), 'In frame'),
      inFrame.length > 1
        ? 'Where each one lies is the question, so positions are not described here; a full description is given once you have answered.'
        : 'Where it lies is the question, so its position is not described here; a full description is given once you have answered.',
    );
    return out.filter(Boolean);
  }

  if (subject) {
    out.push(...placeSentences(subject, family, inFrame, hotspots, names));
    if (subjectFacts) out.push(...relationSentences(subjectFacts, names));
    out.push(inFrameSentence(others, 'Also in frame'));
  } else {
    out.push(inFrameSentence(inFrame.map((s) => s.structureId), 'In frame'));
  }
  return out.filter(Boolean);
}

export function describePlate(input: PlateDescriptionInput): string {
  return describePlateSentences(input).join(' ');
}
