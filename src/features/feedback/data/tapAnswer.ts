/**
 * Where a student tapped on a locate question, written into a report's `given`
 * so the Feedback page can put the tap back on the picture (owner, 8 Nov 2026:
 * "include the screen that was shown"). A locate report used to say nothing
 * about the answer, so "my answer should have counted" on the anatomical neck
 * could not be checked.
 *
 * Plain words a person can read on their own, in a shape the page can parse:
 * "Tapped 51.2% across, 63.4% down on /anatomy/landmarks/x.webp". The picture
 * is named because a rotation set may have been turned to another frame than
 * the one the question opened on. It rides in `given`, which the deployed
 * rules already allow, so no rules change is needed for it.
 */
export function describeTap(point: readonly [number, number], picture: string): string {
  const pct = (n: number) => `${(Math.min(1, Math.max(0, n)) * 100).toFixed(1)}%`;
  return `Tapped ${pct(point[0])} across, ${pct(point[1])} down${picture ? ` on ${picture}` : ''}`;
}

const TAP = /^Tapped (\d+(?:\.\d+)?)% across, (\d+(?:\.\d+)?)% down(?: on (\S+))?$/;

/** The tap a `given` describes, or null when it is not a tap. */
export function parseTap(given: string | undefined): { x: number; y: number; picture?: string } | null {
  const match = given?.match(TAP);
  if (!match) return null;
  return { x: Number(match[1]) / 100, y: Number(match[2]) / 100, ...(match[3] ? { picture: match[3] } : {}) };
}
