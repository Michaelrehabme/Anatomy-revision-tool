/**
 * The reading half of the built-file check (src/scripts/checkBundleForFacts.ts):
 * given the text of every built file, which of them carry a structure's facts
 * that they should not.
 *
 * Apart from the script so it can be tested without a build
 * (__tests__/bundleFacts.test.ts).
 *
 * THERE IS NO EXCEPTION. For one evening there was: a diagnostic paper of
 * finished questions that shipped in every build, some of whose choices were
 * structures' descriptions, and this check was taught to let that file
 * through. That paper never shipped. The diagnostic's papers now hold no
 * sentence at all — they name structures and are built from the facts the
 * sitter holds (features/anatomy-revision/lib/diagnosticPapers.ts) — so a
 * build that should carry no facts carries none, and anything found is a leak.
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

/** Built file -> the structures whose facts it holds and may not. Empty when the build is clean. */
export function findLeaks(files: Iterable<BuiltFile>, canaries: readonly Canary[]): Map<string, string[]> {
  const leaks = new Map<string, string[]>();
  for (const file of files) {
    const found = canaries.filter((c) => c.texts.some((t) => file.text.includes(t))).map((c) => c.id);
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
