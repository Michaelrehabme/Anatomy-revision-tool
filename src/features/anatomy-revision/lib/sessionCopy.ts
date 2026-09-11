import type { Area } from '../types/region';
import { AREA_LABELS } from '../types/region';

/** Seconds-per-question the setup screens have always assumed (0.45 min). Shared so Today and Setup agree. */
export const MINUTES_PER_QUESTION = 0.45;

export function minutesFor(questionCount: number): number {
  return Math.max(1, Math.round(questionCount * MINUTES_PER_QUESTION));
}

/**
 * The headline for a first visit: an invitation naming what they chose, in
 * place of "0 due for review". One area is named; several are "your areas";
 * none (Skip) is simply a short session.
 */
export function firstRunTitle(areas: readonly Area[]): string {
  if (areas.length === 1) return `Start with the ${AREA_LABELS[areas[0]].toLowerCase()}`;
  if (areas.length > 1) return 'Start with your areas';
  return 'Start with a short session';
}
