import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AUTHORED_STRUCTURES } from '../../../features/anatomy-revision/data/seed';
import type { FixedSampleFile } from '../../../features/anatomy-revision/lib/diagnosticSample';
import { descriptionCanaries, findLeaks, type PublishedPaper } from '../bundleFacts';

/**
 * The built-file check, against files made up here rather than a build.
 *
 * The diagnostic's fixed paper is in every build on purpose, and some of its
 * choices are structures' descriptions — the very sentences the check looks
 * for. What matters is that letting the paper through lets NOTHING else
 * through: the real paper and the real seed are used, so this is the check
 * `npm run build` runs, minus the reading of dist/.
 */

const paperFile = JSON.parse(
  readFileSync('src/features/anatomy-revision/data/diagnostic/fixedSample.v2.json', 'utf8'),
) as FixedSampleFile;
const paper: PublishedPaper = {
  marker: paperFile.sample,
  choices: paperFile.questions.flatMap((q) => q.question.choices),
};
const canaries = descriptionCanaries(AUTHORED_STRUCTURES, 40);

/** The paper as a bundler emits a JSON module: its text, inside a script. */
const paperChunk = `const e=${JSON.stringify(paperFile)};export{e as default};`;
const cleanChunk = 'const a="Which structure is highlighted?";export{a};';

const inPaper = canaries.filter((c) => paper.choices.some((choice) => c.texts.includes(choice)));
const notInPaper = canaries.filter((c) => !inPaper.includes(c));

describe('the built-file check and the diagnostic paper', () => {
  it('has something to allow: the paper prints some structures\' descriptions', () => {
    // If this ever becomes zero the allowance is dead code and can go.
    expect(inPaper.length).toBeGreaterThan(0);
    expect(inPaper.length).toBeLessThan(15);
    expect(inPaper.map((c) => c.id)).toContain('popliteus');
  });

  it('passes a build that carries the paper and nothing else', () => {
    const leaks = findLeaks(
      [{ path: 'assets/index.js', text: cleanChunk }, { path: 'assets/fixedSample.v2.js', text: paperChunk }],
      canaries,
      [paper],
    );
    expect([...leaks]).toEqual([]);
  });

  it('fails that same build if nobody told it about the paper', () => {
    const leaks = findLeaks([{ path: 'assets/fixedSample.v2.js', text: paperChunk }], canaries, []);
    expect(leaks.get('assets/fixedSample.v2.js')?.sort()).toEqual(inPaper.map((c) => c.id).sort());
  });

  it('still fails when another structure\'s facts are in any file', () => {
    const stray = notInPaper[0];
    const leaks = findLeaks(
      [
        { path: 'assets/index.js', text: `${cleanChunk}const s={description:${JSON.stringify(stray.texts[0])}};` },
        { path: 'assets/fixedSample.v2.js', text: paperChunk },
      ],
      canaries,
      [paper],
    );
    expect([...leaks]).toEqual([['assets/index.js', [stray.id]]]);
  });

  it('still fails when another structure\'s facts are in the paper\'s own file', () => {
    const stray = notInPaper[1];
    const leaks = findLeaks(
      [{ path: 'assets/fixedSample.v2.js', text: `${paperChunk}const s=${JSON.stringify(stray.texts[0])};` }],
      canaries,
      [paper],
    );
    expect([...leaks]).toEqual([['assets/fixedSample.v2.js', [stray.id]]]);
  });

  it('fails when a sentence the paper prints turns up in a file that is not the paper', () => {
    const printed = inPaper[0];
    const leaks = findLeaks(
      [
        { path: 'assets/index.js', text: `const s=${JSON.stringify(printed.texts[0])};` },
        { path: 'assets/fixedSample.v2.js', text: paperChunk },
      ],
      canaries,
      [paper],
    );
    expect([...leaks]).toEqual([['assets/index.js', [printed.id]]]);
  });

  it('fails when a sentence the paper prints is in the paper\'s file more often than the paper prints it', () => {
    const printed = inPaper[0];
    const leaks = findLeaks(
      [{ path: 'assets/fixedSample.v2.js', text: `${paperChunk}const s=${JSON.stringify(printed.texts[0])};` }],
      canaries,
      [paper],
    );
    expect([...leaks]).toEqual([['assets/fixedSample.v2.js', [printed.id]]]);
  });

  // The whole seed arriving in the bundle — the thing the check exists for —
  // whether beside the paper or in the same file as it.
  it('fails for every structure when the seed is in the build, the paper\'s own included', () => {
    const seed = `const S=${JSON.stringify(AUTHORED_STRUCTURES)};`;
    const apart = findLeaks(
      [{ path: 'assets/index.js', text: seed }, { path: 'assets/fixedSample.v2.js', text: paperChunk }],
      canaries,
      [paper],
    );
    expect(apart.get('assets/index.js')).toHaveLength(canaries.length);
    expect(apart.has('assets/fixedSample.v2.js')).toBe(false);

    const together = findLeaks([{ path: 'assets/index.js', text: seed + paperChunk }], canaries, [paper]);
    expect(together.get('assets/index.js')).toHaveLength(canaries.length);
  });
});
