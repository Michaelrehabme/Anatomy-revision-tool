import { FUNNEL_STEPS, type FunnelEvent, type FunnelStep } from '../../feedback/data/telemetry';

export interface FunnelRow {
  step: FunnelStep;
  label: string;
  /** Accounts that reached this step in the period. */
  people: number;
  /**
   * As a share of the step before it, 0–100. Null for the first step, when
   * nobody reached the one before, and when MORE people reached this one: a
   * step can be reached without the one above it (the account form from a
   * link that skips the home page, the prices from an email), and "300%" of
   * the previous step says nothing true about either.
   */
  ofPrevious: number | null;
}

/**
 * The funnel table, from the period's events.
 *
 * Each event is already one account reaching one step (the rules allow no
 * second), so a count of events is a count of people. `source` narrows it to
 * the accounts that ARRIVED from that source. A later step carries the same
 * source only if it happened on the same visit, so people are matched by uid
 * from their first tagged event, not by the field on each event.
 */
export function funnelRows(events: readonly FunnelEvent[], source: string | null = null): FunnelRow[] {
  const arrivedFrom = arrivalSources(events);
  const counted = source === null ? events : events.filter((e) => arrivedFrom.get(e.userId) === source);
  const people = new Map<FunnelStep, number>();
  for (const event of counted) people.set(event.step, (people.get(event.step) ?? 0) + 1);

  return FUNNEL_STEPS.map((step, index) => {
    const here = people.get(step.id) ?? 0;
    // An optional step is measured against the one above it; a step of the
    // main run against the last main step, skipping the side road.
    const optional = 'optional' in step;
    const previous = FUNNEL_STEPS.slice(0, index).reverse().find((s) => optional || !('optional' in s));
    const before = previous ? (people.get(previous.id) ?? 0) : 0;
    return {
      step: step.id,
      label: step.label,
      people: here,
      ofPrevious: index === 0 || before === 0 || here > before ? null : Math.round((here / before) * 100),
    };
  });
}

/** Where each account first arrived from: the source on its earliest event that has one. */
function arrivalSources(events: readonly FunnelEvent[]): Map<string, string> {
  const earliest = new Map<string, FunnelEvent>();
  for (const event of events) {
    if (!event.source) continue;
    const seen = earliest.get(event.userId);
    if (!seen || event.createdAt < seen.createdAt) earliest.set(event.userId, event);
  }
  return new Map([...earliest].map(([uid, event]) => [uid, event.source]));
}

/** Every source seen in the period, with how many accounts arrived from it, busiest first. */
export function funnelSources(events: readonly FunnelEvent[]): { source: string; people: number }[] {
  const counts = new Map<string, number>();
  for (const source of arrivalSources(events).values()) counts.set(source, (counts.get(source) ?? 0) + 1);
  return [...counts].map(([source, people]) => ({ source, people })).sort((a, b) => b.people - a.people);
}
