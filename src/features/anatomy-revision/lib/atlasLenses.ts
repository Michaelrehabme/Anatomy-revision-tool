import { isMuscle, MUSCLE_GROUP_LABELS, type AnatomyStructure } from '../types/structure';

/**
 * Study by system, not only by region (owner, 19 Oct 2026): the muscles in a
 * group, the muscles behind a movement, the muscles one nerve supplies. Atlas
 * filters, not a mode: "Quiz these" already turns any filtered list into a
 * session, so a lens needs no screen of its own.
 *
 * Muscles only — bones, landmarks, joints and ligaments have no group, action
 * or nerve — so a lens in use narrows the list to muscles.
 */

export type LensKind = 'group' | 'movement' | 'nerve';

export const LENS_LABELS: Record<LensKind, string> = {
  group: 'Group',
  movement: 'Movement',
  nerve: 'Nerve',
};

export interface LensOption {
  value: string;
  label: string;
  count: number;
}

/** "hip-external-rotation" → "Hip external rotation". */
export function movementLabel(action: string): string {
  const words = action.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * One nerve however it is written. The muscle data says "Tibial nerve (long
 * head)" for the part of a muscle a nerve supplies and "Deep fibular
 * (peroneal) nerve" for an older name, and as a filter both mean the nerve:
 * the bracket goes. A bare root ("L1", "C3–C4") is a level, not a nerve
 * anyone filters by, and is left out (null).
 */
export function nerveKey(name: string): string | null {
  const key = name.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  if (!key || /^[CTLS]\d/.test(key)) return null;
  return key;
}

function valuesOf(s: AnatomyStructure, kind: LensKind): string[] {
  if (!isMuscle(s)) return [];
  switch (kind) {
    case 'group':
      return s.groups ?? [];
    case 'movement':
      return s.actions;
    case 'nerve':
      return [...new Set(s.nerve.map((n) => nerveKey(n.name)).filter((k): k is string => !!k))];
  }
}

export function matchesLens(s: AnatomyStructure, kind: LensKind, value: string): boolean {
  return valuesOf(s, kind).includes(value);
}

/** The choices for one lens over what the student may reach, most muscles first, then A–Z. */
export function lensOptions(structures: readonly AnatomyStructure[], kind: LensKind): LensOption[] {
  const counts = new Map<string, number>();
  for (const s of structures) for (const v of valuesOf(s, kind)) counts.set(v, (counts.get(v) ?? 0) + 1);
  const label = (v: string) => (kind === 'group' ? MUSCLE_GROUP_LABELS[v] ?? movementLabel(v) : kind === 'movement' ? movementLabel(v) : v);
  return [...counts]
    .map(([value, count]) => ({ value, label: label(value), count }))
    .sort((a, b) => a.label.localeCompare(b.label, 'en'));
}
