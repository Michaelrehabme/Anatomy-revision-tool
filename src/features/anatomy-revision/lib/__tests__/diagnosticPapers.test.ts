import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import { buildAreaFacts, buildStructureIndex, joinLoadedAreas } from '../../data/content/split';
import { buildVocabulary } from '../../data/content/vocabulary';
import { linkImages } from '../linkImages';
import { AREAS, type Area } from '../../types/region';
import { areasOf, isMuscle, type AnatomyStructure } from '../../types/structure';
import { COHORT_DRAWN_VERSION, DIAGNOSTIC_VERSION } from '../diagnostic';
import {
  PAPER_CHOICES,
  PAPER_SIZE,
  PAPER_VERSION,
  WHOLE_BODY_PAPER,
  areasPaperNeeds,
  buildPaperQuestions,
  loadPapers,
  paperIdForSitter,
  paperLabel,
  paperScope,
  paperShapeProblems,
  resolveDiagnosticPaper,
  type DiagnosticPaperSpec,
  type DiagnosticPapersFile,
  type PaperContent,
  type PaperId,
} from '../diagnosticPapers';
import { NEW_VERSION_NEEDED, buildFromScope, lockDrift, lockFor, type PaperLock } from '../../../../scripts/lib/paperLock';

/**
 * The ten diagnostic papers, against the real seed.
 *
 * What has to be true of them is mostly about what they are NOT: not a place
 * a fact is published, not a different test for two students on the same
 * paper, not something an edit to the seed can change behind a baseline's
 * back. Each of those is held here.
 */

const DIR = 'src/features/anatomy-revision/data/diagnostic';
const file = (await loadPapers(PAPER_VERSION))!;
const lock = JSON.parse(readFileSync(`${DIR}/papers.v${PAPER_VERSION}.lock.json`, 'utf8')) as PaperLock;
const paper = (id: PaperId) => file.papers.find((p) => p.id === id)!;
const images = new Map(ALL_IMAGES.map((i) => [i.id, i]));

/** A BUNDLED build: every structure with its facts, and the index is the seed itself. */
const bundled: PaperContent = {
  structuresById: new Map(ALL_STRUCTURES.map((s) => [s.id, s])),
  indexById: new Map(ALL_STRUCTURES.map((s) => [s.id, s])),
  imagesById: images,
};

/**
 * A build that FETCHES facts, holding only these areas: the index as it is
 * cut for the bundle (no facts in it), and the structures as they come back
 * from the content function for the areas held — through JSON, as on the wire.
 */
const SERVER_INDEX = linkImages(JSON.parse(JSON.stringify(buildStructureIndex(ALL_STRUCTURES))), ALL_IMAGES);
const AREA_FACTS = JSON.parse(JSON.stringify(buildAreaFacts(ALL_STRUCTURES))) as ReturnType<typeof buildAreaFacts>;
function serving(areas: readonly Area[]): PaperContent {
  const held = joinLoadedAreas(SERVER_INDEX, areas.map((a) => AREA_FACTS[a]));
  return {
    structuresById: new Map(held.map((s) => [s.id, s])),
    indexById: new Map(SERVER_INDEX.map((s) => [s.id, s])),
    imagesById: images,
  };
}

describe('the papers file', () => {
  it('is the current version, and has the whole-body paper and one for each area', () => {
    expect(file.version).toBe(PAPER_VERSION);
    expect(PAPER_VERSION).toBe(DIAGNOSTIC_VERSION);
    expect(file.papers.map((p) => p.id).sort()).toEqual([WHOLE_BODY_PAPER, ...AREAS].sort());
  });

  it('holds up: fifteen questions each, no structure twice, ids that say what they ask', () => {
    expect(paperShapeProblems(file)).toEqual([]);
  });

  // The papers are in every build, including one that otherwise carries no
  // fact. Every string in the file must be something already public: an id,
  // a kind of question, or a nerve's name from the bundled vocabulary.
  it('holds no fact: only ids, kinds, pictures, and nerve names that are already public', () => {
    const structureIds = new Set(ALL_STRUCTURES.map((s) => s.id));
    const nerves = new Set(buildVocabulary(ALL_STRUCTURES).nerves);
    const kinds = new Set(['identify', 'origin', 'insertion', 'nerve', 'action', 'functional', 'injury']);
    for (const p of file.papers) {
      for (const q of p.questions) {
        expect(Object.keys(q).sort().filter((k) => !['id', 'structureId', 'kind', 'imageId', 'injury', 'distractors'].includes(k))).toEqual([]);
        expect(structureIds.has(q.structureId), q.id).toBe(true);
        expect(kinds.has(q.kind), q.id).toBe(true);
        if (q.imageId !== undefined) expect(images.has(q.imageId), q.id).toBe(true);
        for (const d of q.distractors) {
          if (typeof d === 'string') expect(structureIds.has(d), `${q.id} ${d}`).toBe(true);
          else {
            expect(Object.keys(d)).toEqual(['nerve']);
            expect(nerves.has(d.nerve), `${q.id} ${d.nerve}`).toBe(true);
          }
        }
      }
    }
  });

  it('prints no sentence from the seed anywhere in its text', () => {
    const text = readFileSync(`${DIR}/papers.v${PAPER_VERSION}.json`, 'utf8');
    const sentences = ALL_STRUCTURES.flatMap((s) => [
      s.description,
      s.functionalContext ?? '',
      ...(isMuscle(s) ? [s.actionText, s.origin.join('; '), s.insertion.join('; ')] : []),
      ...(s.commonInjuries ?? []).flatMap((i) => [i.presentation, i.mechanism]),
    ]).filter((t) => t.length >= 24);
    expect(sentences.length).toBeGreaterThan(400);
    expect(sentences.filter((t) => text.includes(t))).toEqual([]);
  });

  it('asks only about reviewed structures', () => {
    const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
    for (const p of file.papers) {
      for (const q of p.questions) {
        expect(byId.get(q.structureId)?.needsReview ?? false, q.id).toBe(false);
        // Blood supply has its own acceptance and is not asked here at all.
        expect(q.kind).not.toContain('blood');
      }
    }
  });
});

describe.each(file.papers.map((p) => [p.id, p] as const))('the %s paper', (id, spec) => {
  const scope = paperScope(id);

  it('builds fifteen questions with four different choices, from its own area alone', () => {
    const built = buildFromScope(spec, ALL_STRUCTURES, ALL_IMAGES);
    expect(built.problems).toEqual([]);
    expect(built.questions).toHaveLength(PAPER_SIZE);
    for (const q of built.questions) {
      expect(q.choices, q.id).toHaveLength(PAPER_CHOICES);
      expect(new Set(q.choices).size, q.id).toBe(PAPER_CHOICES);
      expect(q.choices[q.correctIndex], q.id).toBeTruthy();
      expect(q.prompt.length, q.id).toBeGreaterThan(10);
      // No feedback is ever shown, and none is carried.
      expect(q.explanation).toBe('');
    }
  });

  it('asks about, and takes wrong answers from, structures inside its scope only', () => {
    const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
    for (const q of spec.questions) {
      const named = [q.structureId, ...q.distractors.filter((d): d is string => typeof d === 'string')];
      for (const sid of named) {
        expect(areasOf(byId.get(sid)!).some((a) => scope.includes(a)), `${q.id} ${sid}`).toBe(true);
      }
    }
  });

  it("offers a picture's choices from the same kind of structure as the answer", () => {
    const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
    for (const q of spec.questions.filter((x) => x.kind === 'identify')) {
      const kinds = new Set([q.structureId, ...(q.distractors as string[])].map((sid) => byId.get(sid)!.category));
      expect([...kinds], q.id).toHaveLength(1);
    }
  });

  it('gives the right answer the seed gives', () => {
    const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
    const built = buildFromScope(spec, ALL_STRUCTURES, ALL_IMAGES);
    for (const q of spec.questions) {
      const s = byId.get(q.structureId) as AnatomyStructure;
      const right = built.questions.find((b) => b.id === q.id)!;
      const answer = right.choices[right.correctIndex];
      if (q.kind === 'identify' || q.kind === 'injury') expect(answer).toBe(s.name);
      else if (q.kind === 'functional') expect(answer).toBe(s.functionalContext);
      else if (isMuscle(s)) {
        expect(answer).toBe(
          { origin: s.origin.join('; '), insertion: s.insertion.join('; '), nerve: s.nerve.map((n) => n.name).join('; '), action: s.actionText }[q.kind],
        );
      } else throw new Error(`${q.id} asks a muscle question of a ${s.category}`);
    }
  });

  // THE property: the same paper for everyone who sits it, whatever build
  // they are on and whatever else their device holds.
  it('is byte-identical for every sitter: a bundled build, its own area served, and all nine served', () => {
    const inBundled = JSON.stringify(buildPaperQuestions(spec, bundled).questions);
    const servedScope = JSON.stringify(buildPaperQuestions(spec, serving(scope)).questions);
    const servedAll = JSON.stringify(buildPaperQuestions(spec, serving(AREAS)).questions);
    expect(JSON.parse(inBundled)).toHaveLength(PAPER_SIZE);
    expect(servedScope).toBe(inBundled);
    expect(servedAll).toBe(inBundled);
  });

  it('asks the follow-up exactly what the baseline asked', () => {
    const baseline = buildPaperQuestions(spec, serving(scope)).questions;
    const followUp = buildPaperQuestions(spec, bundled, baseline.map((q) => q.id)).questions;
    expect(JSON.stringify(followUp)).toBe(JSON.stringify(baseline));
  });

  it('cannot be built without its area, and builds nothing rather than a shorter paper', () => {
    const elsewhere = AREAS.filter((a) => !scope.includes(a));
    // The whole-body paper: every area but one. An area paper: every OTHER area.
    const held = id === WHOLE_BODY_PAPER ? AREAS.slice(1) : elsewhere;
    const built = buildPaperQuestions(spec, serving(held));
    expect(built.questions).toEqual([]);
    expect(built.problems.length).toBeGreaterThan(0);
  });
});

describe('the whole-body paper', () => {
  it('covers all nine areas', () => {
    const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
    const covered = new Set(paper(WHOLE_BODY_PAPER).questions.flatMap((q) => areasOf(byId.get(q.structureId)!)));
    expect(AREAS.filter((a) => !covered.has(a))).toEqual([]);
  });

  it('is made of questions the area papers also ask, word for word', () => {
    const fromAreas = new Map<string, string>();
    for (const area of AREAS) {
      for (const q of buildFromScope(paper(area), ALL_STRUCTURES, ALL_IMAGES).questions) {
        fromAreas.set(`${q.structureId}|${q.promptKind}`, JSON.stringify([q.prompt, q.promptImageId, q.choices.slice().sort()]));
      }
    }
    for (const q of buildFromScope(paper(WHOLE_BODY_PAPER), ALL_STRUCTURES, ALL_IMAGES).questions) {
      expect(fromAreas.get(`${q.structureId}|${q.promptKind}`), q.id).toBe(
        JSON.stringify([q.prompt, q.promptImageId, q.choices.slice().sort()]),
      );
    }
  });
});

describe('a published paper is never edited', () => {
  it('still builds, question for question, what was published', () => {
    const now = lockFor(file, ALL_STRUCTURES, ALL_IMAGES);
    expect(now.problems).toEqual([]);
    const drift = lockDrift(lock, now.lock);
    // If this fails a paper students may have sat has changed under them.
    expect(drift, `\n${drift.join('\n')}\n\n${NEW_VERSION_NEEDED}\n`).toEqual([]);
    expect(Object.keys(lock.questions)).toHaveLength(file.papers.length * PAPER_SIZE);
  });

  it('notices a corrected fact, a renamed structure and a removed one', () => {
    const edited = (change: (s: AnatomyStructure) => AnatomyStructure | null) =>
      lockDrift(lock, lockFor(file, ALL_STRUCTURES.map(change).filter((s): s is AnatomyStructure => s !== null), ALL_IMAGES).lock);

    // A fact a question prints as its right answer.
    const corrected = edited((s) => (s.id === 'biceps-femoris' && isMuscle(s) ? { ...s, insertion: ['Head of the fibula (corrected)'] } : s));
    expect(corrected).toContain('dx3.knee.biceps-femoris.insertion: now builds a different question from the one published');
    // A fact a question prints as a WRONG answer is on the paper too.
    expect(corrected.some((line) => line.startsWith('dx3.knee.popliteus.insertion'))).toBe(true);

    const renamed = edited((s) => (s.id === 'anterior-cruciate-ligament' ? { ...s, name: 'ACL' } : s));
    expect(renamed).toContain('dx3.knee.anterior-cruciate-ligament.identify: now builds a different question from the one published');
    expect(renamed).toContain('dx3.whole-body.anterior-cruciate-ligament.identify: now builds a different question from the one published');

    const removed = edited((s) => (s.id === 'popliteus' ? null : s));
    expect(removed.some((line) => line.startsWith('dx3.knee.') && line.includes('no longer'))).toBe(true);
  });

  // 9 Oct 2026: the seed respelt names ("of the" dropped, ligaments in
  // sentence case) and one origin. Seven questions each show a wrong answer
  // spelt as it was published, so a follow-up reads as its baseline did.
  describe('a wrong answer the seed has since respelt', () => {
    const pinned = file.papers.flatMap((p) =>
      Object.entries(p.publishedWording ?? {}).flatMap(([questionId, byStructure]) =>
        Object.entries(byStructure).map(([structureId, pair]) => ({ p, questionId, structureId, pair })),
      ),
    );

    it('is put back on these seven questions and no others', () => {
      expect([...new Set(pinned.map((x) => x.questionId))].sort()).toEqual([
        'dx3.ankle-foot.metatarsals.identify',
        'dx3.hip.sartorius.origin',
        'dx3.lumbar-spine.interspinous-ligaments.identify',
        'dx3.thoracic-spine.costotransverse-ligament.identify',
        'dx3.thoracic-spine.radiate-ligament-of-head-of-rib.identify',
        'dx3.whole-body.sartorius.origin',
        'dx3.wrist-hand.metacarpals.identify',
      ]);
    });

    it('reads as published: the old spelling on the paper, the new one everywhere else', () => {
      const built = (id: PaperId) => buildFromScope(paper(id), ALL_STRUCTURES, ALL_IMAGES).questions;
      const choices = (id: PaperId, questionId: string) => built(id).find((q) => q.id === questionId)!.choices;
      expect(choices('hip', 'dx3.hip.sartorius.origin')).toContain('Inferior ramus of pubis');
      expect(choices('wrist-hand', 'dx3.wrist-hand.metacarpals.identify')).toContain('Distal Phalanges of the Hand (grouped)');
      expect(choices('ankle-foot', 'dx3.ankle-foot.metatarsals.identify')).toContain('Proximal Phalanges of the Foot (grouped)');
      expect(choices('lumbar-spine', 'dx3.lumbar-spine.interspinous-ligaments.identify')).toContain('Intertransverse Ligaments');
      const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
      expect(byId.get('intertransverse-ligaments')!.name).toBe('Intertransverse ligaments');
      expect(byId.get('phalanges-distal-hand')!.name).toBe('Distal Phalanges of Hand (grouped)');
    });

    it('is spelling only: a short fragment that names no structure and states no fact', () => {
      const names = ALL_STRUCTURES.flatMap((s) => [s.name, ...s.aliases].map((n) => n.toLowerCase()));
      const facts = ALL_STRUCTURES.flatMap((s) => (isMuscle(s) ? [...s.origin, ...s.insertion, s.actionText] : [])).map((f) => f.toLowerCase());
      expect(pinned.length).toBeGreaterThan(0);
      for (const { questionId, pair } of pinned) {
        expect(pair, questionId).toHaveLength(2);
        for (const fragment of pair) {
          expect(fragment.length, `${questionId}: "${fragment}"`).toBeLessThanOrEqual(12);
          expect(names.includes(fragment.trim().toLowerCase()), `${questionId}: "${fragment}" is a name`).toBe(false);
          expect(facts.includes(fragment.trim().toLowerCase()), `${questionId}: "${fragment}" is a fact`).toBe(false);
        }
        // The two differ by an article or a capital and nothing else.
        const bare = (text: string) => text.toLowerCase().replace(/\bthe\b/g, '').replace(/\s+/g, ' ').trim();
        expect(bare(pair[0]), questionId).toBe(bare(pair[1]));
      }
    });

    it('is never the right answer, which must stay what the Atlas shows', () => {
      for (const { p, questionId, structureId } of pinned) {
        const q = p.questions.find((x) => x.id === questionId)!;
        expect(q.structureId, questionId).not.toBe(structureId);
        expect(q.distractors, questionId).toContain(structureId);
      }
      const misplaced: DiagnosticPapersFile = {
        ...file,
        papers: file.papers.map((p) => (p.id === 'knee' ? { ...p, publishedWording: { [p.questions[0].id]: { [p.questions[0].structureId]: ['a', 'b'] } } } : p)),
      };
      expect(paperShapeProblems(misplaced).join(' ')).toContain('not one of its wrong answers');
    });

    it('fails the paper, rather than passing quietly, once the seed spells the words another way again', () => {
      const moved = ALL_STRUCTURES.map((s) => (s.id === 'intertransverse-ligaments' ? { ...s, name: 'Intertransverse LIGAMENTS' } : s));
      const built = buildFromScope(paper('lumbar-spine'), moved, ALL_IMAGES);
      expect(built.questions).toEqual([]);
      expect(built.problems.join(' ')).toContain('no longer reads "ligaments"');
    });
  });

  it('says a new version must be cut, and how', () => {
    expect(NEW_VERSION_NEEDED).toContain('NEW VERSION');
    expect(NEW_VERSION_NEEDED).toContain('papers:publish');
  });

  it('refuses a paper whose wrong answer comes from outside its area', () => {
    const knee = paper('knee');
    const reaching: DiagnosticPaperSpec = {
      ...knee,
      questions: knee.questions.map((q, i) => (i === 0 ? { ...q, distractors: ['deltoid', ...q.distractors.slice(1)] } : q)),
    };
    const built = buildPaperQuestions(reaching, bundled);
    expect(built.questions).toEqual([]);
    expect(built.problems.join(' ')).toContain("outside the paper's area");
  });
});

describe('which paper a student sits', () => {
  it('is the whole-body paper for anyone holding every area, and the free area for a free account', () => {
    expect(paperIdForSitter(AREAS)).toBe(WHOLE_BODY_PAPER);
    expect(paperIdForSitter(['knee'])).toBe('knee');
    expect(paperIdForSitter(['elbow'])).toBe('elbow');
    // A free account that has not chosen its area yet has nothing to be asked about.
    expect(paperIdForSitter([])).toBeNull();
  });

  it('names a paper for the report', () => {
    expect(paperLabel(WHOLE_BODY_PAPER)).toBe('the whole-body paper');
    expect(paperLabel('knee')).toBe('the knee paper');
    expect(paperLabel('wrist-hand')).toBe('the wrist & hand paper');
  });

  it('a baseline: the paper for what the sitter holds today', async () => {
    const free = await resolveDiagnosticPaper('baseline', undefined, ['knee']);
    expect(free).toMatchObject({ kind: 'paper', version: PAPER_VERSION, paper: { id: 'knee' } });
    expect(areasPaperNeeds(free)).toEqual(['knee']);

    const full = await resolveDiagnosticPaper('baseline', undefined, AREAS);
    expect(full).toMatchObject({ kind: 'paper', version: PAPER_VERSION, paper: { id: WHOLE_BODY_PAPER } });
    expect(areasPaperNeeds(full)).toEqual(AREAS);

    const none = await resolveDiagnosticPaper('baseline', undefined, []);
    expect(none.kind).toBe('unknown');
    expect(areasPaperNeeds(none)).toBeNull();
  });

  const kneeBaseline = { version: PAPER_VERSION, paperId: 'knee', questionIds: paper('knee').questions.map((q) => q.id) };
  const wholeBaseline = { version: PAPER_VERSION, paperId: WHOLE_BODY_PAPER, questionIds: paper(WHOLE_BODY_PAPER).questions.map((q) => q.id) };

  // The follow-up is the baseline's paper, never today's.
  it('a follow-up after the student changed their free area: still the knee paper, which needs the knee', async () => {
    const resolved = await resolveDiagnosticPaper('followUp', kneeBaseline, ['hip']);
    expect(resolved).toMatchObject({ kind: 'paper', paper: { id: 'knee' }, replayIds: kneeBaseline.questionIds });
    expect(areasPaperNeeds(resolved)).toEqual(['knee']);
  });

  it('a follow-up after the student subscribed: still their area paper, not the whole-body one', async () => {
    const resolved = await resolveDiagnosticPaper('followUp', kneeBaseline, AREAS);
    expect(resolved).toMatchObject({ kind: 'paper', paper: { id: 'knee' } });
  });

  it('a follow-up after a subscription lapsed: still the whole-body paper, which needs every area', async () => {
    const resolved = await resolveDiagnosticPaper('followUp', wholeBaseline, ['shoulder']);
    expect(resolved).toMatchObject({ kind: 'paper', paper: { id: WHOLE_BODY_PAPER } });
    expect(areasPaperNeeds(resolved)).toEqual(AREAS);
  });

  it("a follow-up to a version-1 baseline from the live site: that class's own paper, replayed", async () => {
    const resolved = await resolveDiagnosticPaper('followUp', { version: COHORT_DRAWN_VERSION, questionIds: ['mcq-a', 'mcq-b'] }, ['knee']);
    expect(resolved).toEqual({ kind: 'cohortDrawn', version: COHORT_DRAWN_VERSION, replayIds: ['mcq-a', 'mcq-b'] });
    expect(areasPaperNeeds(resolved)).toEqual(AREAS);
  });

  // Version 2 was one public paper. It never shipped; nothing real carries it.
  it('a follow-up to a version this build does not have: nothing is asked', async () => {
    const resolved = await resolveDiagnosticPaper('followUp', { version: 2, questionIds: ['mcq-a'] }, AREAS);
    expect(resolved).toEqual({ kind: 'unknown', version: 2 });
    expect(await loadPapers(2)).toBeNull();
  });
});

describe('the file as a whole', () => {
  it('asks each kind of question the dataset supports in an area', () => {
    const f = file as DiagnosticPapersFile;
    for (const p of f.papers) {
      const kinds = new Set(p.questions.map((q) => q.kind));
      // Every paper names pictures and asks at least three kinds of fact.
      expect(kinds.has('identify'), p.id).toBe(true);
      expect([...kinds].filter((k) => k !== 'identify').length, p.id).toBeGreaterThanOrEqual(3);
    }
  });
});
