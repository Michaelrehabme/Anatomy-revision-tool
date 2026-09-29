import { areasOf, primaryAreaOf } from '../../types/structure';
import type { AnatomyStructure, BloodSupplyRating } from '../../types/structure';
import type { MCQQuestion, PromptKind } from '../../types/question';
import { shuffle, type Rng } from '../rng';

/**
 * Blood supply (owner, 29 Sep 2026), from the reviewed `bloodSupply` field
 * (types/structure.ts BloodSupply).
 *
 * The primary artery and the assisting arteries are FACTS, on the fact track
 * with the muscle facts: choose, then typed with hints, then typed without
 * (lib/factMastery.ts, questionGenerators/oina.ts). This file supplies that
 * track's wrong answers and name handling, and builds the one question that
 * stays multiple choice — "How rich is the blood supply of X?".
 *
 * Wrong answers come from every structure's arteries, not just the session's
 * pool: a knee-only session still needs knee-plausible alternatives.
 */

const MAX_WRONG = 3;

export const RATING_CHOICES: readonly { rating: BloodSupplyRating; label: string }[] = [
  { rating: 'rich', label: 'Rich' },
  { rating: 'moderate', label: 'Moderate' },
  { rating: 'poor', label: 'Poor' },
];

const RATING_MEANING: Record<BloodSupplyRating, string> = {
  rich: 'several anastomosing sources and well-perfused tissue',
  moderate: 'one dominant supply with collaterals, or tissue of middling vascularity',
  poor: 'avascular or diffusion-fed tissue, an end-artery, retrograde flow or a watershed zone',
};

function base(structure: AnatomyStructure, promptKind: PromptKind) {
  return {
    structureId: structure.id,
    region: structure.region,
    subregion: structure.subregion,
    area: primaryAreaOf(structure),
    category: structure.category,
    difficulty: structure.difficulty,
    promptKind,
  };
}

/**
 * The vessel a name refers to, for telling synonyms apart from genuinely
 * different arteries: "Lumbar arteries", "Lumbar artery (lumbar branch)" and
 * "lumbar arteries" are one vessel. Brackets, "artery", "branch(es)",
 * "muscular" and plurals go; what is left is compared.
 */
export function vesselKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(the|of|and|muscular|branch(es)?|arter(y|ies)|artery's)\b/g, ' ')
    .replace(/\b(\w+?)s\b/g, '$1')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function words(name: string): Set<string> {
  return new Set(vesselKey(name).split(' ').filter(Boolean));
}

/**
 * Whether `candidate` could be read as one of `own`. Stricter than equal keys,
 * because a wrong answer that is partly right is worse than a missing one: the
 * femur's "Obturator artery (foveal artery)" and a distractor "Artery of the
 * ligamentum teres (foveal branch of the obturator artery)" are the same
 * vessel, and "Superior lateral genicular artery" is one of a knee
 * structure's "Superior genicular arteries". So: if every word of one name
 * appears in the other — brackets included — they overlap.
 */
function overlaps(candidate: string, own: readonly string[]): boolean {
  const c = words(candidate.replace(/[()]/g, ' '));
  const cKey = words(candidate);
  return own.some((o) => {
    const oFull = words(o.replace(/[()]/g, ' '));
    const oKey = words(o);
    const within = (a: Set<string>, b: Set<string>) => a.size > 0 && [...a].every((w) => b.has(w));
    return within(oKey, c) || within(cKey, oFull);
  });
}

/**
 * How a choice reads: the vessel's name without its bracketed detail, first
 * letter capital. Bracketed detail made the right answer the long one, which
 * gives it away; it stays in the explanation.
 */
export function choiceName(name: string): string {
  const plain = name.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  return plain.charAt(0).toUpperCase() + plain.slice(1);
}

/** "Carpals (grouped)" reads as "Carpals"; the picture or the setting says which part. */
function displayName(s: AnatomyStructure): string {
  return s.name.replace(/\s*\(grouped\)/i, '');
}

function sentence(text: string): string {
  const t = text.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/** Descriptive phrases ("radial branches of the periacetabular periosteal vascular ring") make poor wrong answers. */
const MAX_WRONG_NAME = 40;

export function arteriesOf(s: AnatomyStructure): string[] {
  const b = s.bloodSupply;
  if (!b) return [];
  return [...(b.primary ? [b.primary] : []), ...b.assisting];
}

/** Visceral vessels that turn up in pelvic entries; as a wrong answer about a limb they are a giveaway. */
const NOT_A_DISTRACTOR = /penis|clitoris|pudendal|vesical|uterine|rectal|ovarian|testicular/i;

/**
 * Other structures' arteries as choice names, none overlapping the
 * structure's own arteries or each other.
 *
 * NEVER FROM A STRUCTURE SHARING AN AREA. The reviewed lists name the main
 * vessels, not every one: the femur's list stops at the circumflex femorals,
 * the deep femoral and the obturator, but the genicular arteries feed its
 * lower end too. A knee structure's "superior medial genicular artery" offered
 * as a WRONG answer about the femur would be marking a true fact false. So
 * wrong answers come from outside the structure's own areas — the same region
 * first (the hip, for the ACL), then anywhere — which keeps them plausible and
 * keeps them wrong.
 */
export function wrongArteries(structure: AnatomyStructure, all: readonly AnatomyStructure[], own: readonly string[], rng: Rng): string[] {
  const myAreas = new Set(areasOf(structure));
  const sharesArea = (s: AnatomyStructure) => areasOf(s).some((a) => myAreas.has(a));
  // The rule is about the VESSEL, not where the name was found: an artery
  // any neighbour lists is out, even when it is drawn from a structure
  // elsewhere that happens to list it too.
  const nearby = [...own, ...all.filter((s) => s.id !== structure.id && sharesArea(s)).flatMap(arteriesOf)];
  const others = all.filter((s) => s.id !== structure.id && !sharesArea(s));
  const tiers = [others.filter((s) => s.region === structure.region), others];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const tier of tiers) {
    for (const name of shuffle([...tier.flatMap(arteriesOf)], rng)) {
      const shown = choiceName(name);
      const key = vesselKey(shown);
      if (!key || seen.has(key) || shown.length > MAX_WRONG_NAME || NOT_A_DISTRACTOR.test(name)) continue;
      if (overlaps(name, nearby) || overlaps(shown, nearby) || out.some((o) => overlaps(shown, [o]))) continue;
      seen.add(key);
      out.push(shown);
    }
    if (out.length >= MAX_WRONG) break;
  }
  return out;
}

/** "How rich is the blood supply of X?" — every reviewed structure but landmarks. */
export function buildBloodSupplyRatingMcqs(pool: readonly AnatomyStructure[]): MCQQuestion[] {
  const questions: MCQQuestion[] = [];
  for (const structure of pool) {
    const b = structure.bloodSupply;
    if (!b || structure.category === 'landmark') continue;
    // A fixed, ordered scale: Rich / Moderate / Poor read as a scale, so they
    // are not shuffled.
    const choices = RATING_CHOICES.map((c) => c.label);
    const zone = b.zone ? ` Poorly supplied part: ${sentence(b.zone)}` : '';
    questions.push({
      ...base(structure, 'blood-supply-rating'),
      type: 'mcq',
      id: `bloodsupply-${structure.id}-rating`,
      prompt: `How rich is the blood supply of the ${displayName(structure)}?`,
      choices,
      correctIndex: RATING_CHOICES.findIndex((c) => c.rating === b.rating),
      explanation: `${RATING_CHOICES.find((c) => c.rating === b.rating)!.label}: ${RATING_MEANING[b.rating]}.${zone}`,
    });
  }
  return questions;
}
