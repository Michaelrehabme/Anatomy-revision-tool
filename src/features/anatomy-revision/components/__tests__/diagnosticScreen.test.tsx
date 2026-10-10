import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DiagnosticScreen } from '../Diagnostic/DiagnosticScreen';
import { createMemoryRepository } from '../../data/memoryRepository';
import { ALL_STRUCTURES, ALL_IMAGES } from '../../data/seed';
import { COHORT_DRAWN_VERSION, DIAGNOSTIC_SIZE, DIAGNOSTIC_VERSION } from '../../lib/diagnostic';
import { WHOLE_BODY_PAPER, resolveDiagnosticPaper, type DiagnosticPaper } from '../../lib/diagnosticPapers';
import { anatomyContentFrom, type AnatomyContent } from '../../hooks/useAnatomyContent';
import { AREAS, type Area } from '../../types/region';
import { areasOf } from '../../types/structure';

/**
 * End to end over the real dataset: a cohort id in, a stored result out.
 *
 * The assertion that matters most is the negative one — that finishing a
 * sitting writes a diagnostic result and NOTHING else. An attempt recorded
 * here would reach the scheduler and the educator's weakness table, and the
 * sitting promises a student it does neither.
 */

/** The papers as the route resolves them for a baseline: every area held, and the knee alone. */
const wholeBody = await resolveDiagnosticPaper('baseline', undefined, AREAS);
const kneePaper = await resolveDiagnosticPaper('baseline', undefined, ['knee']);
const everything = anatomyContentFrom(ALL_STRUCTURES, ALL_IMAGES);
const idsOf = (paper: DiagnosticPaper) => (paper.kind === 'paper' ? paper.paper.questions.map((q) => q.id) : []);

/**
 * What an account holds in a build that fetches facts per area: every name
 * and picture, and the facts of the areas it has been served.
 */
function holdingOnly(...areas: Area[]): AnatomyContent {
  const held = ALL_STRUCTURES.filter((s) => areasOf(s).some((a) => areas.includes(a)));
  const content = anatomyContentFrom(held, ALL_IMAGES, ALL_STRUCTURES);
  const has = (a: Area) => areas.includes(a);
  return {
    ...content,
    facts: { ...content.facts, source: 'server', has, missing: (asked) => asked.filter((a) => !has(a)) },
  };
}

function setup(
  phase: 'baseline' | 'followUp' = 'baseline',
  paper: DiagnosticPaper = wholeBody,
  content: AnatomyContent = everything,
  sitterAreas: readonly Area[] = AREAS,
) {
  const repository = createMemoryRepository();
  const recordAttempt = vi.spyOn(repository, 'recordAttempt');
  const upsertMastery = vi.spyOn(repository, 'upsertMastery');
  const onDone = vi.fn();

  const view = render(
    <DiagnosticScreen
      repository={repository}
      userId="u1"
      cohortId="y2-physio-2026"
      phase={phase}
      content={content}
      paper={paper}
      sitterAreas={sitterAreas}
      onDone={onDone}
    />,
  );
  return { repository, recordAttempt, upsertMastery, onDone, unmount: view.unmount };
}

/** Answer every question and submit. Returns what was on the paper, in a fixed order. */
function completeSitting(count: number = DIAGNOSTIC_SIZE): string[] {
  const shown: string[] = [];
  for (let i = 0; i < count; i++) {
    const choices = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') !== null);
    shown.push(JSON.stringify({
      prompt: screen.getByRole('heading', { level: 2 }).textContent,
      picture: document.querySelector('img')?.getAttribute('src') ?? null,
      // In the order shown: the order of the four choices is part of the paper.
      choices: choices.map((c) => c.textContent),
    }));
    fireEvent.click(choices[0]);
    const last = i === count - 1;
    fireEvent.click(screen.getByRole('button', { name: last ? 'Review answers' : 'Next' }));
  }
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  // The order of the QUESTIONS is shuffled per sitting and is not part of the paper.
  return shown.sort();
}

describe('DiagnosticScreen', () => {
  it('opens on an intro that states what the sitting will not do', () => {
    setup();
    expect(screen.getByText('Before you start revising')).toBeTruthy();
    expect(screen.getByText(/never sees your score/)).toBeTruthy();
    expect(screen.getByText(/not be told what you got wrong/)).toBeTruthy();
  });

  // The card used to promise the course leader "sees whether the class as a
  // whole moved". No educator screen shows that. It says what happens.
  it('promises nothing about what a course leader will be shown', () => {
    setup();
    expect(screen.queryByText(/class as a whole moved/)).toBeNull();
    expect(screen.getByText(/may be shared with your course leader and may be used outside your course/)).toBeTruthy();
    // And where to read how: the section of the privacy policy about the test.
    expect(screen.getByRole('link', { name: 'How this is used' }).getAttribute('href')).toBe('/privacy#before-and-after-test');
  });

  it('says which paper it is', () => {
    const whole = setup('baseline', wholeBody, everything);
    expect(screen.getByText('Your questions are from across the whole body.')).toBeTruthy();
    whole.unmount();
    setup('baseline', kneePaper, holdingOnly('knee'), ['knee']);
    expect(screen.getByText('Your questions are about the knee.')).toBeTruthy();
  });

  it('lets a student decline without starting', () => {
    const { onDone } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(onDone).toHaveBeenCalled();
  });

  it('runs a full sitting over the real dataset and stores the result', async () => {
    const { repository } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Take the baseline' }));
    expect(screen.getByText(`Question 1 of ${DIAGNOSTIC_SIZE}`)).toBeTruthy();

    completeSitting();

    await waitFor(async () => {
      expect(await repository.listDiagnosticResults('u1')).toHaveLength(1);
    });
    const [stored] = await repository.listDiagnosticResults('u1');
    expect(stored.phase).toBe('baseline');
    expect(stored.total).toBe(DIAGNOSTIC_SIZE);
    expect(stored.cohortId).toBe('y2-physio-2026');
    // Recorded so a follow-up can replay exactly these.
    expect(stored.questionIds).toHaveLength(DIAGNOSTIC_SIZE);
  });

  it('records no attempt and touches no mastery, which is the whole promise', async () => {
    const { repository, recordAttempt, upsertMastery } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Take the baseline' }));
    completeSitting();

    await waitFor(async () => {
      expect(await repository.listDiagnosticResults('u1')).toHaveLength(1);
    });
    expect(recordAttempt).not.toHaveBeenCalled();
    expect(upsertMastery).not.toHaveBeenCalled();
    expect(await repository.listAttempts({ userId: 'u1' })).toEqual([]);
  });

  it('shows the score but never which answers were wrong', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Take the baseline' }));
    completeSitting();

    await screen.findByText('That is your starting point');
    expect(screen.getByText(/deliberately not showing you which ones/)).toBeTruthy();
    expect(screen.queryByText(/you got wrong:/i)).toBeNull();
  });

  it('stamps a whole-body baseline with the version, the paper and its questions', async () => {
    const { repository } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Take the baseline' }));
    completeSitting();
    await waitFor(async () => {
      expect(await repository.listDiagnosticResults('u1')).toHaveLength(1);
    });
    const [stored] = await repository.listDiagnosticResults('u1');
    expect(stored.version).toBe(DIAGNOSTIC_VERSION);
    expect(stored.paperId).toBe(WHOLE_BODY_PAPER);
    expect([...stored.questionIds!].sort()).toEqual(idsOf(wholeBody).sort());
  });

  it("stamps a free student's baseline with their area's paper", async () => {
    const { repository } = setup('baseline', kneePaper, holdingOnly('knee'), ['knee']);
    fireEvent.click(screen.getByRole('button', { name: 'Take the baseline' }));
    completeSitting();
    await waitFor(async () => {
      expect(await repository.listDiagnosticResults('u1')).toHaveLength(1);
    });
    const [stored] = await repository.listDiagnosticResults('u1');
    expect(stored.version).toBe(DIAGNOSTIC_VERSION);
    expect(stored.paperId).toBe('knee');
    expect([...stored.questionIds!].sort()).toEqual(idsOf(kneePaper).sort());
  });

  // Everyone sitting a paper gets the same prompts, the same pictures and the
  // same four choices in the same order, whatever build they are on.
  it('puts the same knee paper in front of a free student and a subscriber', () => {
    const free = setup('baseline', kneePaper, holdingOnly('knee'), ['knee']);
    fireEvent.click(screen.getByRole('button', { name: 'Take the baseline' }));
    const forFree = completeSitting();
    free.unmount();

    // The same paper, on a device that holds every area (a bundled build, or
    // a student who has since subscribed).
    setup('baseline', kneePaper, everything, AREAS);
    fireEvent.click(screen.getByRole('button', { name: 'Take the baseline' }));
    const forAll = completeSitting();

    expect(forFree).toHaveLength(DIAGNOSTIC_SIZE);
    expect(forFree.join('\n')).toBe(forAll.join('\n'));
    for (const q of forFree) expect(new Set(JSON.parse(q).choices).size).toBe(4);
  });

  it('asks the follow-up what the baseline asked', async () => {
    const followUpPaper = await resolveDiagnosticPaper(
      'followUp',
      { version: DIAGNOSTIC_VERSION, paperId: 'knee', questionIds: idsOf(kneePaper) },
      ['knee'],
    );
    const first = setup('baseline', kneePaper, holdingOnly('knee'), ['knee']);
    fireEvent.click(screen.getByRole('button', { name: 'Take the baseline' }));
    const before = completeSitting();
    first.unmount();

    const { repository } = setup('followUp', followUpPaper, holdingOnly('knee'), ['knee']);
    fireEvent.click(screen.getByRole('button', { name: 'Take the follow-up' }));
    const after = completeSitting();
    expect(after.join('\n')).toBe(before.join('\n'));

    await waitFor(async () => {
      expect(await repository.listDiagnosticResults('u1')).toHaveLength(1);
    });
    const [stored] = await repository.listDiagnosticResults('u1');
    expect(stored.version).toBe(DIAGNOSTIC_VERSION);
    expect(stored.paperId).toBe('knee');
  });

  // In a build that fetches facts, the content changes under a running app:
  // an area arrives, a lease is renewed. The sitting keeps answers by
  // position, so the paper must not be rebuilt or reshuffled when that happens.
  it('does not reshuffle the paper when the content changes mid-sitting', () => {
    const repository = createMemoryRepository();
    const props = { repository, userId: 'u1', cohortId: 'c1', phase: 'baseline' as const, paper: kneePaper, onDone: () => {} };
    const view = render(<DiagnosticScreen {...props} content={holdingOnly('knee')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Take the baseline' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const second = screen.getByRole('heading', { level: 2 }).textContent;
    const choices = () => screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') !== null).map((b) => b.textContent);
    const shown = choices();

    for (let i = 0; i < 6; i++) {
      // A new content object each time, as the hook hands over when an area lands.
      view.rerender(<DiagnosticScreen {...props} content={i % 2 ? holdingOnly('knee') : anatomyContentFrom([...ALL_STRUCTURES], ALL_IMAGES)} />);
      expect(screen.getByText(`Question 2 of ${DIAGNOSTIC_SIZE}`)).toBeTruthy();
      expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(second);
      expect(choices()).toEqual(shown);
    }
  });

  it('builds the paper when its facts arrive after the screen opened', () => {
    const repository = createMemoryRepository();
    const props = { repository, userId: 'u1', cohortId: 'c1', phase: 'baseline' as const, paper: kneePaper, sitterAreas: ['knee'] as Area[], onDone: () => {} };
    // Still loading: the knee is the account's, and not on the device yet.
    const view = render(<DiagnosticScreen {...props} content={holdingOnly()} />);
    expect(screen.queryByRole('button', { name: 'Take the baseline' })).toBeNull();
    expect(screen.getByText(/cannot be set up right now/)).toBeTruthy();
    view.rerender(<DiagnosticScreen {...props} content={holdingOnly('knee')} />);
    expect(screen.getByRole('button', { name: 'Take the baseline' })).toBeTruthy();
  });

  it('asks the follow-up in different words', () => {
    setup('followUp');
    expect(screen.getByText('The same fifteen questions, ten weeks on')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Take the follow-up' })).toBeTruthy();
    expect(screen.queryByText(/the number your course leader sees/)).toBeNull();
  });

  /**
   * A follow-up is the paper its baseline was. What the student holds today
   * decides only whether that paper can be BUILT on this device.
   */
  describe('a follow-up after the account changed between sittings', () => {
    const kneeFollowUp = () => resolveDiagnosticPaper(
      'followUp',
      { version: DIAGNOSTIC_VERSION, paperId: 'knee', questionIds: idsOf(kneePaper) },
      ['hip'],
    );
    const wholeFollowUp = () => resolveDiagnosticPaper(
      'followUp',
      { version: DIAGNOSTIC_VERSION, paperId: WHOLE_BODY_PAPER, questionIds: idsOf(wholeBody) },
      ['shoulder'],
    );

    // A free student who used their one change of free area: knee then, hip
    // now. A build that fetches facts has no knee facts to build from.
    it('a free student who changed their free area cannot be set the follow-up, and is told why', async () => {
      setup('followUp', await kneeFollowUp(), holdingOnly('hip'), ['hip']);
      expect(screen.queryByRole('button', { name: 'Take the follow-up' })).toBeNull();
      expect(screen.getByText(/cannot be set up on this account/)).toBeTruthy();
      expect(screen.getByText(/were about the knee, and this account does not have that area now/)).toBeTruthy();
    });

    it('…but can in a bundled build, where the facts are in hand, and it is still the knee paper', async () => {
      const { repository } = setup('followUp', await kneeFollowUp(), everything, ['hip']);
      fireEvent.click(screen.getByRole('button', { name: 'Take the follow-up' }));
      completeSitting();
      await waitFor(async () => {
        expect(await repository.listDiagnosticResults('u1')).toHaveLength(1);
      });
      expect((await repository.listDiagnosticResults('u1'))[0].paperId).toBe('knee');
    });

    it('a free student who has since subscribed still sits their area paper', async () => {
      const paper = await resolveDiagnosticPaper(
        'followUp',
        { version: DIAGNOSTIC_VERSION, paperId: 'knee', questionIds: idsOf(kneePaper) },
        AREAS,
      );
      const { repository } = setup('followUp', paper, holdingOnly(...AREAS), AREAS);
      expect(screen.getByText('Your questions are about the knee.')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Take the follow-up' }));
      completeSitting();
      await waitFor(async () => {
        expect(await repository.listDiagnosticResults('u1')).toHaveLength(1);
      });
      const [stored] = await repository.listDiagnosticResults('u1');
      expect(stored.paperId).toBe('knee');
      expect([...stored.questionIds!].sort()).toEqual(idsOf(kneePaper).sort());
    });

    it('a subscriber who lapsed to free cannot be set the whole-body follow-up where facts are fetched', async () => {
      setup('followUp', await wholeFollowUp(), holdingOnly('shoulder'), ['shoulder']);
      expect(screen.queryByRole('button', { name: 'Take the follow-up' })).toBeNull();
      expect(screen.getByText(/cannot be set up on this account/)).toBeTruthy();
      expect(screen.getByText(/drawn from every area, and this account does not have every area/)).toBeTruthy();
    });

    it('…and can in a bundled build', async () => {
      const { repository } = setup('followUp', await wholeFollowUp(), everything, ['shoulder']);
      fireEvent.click(screen.getByRole('button', { name: 'Take the follow-up' }));
      completeSitting();
      await waitFor(async () => {
        expect(await repository.listDiagnosticResults('u1')).toHaveLength(1);
      });
      expect((await repository.listDiagnosticResults('u1'))[0].paperId).toBe(WHOLE_BODY_PAPER);
    });

    it('a follow-up to a paper this build does not have asks nothing', () => {
      setup('followUp', { kind: 'unknown', version: 2 }, everything);
      expect(screen.queryByRole('button', { name: 'Take the follow-up' })).toBeNull();
      expect(screen.getByText(/cannot be set up right now/)).toBeTruthy();
    });
  });

  /**
   * The classes that were mid-diagnostic on the live site: a baseline drawn
   * for the class under version 1, on the device, from every area's facts.
   * Its follow-up is that paper again or nothing.
   */
  describe('a follow-up to a version-1 baseline from the live site', () => {
    const asked = [
      'mcq-vastus-intermedius-action',
      'mcq-internal-intercostals-insertion',
      'mcq-multifidus-nerve',
      'mcq-scalene-posterior-origin',
    ];
    const oldPaper: DiagnosticPaper = { kind: 'cohortDrawn', version: COHORT_DRAWN_VERSION, replayIds: asked };

    it('replays the questions that baseline recorded, and is stamped with ITS version so the two pair', async () => {
      const { repository } = setup('followUp', oldPaper, everything);
      fireEvent.click(screen.getByRole('button', { name: 'Take the follow-up' }));
      expect(screen.getByText(`Question 1 of ${asked.length}`)).toBeTruthy();
      for (let i = 0; i < asked.length; i++) {
        fireEvent.click(screen.getByRole('button', { name: i === asked.length - 1 ? 'Review answers' : 'Next' }));
      }
      fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
      await waitFor(async () => {
        expect(await repository.listDiagnosticResults('u1')).toHaveLength(1);
      });
      const [stored] = await repository.listDiagnosticResults('u1');
      expect(stored.version).toBe(COHORT_DRAWN_VERSION);
      // A version-1 paper has no name: the class had one.
      expect(stored.paperId).toBeUndefined();
      expect([...stored.questionIds!].sort()).toEqual([...asked].sort());
    });

    // A build that fetches facts per area, and an account that does not hold
    // them all. The paper cannot be rebuilt; a shorter or different one would
    // not pair. So it is not offered, and the screen says why.
    it('is not offered to an account that does not hold every area, and says so', () => {
      setup('followUp', oldPaper, holdingOnly('knee'), ['knee']);
      expect(screen.queryByRole('button', { name: 'Take the follow-up' })).toBeNull();
      expect(screen.getByText(/cannot be set up on this account/)).toBeTruthy();
      expect(screen.getByText(/does not have every area/)).toBeTruthy();
    });
  });
});
