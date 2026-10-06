import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { AUTHORED_STRUCTURES } from '../../../features/anatomy-revision/data/seed';
import { descriptionCanaries, findLeaks } from '../bundleFacts';

/**
 * The built-file check, against files made up here rather than a build.
 *
 * It allows NOTHING. For one evening it let a public diagnostic paper
 * through, because that paper printed some structures' descriptions as its
 * choices. That paper never shipped; the diagnostic's papers now hold no
 * sentence at all, and this holds the check — and the papers — to that.
 */

const canaries = descriptionCanaries(AUTHORED_STRUCTURES, 40);
const cleanChunk = 'const a="Which structure is highlighted?";export{a};';
const DIAGNOSTIC_DIR = 'src/features/anatomy-revision/data/diagnostic';

describe('the built-file check', () => {
  it('has something to look for: nearly every structure has a description long enough to be a tell-tale', () => {
    expect(canaries.length).toBeGreaterThan(400);
  });

  it('passes a build that carries no facts', () => {
    expect([...findLeaks([{ path: 'assets/index.js', text: cleanChunk }], canaries)]).toEqual([]);
  });

  it("fails when a structure's facts are in any file, and names the file and the structure", () => {
    const stray = canaries[0];
    const leaks = findLeaks(
      [
        { path: 'assets/index.js', text: cleanChunk },
        { path: 'assets/EducatorApp.js', text: `${cleanChunk}const s={description:${JSON.stringify(stray.texts[0])}};` },
      ],
      canaries,
    );
    expect([...leaks]).toEqual([['assets/EducatorApp.js', [stray.id]]]);
  });

  it('finds a description however its quotes were written out', () => {
    const quoted = canaries.find((c) => c.texts[0] !== c.texts[1]);
    // Only meaningful if some description has a quote in it to escape.
    if (!quoted) return;
    for (const text of quoted.texts) {
      expect(findLeaks([{ path: 'a.js', text: `x="${text}"` }], canaries).get('a.js')).toContain(quoted.id);
    }
  });

  it('takes no list of exceptions', () => {
    // The allowance for a public paper was a third argument. There is none.
    expect(findLeaks.length).toBe(2);
  });
});

describe('the diagnostic papers, which are in every build', () => {
  const files = readdirSync(DIAGNOSTIC_DIR);

  it('are the only files there, with their lock, and no public paper of finished questions is left', () => {
    expect(files.sort()).toEqual(['papers.v3.json', 'papers.v3.lock.json']);
  });

  it('would pass the check as built files: none carries a description', () => {
    // A bundler emits a JSON module as its text inside a script. The lock is
    // not imported by the app, but is held to the same standard.
    const built = files.map((name) => ({
      path: `assets/${name}.js`,
      text: `const e=${readFileSync(`${DIAGNOSTIC_DIR}/${name}`, 'utf8')};export{e as default};`,
    }));
    expect([...findLeaks(built, canaries)]).toEqual([]);
  });
});
