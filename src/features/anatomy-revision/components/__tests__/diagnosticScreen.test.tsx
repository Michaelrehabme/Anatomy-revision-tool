import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DiagnosticScreen } from '../Diagnostic/DiagnosticScreen';
import { createMemoryRepository } from '../../data/memoryRepository';
import { ALL_STRUCTURES, ALL_IMAGES } from '../../data/seed';
import { COHORT_DRAWN_VERSION, DIAGNOSTIC_SIZE, DIAGNOSTIC_VERSION } from '../../lib/diagnostic';
import { resolveDiagnosticPaper, type DiagnosticPaper } from '../../lib/diagnosticSample';
import { anatomyContentFrom, type AnatomyContent } from '../../hooks/useAnatomyContent';
import { areasOf } from '../../types/structure';

/**
 * End to end over the real dataset: a cohort id in, a stored result out.
 *
 * The assertion that matters most is the negative one — that finishing a
 * sitting writes a diagnostic result and NOTHING else. An attempt recorded
 * here would reach the scheduler and the educator's weakness table, and the
 * sitting promises a student it does neither.
 */

/** The fixed paper, as the route resolves it for a baseline. */
const fixedPaper = await resolveDiagnosticPaper('baseline');
const everything = anatomyContentFrom(ALL_STRUCTURES, ALL_IMAGES);

/**
 * What a free account holds in a build that fetches facts per area: every
 * name and picture, and the facts of one area.
 */
function holdingOnly(area: 'knee'): AnatomyContent {
  const held = ALL_STRUCTURES.filter((s) => areasOf(s).includes(area));
  const content = anatomyContentFrom(held, ALL_IMAGES, ALL_STRUCTURES);
  const has = (a: string) => a === area;
  return {
    ...content,
    facts: { ...content.facts, source: 'server', has, missing: (areas) => areas.filter((a) => !has(a)) },
  };
}

function setup(
  phase: 'baseline' | 'followUp' = 'baseline',
  paper: DiagnosticPaper = fixedPaper,
  content: AnatomyContent = everything,
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
      onDone={onDone}
    />,
  );
  return { repository, recordAttempt, upsertMastery, onDone, unmount: view.unmount };
}

/** Answer every question and submit. Returns what was on the paper, in a fixed order. */
function completeSitting(): string[] {
  const shown: string[] = [];
  for (let i = 0; i < DIAGNOSTIC_SIZE; i++) {
    const choices = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') !== null);
    shown.push(JSON.stringify({
      prompt: screen.getByRole('heading', { level: 2 }).textContent,
      picture: document.querySelector('img')?.getAttribute('src') ?? null,
      choices: choices.map((c) => c.textContent).sort(),
    }));
    fireEvent.click(choices[0]);
    const last = i === DIAGNOSTIC_SIZE - 1;
    fireEvent.click(screen.getByRole('button', { name: last ? 'Review answers' : 'Next' }));
  }
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  // The order is shuffled per sitting and is not part of the paper.
  return shown.sort();
}

describe('DiagnosticScreen', () => {
  it('opens on an intro that states what the sitting will not do', () => {
    setup();
    expect(screen.getByText('Before you start revising')).toBeTruthy();
    expect(screen.getByText(/never sees your score/)).toBeTruthy();
    expect(screen.getByText(/not be told what you got wrong/)).toBeTruthy();
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

  it("stamps a baseline with the fixed paper's version", async () => {
    const { repository } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Take the baseline' }));
    completeSitting();
    await waitFor(async () => {
      expect(await repository.listDiagnosticResults('u1')).toHaveLength(1);
    });
    const [stored] = await repository.listDiagnosticResults('u1');
    expect(stored.version).toBe(DIAGNOSTIC_VERSION);
    expect([...stored.questionIds!].sort()).toEqual(
      (fixedPaper.kind === 'fixed' ? fixedPaper.questions : []).map((q) => q.id).sort(),
    );
  });

  // Owner's decision 7. A class sits one paper whatever each student has paid
  // for: the same prompts, the same pictures, the same four choices.
  it('puts the same paper in front of a student holding one area and one holding nine', () => {
    const one = setup('baseline', fixedPaper, holdingOnly('knee'));
    fireEvent.click(screen.getByRole('button', { name: 'Take the baseline' }));
    const paperForOne = completeSitting();
    one.unmount();

    setup('baseline', fixedPaper, everything);
    fireEvent.click(screen.getByRole('button', { name: 'Take the baseline' }));
    const paperForNine = completeSitting();

    expect(paperForOne).toHaveLength(DIAGNOSTIC_SIZE);
    expect(paperForOne.join('\n')).toBe(paperForNine.join('\n'));
    // Every question came with its four choices: nothing was waiting on facts.
    for (const q of paperForOne) expect(JSON.parse(q).choices).toHaveLength(4);
  });

  it('asks the follow-up what the baseline asked, for the student holding one area too', async () => {
    const followUpPaper = await resolveDiagnosticPaper('followUp', {
      version: DIAGNOSTIC_VERSION,
      questionIds: fixedPaper.kind === 'fixed' ? fixedPaper.questions.map((q) => q.id) : [],
    });
    const first = setup('baseline', fixedPaper, everything);
    fireEvent.click(screen.getByRole('button', { name: 'Take the baseline' }));
    const before = completeSitting();
    first.unmount();

    const { repository } = setup('followUp', followUpPaper, holdingOnly('knee'));
    fireEvent.click(screen.getByRole('button', { name: 'Take the follow-up' }));
    const after = completeSitting();
    expect(after.join('\n')).toBe(before.join('\n'));

    await waitFor(async () => {
      expect(await repository.listDiagnosticResults('u1')).toHaveLength(1);
    });
    expect((await repository.listDiagnosticResults('u1'))[0].version).toBe(DIAGNOSTIC_VERSION);
  });

  // In a build that fetches facts, the content changes under a running app:
  // an area arrives, a lease is renewed. The sitting keeps answers by
  // position, so the paper must not be reshuffled when that happens.
  it('does not reshuffle the paper when the content changes mid-sitting', () => {
    const repository = createMemoryRepository();
    const props = { repository, userId: 'u1', cohortId: 'c1', phase: 'baseline' as const, paper: fixedPaper, onDone: () => {} };
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

  it('asks the follow-up in different words', () => {
    setup('followUp');
    expect(screen.getByText('The same fifteen questions, ten weeks on')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Take the follow-up' })).toBeTruthy();
  });

  /**
   * The classes that were mid-diagnostic when the fixed paper arrived: a
   * baseline drawn for the class under version 1, on the device, from every
   * area's facts. Its follow-up is that paper again or nothing.
   */
  describe('a follow-up to a baseline sat before the fixed paper', () => {
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
      expect([...stored.questionIds!].sort()).toEqual([...asked].sort());
    });

    // A build that fetches facts per area, and an account that does not hold
    // them all. The paper cannot be rebuilt; a shorter or different one would
    // not pair. So it is not offered, and the screen says why.
    it('is not offered to an account that does not hold every area, and says so', () => {
      setup('followUp', oldPaper, holdingOnly('knee'));
      expect(screen.queryByRole('button', { name: 'Take the follow-up' })).toBeNull();
      expect(screen.getByText(/cannot be set up on this account/)).toBeTruthy();
      expect(screen.getByText(/does not have every area/)).toBeTruthy();
    });
  });
});
