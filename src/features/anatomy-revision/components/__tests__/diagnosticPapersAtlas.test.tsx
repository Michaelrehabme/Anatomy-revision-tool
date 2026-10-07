import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MuscleCard } from '../MuscleCard/MuscleCard';
import { MobileMuscleCard } from '../mobile/MobileMuscleCard';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import { attachHotspots } from '../../data/seed/hotspots';
import { buildAreaFacts, buildStructureIndex, joinLoadedAreas } from '../../data/content/split';
import { linkImages } from '../../lib/linkImages';
import { atlasRow, functionalRole, muscleCardFacts } from '../../lib/atlasFacts';
import { promptHighlightHotspots } from '../../lib/promptHighlight';
import {
  PAPER_VERSION,
  buildPaperQuestions,
  loadPapers,
  paperScope,
  type PaperContent,
  type PaperQuestionKind,
  type PaperQuestionSpec,
} from '../../lib/diagnosticPapers';
import { AREAS } from '../../types/region';
import { isMuscle, type AnatomyStructure } from '../../types/structure';
import type { StructureIndexEntry } from '../../types/structureIndex';
import type { UseEntitlement } from '../../hooks/useEntitlement';
import { anatomyContentFrom } from '../../hooks/useAnatomyContent';

/**
 * THE PAPERS SAY WHAT THE ATLAS SAYS.
 *
 * The owner approved the ten diagnostic papers on 7 Oct 2026 "provided they
 * are all the same as the answers in the Atlas". A student is marked against
 * a paper and revises from the Atlas: if the two word a fact differently, the
 * student who learned it from the card is the one marked wrong.
 *
 * So, for every one of the 150 questions, the answer the paper MARKS CORRECT
 * — built by the real builder, from a bundled build's facts and again from
 * the facts a server build is sent for that paper's area — must be, character
 * for character, what the Atlas shows for that structure and that fact:
 *
 *   origin, insertion, action   the Atlas table's three columns for a muscle
 *                               (lib/atlasFacts atlasRow) and the card's rows
 *                               (muscleCardFacts — the cards print from it)
 *   nerve                       the card's "Innervation" row
 *   functional                  the card's "Functional role" row
 *   name the picture, vignette  the structure's name, the card's heading
 *
 * and a picture question must show a picture of THAT structure, one the
 * structure is linked to, with the structure picked out on it.
 *
 * The second half renders the real cards and looks for the words on them, so
 * a card that stops printing from lib/atlasFacts fails here too.
 *
 * IF THIS FAILS: a fact's wording was changed in one place and not the other,
 * or a card stopped showing a fact a paper asks about. Put the two back in
 * step; do not edit a paper that has been sat (lib/diagnosticPapers.ts).
 */

afterEach(cleanup);

const file = (await loadPapers(PAPER_VERSION))!;
// The pictures as the app holds them at a sitting: with their traced outlines.
await attachHotspots();
const images = new Map(ALL_IMAGES.map((i) => [i.id, i]));
const seedById = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));

/** A bundled build: every structure with its facts. */
const bundled: PaperContent = { structuresById: seedById, indexById: seedById, imagesById: images };

/** A server build holding only the paper's own areas, the facts through JSON as on the wire. */
const SERVER_INDEX = linkImages(JSON.parse(JSON.stringify(buildStructureIndex(ALL_STRUCTURES))) as StructureIndexEntry[], ALL_IMAGES);
const AREA_FACTS = JSON.parse(JSON.stringify(buildAreaFacts(ALL_STRUCTURES))) as ReturnType<typeof buildAreaFacts>;
function serverHolding(areas: readonly (typeof AREAS)[number][]): PaperContent {
  const held = joinLoadedAreas(SERVER_INDEX, areas.map((a) => AREA_FACTS[a]));
  return {
    structuresById: new Map(held.map((s) => [s.id, s])),
    indexById: new Map(SERVER_INDEX.map((s) => [s.id, s])),
    imagesById: images,
  };
}

const KIND_WORDS: Record<PaperQuestionKind, string> = {
  identify: 'name (picture question)',
  injury: 'name (injury vignette)',
  origin: 'origin',
  insertion: 'insertion',
  nerve: 'nerve',
  action: 'action',
  functional: 'functional role',
};

/** What the Atlas shows for this structure and this kind of fact, from the functions the Atlas itself uses. */
function atlasShows(
  kind: PaperQuestionKind,
  facts: AnatomyStructure | undefined,
  entry: StructureIndexEntry,
  indexById: ReadonlyMap<string, StructureIndexEntry>,
): { text: string | null; table?: string } {
  if (kind === 'identify' || kind === 'injury') return { text: entry.name };
  if (!facts) return { text: null };
  if (kind === 'functional') return { text: functionalRole(facts) };
  if (!isMuscle(facts)) return { text: null };
  const card = muscleCardFacts(facts);
  const [origin, insertion, action] = atlasRow(facts, indexById).columns;
  if (kind === 'origin') return { text: card.origin, table: origin.text };
  if (kind === 'insertion') return { text: card.insertion, table: insertion.text };
  if (kind === 'action') return { text: card.action, table: action.text };
  return { text: card.nerve };
}

interface Asked {
  paper: string;
  number: number;
  spec: PaperQuestionSpec;
  marked: string;
}

/** Every question of every paper, built both ways, with every difference from the Atlas listed. */
function compare(): { asked: Asked[]; differences: string[] } {
  const asked: Asked[] = [];
  const differences: string[] = [];
  for (const paper of file.papers) {
    for (const [build, content] of [
      ['bundled', bundled],
      ['server', serverHolding(paperScope(paper.id))],
    ] as const) {
      const built = buildPaperQuestions(paper, content);
      if (built.problems.length > 0) {
        differences.push(`${paper.id} (${build} build) does not build: ${built.problems.join('; ')}`);
        continue;
      }
      paper.questions.forEach((spec, i) => {
        const question = built.questions[i];
        const marked = question.choices[question.correctIndex];
        const entry = content.indexById.get(spec.structureId)!;
        const where = `${paper.id} paper, question ${i + 1} (${entry.name}, ${KIND_WORDS[spec.kind]}), ${build} build`;
        const shown = atlasShows(spec.kind, content.structuresById.get(spec.structureId), entry, content.indexById);
        if (shown.text === null) {
          differences.push(`${where}: the paper marks "${marked}" correct, and the Atlas shows nothing for this fact.`);
        } else if (shown.text !== marked) {
          differences.push(`${where}: the paper marks "${marked}" correct, but the Atlas card shows "${shown.text}".`);
        }
        if (shown.table !== undefined && shown.table !== marked) {
          differences.push(`${where}: the paper marks "${marked}" correct, but the Atlas table shows "${shown.table}".`);
        }

        if (spec.kind === 'identify') {
          const image = images.get(spec.imageId ?? '');
          if (!image) {
            differences.push(`${where}: picture "${spec.imageId}" does not exist.`);
          } else {
            if (question.promptImageId !== image.id) differences.push(`${where}: the question shows "${question.promptImageId}", the paper names "${image.id}".`);
            // Every picture on the papers is the structure's own (never a slide it merely appears on).
            if (image.mode !== 'single-structure' || image.structureId !== spec.structureId) {
              differences.push(`${where}: picture "${image.id}" is not a picture of ${entry.name}.`);
            }
            if (!entry.imageIds.includes(image.id)) differences.push(`${where}: the Atlas does not link ${entry.name} to picture "${image.id}".`);
            // Picked out on it: either the app draws the outline traced for
            // this structure, or the picture carries no outlines at all and
            // was rendered with its one structure already in colour.
            const outlines = image.hotspots ?? [];
            if (outlines.length > 0 && promptHighlightHotspots(image, spec.structureId).length === 0) {
              differences.push(`${where}: picture "${image.id}" has outlines, and none of them is ${entry.name}.`);
            }
          }
        }
        if (build === 'bundled') asked.push({ paper: paper.id, number: i + 1, spec, marked });
      });
    }
  }
  return { asked, differences };
}

const { asked, differences } = compare();

describe('the diagnostic papers against the Atlas', () => {
  it('covers all 150 questions', () => {
    expect(asked).toHaveLength(150);
  });

  it('marks correct, on every question, exactly what the Atlas shows for that structure and fact', () => {
    expect(
      differences,
      `\nThe owner approved the papers on condition that their answers are the Atlas's.\n${differences.join('\n')}\n`,
    ).toEqual([]);
  });
});

/** An account holding every area, so no card is locked. */
const access: UseEntitlement = {
  entitlement: { tier: 'individual', source: 'paddle', expiresAt: null },
  tier: 'individual',
  loading: false,
  canAccess: () => true,
  locked: () => [],
  areas: [...AREAS],
  freeArea: null,
  chooseFreeArea: () => {},
  canSwitchFree: false,
  daysUntilSwitch: 0,
  switchUsed: false,
  refresh: () => {},
} as unknown as UseEntitlement;

const content = anatomyContentFrom(ALL_STRUCTURES, ALL_IMAGES);

const LAYOUTS = [
  {
    name: 'desktop',
    renderCard: (structureId: string) =>
      render(
        <MemoryRouter>
          <MuscleCard
            access={access}
            structureId={structureId}
            content={content}
            repository={null}
            userId={null}
            contextIds={[]}
            onNavigateStructure={vi.fn()}
            onBack={vi.fn()}
            onDrill={vi.fn()}
            onNavigate={vi.fn()}
          />
        </MemoryRouter>,
      ),
  },
  {
    name: 'mobile',
    renderCard: (structureId: string) =>
      render(
        <MemoryRouter>
          <MobileMuscleCard access={access} structureId={structureId} content={content} repository={null} userId={null} onBack={vi.fn()} onDrill={vi.fn()} />
        </MemoryRouter>,
      ),
  },
];

describe.each(LAYOUTS)('the $name card prints what the papers mark correct', ({ renderCard }) => {
  // One card per structure, with everything the papers ask of it looked for at once.
  const byStructure = new Map<string, Asked[]>();
  for (const a of asked) byStructure.set(a.spec.structureId, [...(byStructure.get(a.spec.structureId) ?? []), a]);

  it('for every structure on every paper', () => {
    const missing: string[] = [];
    for (const [structureId, questions] of byStructure) {
      const { container, unmount } = renderCard(structureId);
      const printed = [...container.querySelectorAll('h1, div, p')].map((el) => (el.children.length === 0 ? el.textContent ?? '' : ''));
      for (const q of questions) {
        if (!printed.includes(q.marked)) {
          missing.push(`${q.paper} paper, question ${q.number} (${seedById.get(structureId)!.name}, ${KIND_WORDS[q.spec.kind]}): "${q.marked}" is not printed on the card.`);
        }
      }
      // A picture question whose picture is the card's own shows the same file.
      for (const q of questions.filter((x) => x.spec.kind === 'identify')) {
        const cardPicture = container.querySelector('img')?.getAttribute('src');
        const mine = images.get(q.spec.imageId!)!;
        const ownPictures = ALL_IMAGES.filter((i) => i.mode === 'single-structure' && i.structureId === structureId).map((i) => i.filePath);
        if (!cardPicture || !ownPictures.includes(cardPicture) || !ownPictures.includes(mine.filePath)) {
          missing.push(`${q.paper} paper, question ${q.number}: the card and the paper do not both show a picture of ${seedById.get(structureId)!.name}.`);
        }
      }
      unmount();
    }
    expect(missing, `\n${missing.join('\n')}\n`).toEqual([]);
  });
});
