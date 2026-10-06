/**
 * The reading half of the built-file check (src/scripts/checkBundleForFacts.ts):
 * given the text of every built file, which of them carry a structure's facts
 * that they should not.
 *
 * Apart from the script so it can be tested without a build
 * (__tests__/bundleFacts.test.ts) — above all the one thing that must not
 * rot: that the diagnostic's public paper is let through and nothing else is.
 */

/** One structure's tell-tale: its description, in each spelling a built file may hold it in. */
export interface Canary {
  id: string;
  texts: string[];
}

export interface BuiltFile {
  path: string;
  text: string;
}

/**
 * THE ONE EXCEPTION: the diagnostic's fixed paper
 * (features/anatomy-revision/lib/diagnosticSample.ts).
 *
 * That paper ships in every build on purpose, and three of its questions ask
 * a muscle's action — whose answer, and whose wrong answers, are other
 * muscles' action sentences, which in this dataset are their descriptions.
 * So a handful of the canaries below are, legitimately, in a server build.
 *
 * The allowance is as narrow as that fact: a sentence the paper prints may
 * appear ONLY in a built file that carries the paper (found by the marker the
 * paper's file holds), and only AS MANY TIMES as the paper prints it. The
 * same sentence in any other file, or once more in that one, is a leak like
 * any other: it is how the seed arriving beside the paper would look. Every
 * other structure's description is looked for exactly as before.
 */
export interface PublishedPaper {
  /** A string the paper's file holds and nothing else does. */
  marker: string;
  /** Every choice the paper prints, repeats included. */
  choices: string[];
}

function occurrences(text: string, needle: string): number {
  let count = 0;
  for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + needle.length)) count += 1;
  return count;
}

/** Built file -> the structures whose facts it holds and may not. Empty when the build is clean. */
export function findLeaks(
  files: Iterable<BuiltFile>,
  canaries: readonly Canary[],
  papers: readonly PublishedPaper[] = [],
): Map<string, string[]> {
  const leaks = new Map<string, string[]>();
  for (const file of files) {
    const carried = papers.filter((p) => file.text.includes(p.marker));
    const found: string[] = [];
    for (const canary of canaries) {
      // The spellings are alternatives for one sentence, and are often the
      // same string: the count is the most any one of them is seen.
      const seen = Math.max(0, ...[...new Set(canary.texts)].map((t) => occurrences(file.text, t)));
      if (seen === 0) continue;
      const allowed = carried.reduce(
        (sum, paper) => sum + paper.choices.filter((choice) => canary.texts.includes(choice)).length,
        0,
      );
      if (seen > allowed) found.push(canary.id);
    }
    if (found.length) leaks.set(file.path, found);
  }
  return leaks;
}

/** The canaries of these structures, minus any too short to be a tell-tale. */
export function descriptionCanaries(
  structures: readonly { id: string; description: string }[],
  minLength: number,
): Canary[] {
  return structures
    .filter((s) => s.description.length >= minLength)
    // As they appear inside a JavaScript or JSON string: with their quotes escaped.
    .map((s) => ({ id: s.id, texts: [s.description, JSON.stringify(s.description).slice(1, -1)] }));
}
