import { getRepository as realGetRepository } from '../../anatomy-revision/data/repository.ts';
import { demoAttempts, demoSessionSummaries, DEMO_ACCOUNT_PERSONA } from './demoData';
import type { AnatomyRepository, AttemptFilter } from '../../anatomy-revision/data/repository.ts';
import type { StructureMastery, UserAttempt } from '../../anatomy-revision/types/attempt';

/**
 * Demo-mode stand-in for data/repository (README "Educator demo mode").
 *
 * Everything is the real local repository except one person's history: the
 * signed-in demo user borrows a generated student's attempts, so the account
 * screen's accuracy chart and progress figures have something in them. An
 * empty local repository would show only the "not enough attempts yet" state,
 * which is a poor way to review a chart.
 *
 * Reads are borrowed, writes are real — answering questions in demo mode
 * appends to local storage as usual, and those attempts show up alongside the
 * generated ones.
 *
 * The .ts extension on the import above is deliberate: the alias in
 * vite.config.ts matches the extensionless specifier, so this is how the
 * module reaches the real repository rather than itself.
 */

function matches(attempt: UserAttempt, filter: AttemptFilter): boolean {
  if (filter.structureId && attempt.structureId !== filter.structureId) return false;
  if (filter.questionId && attempt.questionId !== filter.questionId) return false;
  if (filter.since && attempt.timestamp < filter.since) return false;
  return true;
}

/** Mastery derived from the borrowed attempts, so "structures seen" and the region bars agree with the chart above them. */
function borrowedMastery(userId: string): StructureMastery[] {
  const byStructure = new Map<string, StructureMastery>();

  for (const attempt of demoAttempts(DEMO_ACCOUNT_PERSONA)) {
    const row = byStructure.get(attempt.structureId) ?? {
      structureId: attempt.structureId,
      userId,
      attemptsTotal: 0,
      attemptsCorrect: 0,
      lastAttemptAt: attempt.timestamp,
    };
    row.attemptsTotal += 1;
    if (attempt.correct) row.attemptsCorrect += 1;
    if (attempt.timestamp > row.lastAttemptAt) row.lastAttemptAt = attempt.timestamp;
    byStructure.set(attempt.structureId, row);
  }

  return [...byStructure.values()];
}

export async function getRepository(): Promise<AnatomyRepository> {
  const real = await realGetRepository();

  return {
    ...real,
    async listAttempts(filter: AttemptFilter) {
      const own = await real.listAttempts(filter);
      const borrowed = demoAttempts(DEMO_ACCOUNT_PERSONA)
        .filter((a) => matches(a, filter))
        .map((a) => ({ ...a, userId: filter.userId ?? a.userId }));
      const all = [...own, ...borrowed].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return filter.limit ? all.slice(0, filter.limit) : all;
    },
    async getMastery(userId: string) {
      return [...(await real.getMastery(userId)), ...borrowedMastery(userId)];
    },
    async listMastery(userId: string) {
      return [...(await real.listMastery(userId)), ...borrowedMastery(userId)];
    },
    async listSessionSummaries(userId: string, limit?: number) {
      const own = await real.listSessionSummaries(userId, limit);
      const borrowed = demoSessionSummaries(DEMO_ACCOUNT_PERSONA).map((s) => ({ ...s, userId }));
      return [...own, ...borrowed].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, limit ?? 20);
    },
  };
}

export type { AnatomyRepository } from '../../anatomy-revision/data/repository.ts';
export { INITIAL_GAMIFICATION_PROFILE } from '../../anatomy-revision/data/repository.ts';
