import type { AnatomyStructure } from '../../types/structure';
import type { AnatomyImageAsset } from '../../types/image';
import type { LocateQuestion, MCQQuestion, QuestionType, RevisionQuestion } from '../../types/question';
import type { Area } from '../../types/region';
import { buildIndexes, filterStructures } from '../indexes';
import { createRng, shuffle } from '../rng';
import { buildMcqQuestions } from './mcq';
import { buildLocateQuestions } from './locate';

/**
 * The two formats a first session uses. Both are self-explanatory on sight;
 * OINA, typed recall and select-all all assume the student already knows how
 * the app grades, which a first session exists to teach.
 */
export const STARTER_TYPES: QuestionType[] = ['mcq', 'locate'];

/** Short on purpose: the aim is a finished session and a first locate hit, not coverage. */
export const STARTER_COUNT = 8;

export interface StarterSetConfig {
  /** The areas chosen in onboarding. Empty or omitted = every area. */
  areas?: readonly Area[];
  count?: number;
  /** Fixed seed for deterministic tests. */
  seed?: number;
}

/**
 * The guided first session (CR: first-run workflow). Muscles only, from the
 * student's own areas, alternating a multiple-choice warm-up with locate
 * questions ordered biggest target first — so the first thing they are asked
 * to click is a large superficial muscle they can actually see, not a sliver
 * of a deep one. Falls back to multiple choice alone when the chosen areas
 * have no hotspot images, and to an empty set when they have no muscles, so
 * the caller can decide whether to run an ordinary session instead.
 */
export function buildStarterSet(
  structures: AnatomyStructure[],
  images: AnatomyImageAsset[],
  config: StarterSetConfig = {},
): RevisionQuestion[] {
  const count = Math.max(1, config.count ?? STARTER_COUNT);
  const rng = createRng(config.seed);

  const pool = filterStructures(structures, { areas: [...(config.areas ?? [])], category: 'muscle' });
  if (pool.length === 0) return [];
  const poolIds = new Set(pool.map((s) => s.id));

  // Built over the full dataset so distractors stay plausible — same as generateSet.
  const indexes = buildIndexes(structures);
  const relevantImages = images.filter((img) =>
    img.mode === 'single-structure'
      ? !!img.structureId && poolIds.has(img.structureId)
      : (img.hotspots ?? []).some((h) => poolIds.has(h.structureId)),
  );

  // Normalised hotspot area per (image, structure): the proxy for "how visible
  // is this target" — the largest polygon is the one a beginner can find.
  const hotspotArea = new Map<string, number>();
  for (const img of images) {
    for (const h of img.hotspots ?? []) hotspotArea.set(`${img.id}__${h.structureId}`, h.area);
  }
  const areaOfQuestion = (q: LocateQuestion) => hotspotArea.get(`${q.imageId}__${q.structureId}`) ?? 0;

  const locate = onePerStructure(
    buildLocateQuestions(pool, relevantImages).sort((a, b) => areaOfQuestion(b) - areaOfQuestion(a)),
  );
  const mcq = onePerStructure(shuffle(buildMcqQuestions(pool, relevantImages, indexes, rng), rng));

  // Roughly half and half, each side topping the other up when it runs short.
  const locateTarget = Math.min(locate.length, Math.ceil(count / 2));
  const mcqTarget = Math.min(mcq.length, count - locateTarget);
  const chosenLocate = locate.slice(0, Math.min(locate.length, count - mcqTarget));
  const chosenMcq = mcq.slice(0, mcqTarget);

  // Interleave, multiple choice first: a warm-up before the first click.
  const out: RevisionQuestion[] = [];
  for (let i = 0; i < Math.max(chosenMcq.length, chosenLocate.length); i++) {
    if (i < chosenMcq.length) out.push(chosenMcq[i]);
    if (i < chosenLocate.length) out.push(chosenLocate[i]);
  }
  return out.slice(0, count);
}

function onePerStructure<Q extends MCQQuestion | LocateQuestion>(questions: Q[]): Q[] {
  const seen = new Set<string>();
  return questions.filter((q) => {
    if (seen.has(q.structureId)) return false;
    seen.add(q.structureId);
    return true;
  });
}
