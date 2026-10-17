import { isMuscle, isBone, isLandmark, isJoint, isLigament, reviewedAttachmentIds, areasOf, JOINT_TYPE_LABELS } from '../types/structure';
import type { AnatomyStructure, LigamentStructure } from '../types/structure';
import { REGION_LABELS, SUBREGION_LABELS, AREA_LABELS } from '../types/region';
import { BLOOD_SUPPLY_TAUGHT, type OinaPromptKind } from '../types/question';
import type { StructureIndexEntry } from '../types/structureIndex';
import { siteLabel } from './attachmentSites';
import { singular } from './answerMatching';

/** Every structure by id, for naming a ligament's attachments as "landmark of bone". */
export type SiteLookup = ReadonlyMap<string, StructureIndexEntry>;

/**
 * Shared fact-line builder used by flashcards, MCQ explanations, and
 * StructureFactsPanel — one place that knows how to turn any category of
 * AnatomyStructure into readable prose lines.
 */
export function describeStructure(s: AnatomyStructure, sites?: SiteLookup): string[] {
  // Leads with the area, since that is what the user filtered by (CR-017). A
  // structure can sit in several — a pedicle revises under all three spine levels —
  // so they are all named. The finer subregion is kept in brackets where it adds
  // something the areas do not ("Hip (Spine)" for the sacroiliac joint), and dropped
  // where they would just repeat each other ("Shoulder (Shoulder)", or "Lumbar Spine
  // (Spine)", whose area label already contains the word).
  const areas = areasOf(s);
  const areaLabel = areas.length ? areas.map((a) => AREA_LABELS[a]).join(', ') : REGION_LABELS[s.region];
  const sub = s.subregion ? SUBREGION_LABELS[s.subregion] : undefined;
  const subAddsInfo =
    !!sub && !areas.some((a) => AREA_LABELS[a].toLowerCase().includes(sub.toLowerCase()));
  const lines: string[] = [`Area: ${areaLabel}${subAddsInfo ? ` (${sub})` : ''}`];

  if (isMuscle(s)) {
    lines.push(`Origin: ${s.origin.join('; ')}`);
    lines.push(`Insertion: ${s.insertion.join('; ')}`);
    lines.push(
      `Nerve: ${s.nerve
        .map((n) => `${n.name}${n.roots.length ? ` (${n.roots.join(', ')})` : ''}`)
        .join('; ')}`,
    );
    lines.push(`Action: ${s.actionText}`);
  } else if (isBone(s)) {
    if (s.attachments.length) lines.push(`Attachments: ${s.attachments.join('; ')}`);
    if (s.articulations.length) lines.push(`Articulations: ${s.articulations.join('; ')}`);
  } else if (isLandmark(s)) {
    if (s.attachments.length) lines.push(`Attachments: ${s.attachments.join('; ')}`);
    if (s.articulations?.length) lines.push(`Articulations: ${s.articulations.join('; ')}`);
  } else if (isLigament(s)) {
    const attachments = reviewedAttachmentIds(s);
    if (attachments.length) {
      // "Greater Trochanter of the femur" where the caller can look the site
      // up; the id as words where it cannot.
      const named = attachments.map((id) => {
        const site = sites?.get(id);
        return site ? siteLabel(site, sites!) : siteName(id);
      });
      lines.push(`Attaches to: ${named.join('; ')}`);
    }
    if (s.jointId) lines.push(`Stabilises: ${s.jointId.replace(/-/g, ' ')}`);
  } else if (isJoint(s)) {
    lines.push(`Type: ${JOINT_TYPE_LABELS[s.jointType]}`);
    lines.push(`Movements: ${s.movements.join('; ')}`);
    if (s.stabilizers?.length) lines.push(`Stabilizers: ${s.stabilizers.join('; ')}`);
  }

  // Out of every card and explanation while it is unsourced (types/question.ts BLOOD_SUPPLY_TAUGHT).
  if (s.bloodSupply && BLOOD_SUPPLY_TAUGHT) {
    const b = s.bloodSupply;
    const rating = { rich: 'rich', moderate: 'moderate', poor: 'poor' }[b.rating];
    const vessels = b.primary ? [b.primary, ...b.assisting].join(', ') : 'no single named artery';
    lines.push(`Blood supply (${rating}): ${vessels}`);
  }
  if (s.clinical) lines.push(`Clinical relevance: ${s.clinical}`);
  return lines;
}

export function summarizeStructure(s: AnatomyStructure, sites?: SiteLookup): string {
  return [s.description, ...describeStructure(s, sites)].join('\n');
}

/**
 * One fact of one muscle, for OINA explanations (CR-018). Deliberately not
 * summarizeStructure: OINA asks origin, insertion, nerve and action as four
 * separate questions about the same muscle, so an explanation that printed
 * all four would answer the next three the moment the student got one wrong.
 *
 * Origins and insertions keep their authored head prefixes here even though
 * the choices strip them — once the answer is being explained, knowing that
 * the ischial tuberosity is specifically the long head is the useful part.
 */
export function describeFact(s: AnatomyStructure, promptKind: OinaPromptKind): string {
  const b = s.bloodSupply;
  if (promptKind === 'blood-supply') {
    return b?.primary ? `${s.name} — primary blood supply: ${b.primary}` : '';
  }
  if (promptKind === 'blood-supply-assisting') {
    return b?.primary && b.assisting.length
      ? `${s.name} — primary blood supply: ${b.primary}; also supplied by: ${b.assisting.join('; ')}`
      : '';
  }
  if (!isMuscle(s)) return '';
  switch (promptKind) {
    case 'origin':
      return `${s.name} — origin: ${s.origin.join('; ')}`;
    case 'insertion':
      return `${s.name} — insertion: ${s.insertion.join('; ')}`;
    case 'nerve':
      return `${s.name} — nerve supply: ${s.nerve
        .map((n) => `${n.name}${n.roots.length ? ` (${n.roots.join(', ')})` : ''}`)
        .join('; ')}`;
    case 'action':
      return `${s.name} — action: ${s.actionText}`;
  }
}

/**
 * The generator's stand-in for a description nobody has written yet
 * (generateLigamentSeed.ts): "Ligament of the hip." or "Ligament of the knee,
 * running between the tibia and the femur." It says less than the attachment
 * list does, and two ligaments can share one word for word.
 */
const PLACEHOLDER_DESCRIPTION = /^Ligament of the [^,.]+(?:, running between .+)?\.$/;

/** Lower case, no punctuation, and none of the small words a name may or may not carry. */
const plain = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(?:the|of|ligaments?)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * The opening sentence of a ligament's authored description, which is where
 * every one of them says what it runs from and to. Undefined when there is
 * no authored description, or when the sentence gives the answer away: the
 * ligament of the head of the femur runs "to the fovea on the head of the
 * femur".
 */
export function ligamentCourse(s: LigamentStructure): string | undefined {
  if (PLACEHOLDER_DESCRIPTION.test(s.description)) return undefined;
  const sentence = s.description.split(/(?<=\.)\s+(?=[A-Z])/)[0]?.trim();
  if (!sentence || ` ${plain(sentence)} `.includes(` ${plain(s.name)} `)) return undefined;
  return sentence;
}

/** An attachment's id as words: "ischial tuberosity", and "AIIS" for the three spines known by their initials. */
const siteName = (id: string) => (/^(?:aiis|asis|psis)$/.test(id) ? id.toUpperCase() : id.replace(/-/g, ' '));

const attachmentClue = (ids: string[]) => `attaches to: ${ids.map(siteName).join('; ')}`;

/**
 * A short text "clue" built from a structure's own facts, used as the
 * fallback prompt for text-only identify questions (mirrors quiz.py's
 * gen_identify fallback for when no image is available). Must never return
 * an empty string — that turns "Name the structure: <clue>" into an
 * unguessable "Name the structure:" with nothing after the colon (found via
 * a real bug report: 42 landmarks across the seed data have an empty
 * `attachments` array — e.g. costovertebral-joint only has `articulations`
 * authored — so attachments alone isn't a safe single source for the clue).
 */
export function buildIdentifyClue(s: AnatomyStructure): string {
  if (isMuscle(s)) return `${s.origin.join('; ')} — ${s.actionText}`;
  if (isJoint(s)) return `${JOINT_TYPE_LABELS[s.jointType]} — ${s.movements.join('; ')}`;
  if (isLigament(s)) {
    // Where it runs, in the description's words. The bones alone were the clue
    // until 8 Oct 2026, and "attaches to: pelvis" is true of five hip
    // ligaments: 110 of 166 shared their bone list with a neighbour.
    const course = ligamentCourse(s);
    if (course) return course;
    // By id rather than name: facts.ts has no structure lookup, and "attaches
    // to: talus; fibula" reads fine from the ids. Not a clue that picks one
    // ligament out — clueAlsoFits below is what keeps its question fair.
    const attachments = reviewedAttachmentIds(s);
    if (attachments.length) return attachmentClue(attachments);
    return s.description;
  }
  // A fact list that names the structure is the answer, not a clue: the
  // vertebral body's only attachment is "Anterior and posterior longitudinal
  // ligaments run along the vertebral bodies" (found on a phone, 11 Oct 2026).
  // The next source down is asked instead, and the first is kept only when
  // every one of them gives the name away.
  const sources = [s.attachments.join('; '), s.articulations?.join('; ') ?? '', s.description].filter(Boolean);
  return sources.find((clue) => !namesStructure(clue, s)) ?? sources[0];
}

/** Lower-case words in the singular, so "vertebral bodies" is found to name the "Vertebral Body". */
const clueWords = (text: string) =>
  text
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(singular)
    .join(' ');

/** Whether a clue contains the structure's name or one of its aliases, in either number. */
export function namesStructure(clue: string, s: Pick<AnatomyStructure, 'name' | 'aliases'>): boolean {
  const words = ` ${clueWords(clue)} `;
  return [s.name, ...s.aliases].map(clueWords).some((name) => name && words.includes(` ${name} `));
}

/**
 * Whether the clue written for `correct` is just as true of `other`, which
 * would make `other` a second right answer if it were offered as a wrong one.
 *
 * Two structures can produce the same clue outright (two plane joints that
 * both glide). And a ligament still on its bone list is matched by every
 * ligament reaching all of those bones, in whatever order they are listed and
 * whatever else it reaches: "attaches to: pelvis" fits the sacrotuberous
 * ligament too.
 */
export function clueAlsoFits(correct: AnatomyStructure, other: AnatomyStructure): boolean {
  const clue = buildIdentifyClue(correct);
  if (buildIdentifyClue(other) === clue) return true;
  if (!isLigament(correct) || !isLigament(other)) return false;
  const bones = reviewedAttachmentIds(correct);
  if (!bones.length || clue !== attachmentClue(bones)) return false;
  const reached = new Set(reviewedAttachmentIds(other));
  return bones.every((id) => reached.has(id));
}

/**
 * Words that say what a structure DOES, bolded wherever they appear on a card:
 * the movements and the jobs a ligament does.
 */
const FUNCTION_WORD =
  /\b(?:abduct\w*|adduct\w*|flex\w*|extend\w*|extension|rotat\w*|elevat\w*|depress\w*|protract\w*|retract\w*|stabili[sz]\w*|invert\w*|evert\w*|inversion|eversion|pronat\w*|supinat\w*|plantarflex\w*|dorsiflex\w*|resist\w*|prevent\w*|limit\w*|restrain\w*|reinforc\w*)\b/gi;

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `text` with the movement words and each of `terms` in **bold**. */
export function emphasise(text: string, terms: readonly string[] = []): string {
  const names = [...new Set(terms.filter((t) => t.length > 2))].sort((a, b) => b.length - a.length).map(escapeRegExp);
  const pattern = new RegExp(`${names.length ? `\\b(?:${names.join('|')})\\b|` : ''}${FUNCTION_WORD.source}`, 'gi');
  return text.replace(pattern, (m) => `**${m}**`);
}

const boldList = (items: readonly string[]) => items.map((item) => `**${item}**`).join('; ');

/**
 * A card back as short bullet points with the key words in bold (owner,
 * 17 Oct 2026: the descriptions were "quite a mouthful"). Rendered by
 * components/shared/RichText: "• " starts a bullet, **…** is bold.
 *
 * The description becomes one bullet per sentence, with its attachment sites
 * and its movement words in bold; then one bullet per fact, the facts
 * themselves (origins, insertions, nerves, attachments, movements) in bold.
 */
export function cardBullets(s: AnatomyStructure, sites?: SiteLookup): string {
  const lines: string[] = [];
  const siteNames = isLigament(s)
    ? reviewedAttachmentIds(s).flatMap((id) => {
        const site = sites?.get(id);
        return site ? [site.name.replace(' (grouped)', ''), ...site.aliases] : [id.replace(/-/g, ' ')];
      })
    : [];
  if (s.description && !PLACEHOLDER_DESCRIPTION.test(s.description)) {
    for (const sentence of s.description.split(/(?<=[.!?])\s+(?=[A-Z])/)) {
      if (sentence.trim()) lines.push(`• ${emphasise(sentence.trim(), siteNames)}`);
    }
  }
  const areas = areasOf(s);
  lines.push(`• Area: ${areas.length ? areas.map((a) => AREA_LABELS[a]).join(', ') : REGION_LABELS[s.region]}`);
  if (isMuscle(s)) {
    for (const line of muscleProfileLines(s, true)) lines.push(`• ${line}`);
  } else if (isLigament(s)) {
    const named = reviewedAttachmentIds(s).map((id) => {
      const site = sites?.get(id);
      return site ? siteLabel(site, sites!) : siteName(id);
    });
    if (named.length) lines.push(`• Attaches to: ${boldList(named)}`);
    if (s.jointId) lines.push(`• Stabilises: **${s.jointId.replace(/-/g, ' ')}**`);
  } else if (isJoint(s)) {
    lines.push(`• Type: **${JOINT_TYPE_LABELS[s.jointType]}**`);
    lines.push(`• Movements: ${boldList(s.movements)}`);
    if (s.stabilizers?.length) lines.push(`• Stabilisers: ${boldList(s.stabilizers)}`);
  } else if (isBone(s) || isLandmark(s)) {
    if (s.attachments.length) lines.push(`• Attachments: ${boldList(s.attachments)}`);
    if (s.articulations?.length) lines.push(`• Articulations: ${boldList(s.articulations)}`);
  }
  if (s.clinical) lines.push(`• Clinical relevance: ${emphasise(s.clinical, siteNames)}`);
  return lines.join('\n');
}


/**
 * A muscle's four facts under the labels the owner chose (17 Oct 2026):
 * "Origin(s):", "Insertion(s):", "Nerve supply:", "Action(s):". Items are
 * joined with commas, or semicolons where an item has a comma of its own
 * ("Axillary nerve (C5, C6)"). `bold` puts each item in **bold** for a card.
 */
export function muscleProfileLines(s: AnatomyStructure, bold = false): string[] {
  if (!isMuscle(s)) return [];
  const list = (items: readonly string[]) => {
    const shown = bold ? items.map((item) => `**${item}**`) : items;
    return shown.join(items.some((item) => item.includes(',')) ? '; ' : ', ');
  };
  return [
    `Origin(s): ${list(s.origin)}`,
    `Insertion(s): ${list(s.insertion)}`,
    `Nerve supply: ${list(s.nerve.map((n) => `${n.name}${n.roots.length ? ` (${n.roots.join(', ')})` : ''}`))}`,
    `Action(s): ${bold ? emphasise(s.actionText) : s.actionText}`,
  ];
}
