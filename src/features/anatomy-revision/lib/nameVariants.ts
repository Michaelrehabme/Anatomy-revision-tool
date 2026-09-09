/**
 * Alternative spellings of an anatomical name that a student may reasonably
 * type instead of the authored one.
 *
 * FIBULAR AND PERONEAL ARE THE SAME WORD. Terminologia Anatomica renamed the
 * peroneal group to fibular, and UK MSK teaching still uses both — often in
 * the same lecture. This dataset authors muscles as "Peroneus Longus" and
 * nerves as "Superficial fibular nerve", so a student who learned one
 * convention was marked wrong for the half of the content authored in the
 * other. It affects three muscles and nine muscles' nerve answers.
 *
 * The swap is applied to accepted answers, never to what is displayed, so
 * the app keeps teaching one consistent name and only grading is generous.
 */

const SWAP: Record<string, string> = {
  fibularis: 'peroneus',
  peroneus: 'fibularis',
  fibular: 'peroneal',
  peroneal: 'fibular',
};

/**
 * Alternation is ordered longest-first so "fibularis" is matched whole:
 * rewriting it through the shorter "fibular" rule would produce
 * "peronealis", which is not a word in either convention.
 */
const SWAP_PATTERN = /\b(fibularis|peroneus|fibular|peroneal)\b/gi;

/** Preserves the capitalisation of the word being replaced, so "Fibular" swaps to "Peroneal". */
function matchCase(replacement: string, original: string): string {
  if (original === original.toUpperCase()) return replacement.toUpperCase();
  if (original[0] === original[0]?.toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/** The same name in the other convention, or null when it contains neither word. */
export function swapFibularPeroneal(value: string): string | null {
  if (!SWAP_PATTERN.test(value)) {
    SWAP_PATTERN.lastIndex = 0;
    return null;
  }
  SWAP_PATTERN.lastIndex = 0;
  return value.replace(SWAP_PATTERN, (m) => matchCase(SWAP[m.toLowerCase()], m));
}

/**
 * Every form of a structure's name that should grade as correct.
 *
 * Beyond the fibular/peroneal swap this drops a trailing "muscle", because
 * the aliases are authored in the Z-Anatomy style ("Fibularis longus
 * muscle") and typed grading tolerates only a single character of
 * difference — so "fibularis longus", which is what a student actually
 * writes, failed against an alias that exists precisely to accept it.
 */
export function structureNameVariants(name: string, aliases: readonly string[]): string[] {
  const out = new Set<string>();

  const add = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    out.add(trimmed);
    const bare = trimmed.replace(/\s+muscles?$/i, '').trim();
    if (bare) out.add(bare);
  };

  for (const value of [name, ...aliases]) {
    add(value);
    const swapped = swapFibularPeroneal(value);
    if (swapped) add(swapped);
  }

  return [...out];
}
