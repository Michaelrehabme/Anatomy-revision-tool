import { AREA_LABELS, type Area } from '../../types/region';
import type { AreaFactsStatus } from '../../data/content/contentSource';
import type { ContentFacts } from '../../hooks/useAnatomyContent';

/**
 * What the app says when an area the account MAY have is not on the device
 * (docs/DESIGN-CONTENT-BEHIND-SERVER.md, step 6).
 *
 * In a build that fetches facts per area this happens in ordinary life: a
 * student opens the app underground having never opened the knee on this
 * phone, or comes back after three weeks abroad to a saved copy whose lease
 * has run out. The pictures are there — they are public and cached — and the
 * facts are not.
 *
 * IT SAYS WHICH, AND WHY, AND WHAT TO DO. The alternative is what every
 * screen would do on its own: quietly list fewer structures, build a shorter
 * session, show an atlas with a region missing — and leave the student to
 * work out that something is absent rather than that they have finished it.
 * A missing area must never look like an empty one.
 *
 * NOT ABOUT LOCKED AREAS. An area the account may not reach has its own
 * panel (AreaLock.tsx) and is not mentioned here.
 *
 * Never shown in a bundled build, where every area is always in hand.
 */

const list = (areas: readonly Area[]) => {
  const names = areas.map((a) => AREA_LABELS[a]);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

/** The sentences for one reason, for the areas it applies to. Exported so each can be tested as text. */
export function areaFactsMessage(status: Exclude<AreaFactsStatus, 'loaded'>, areas: readonly Area[]): string {
  const these = list(areas);
  const plural = areas.length > 1;
  switch (status) {
    case 'loading':
      return `Loading ${these}…`;
    case 'offline':
      return (
        `${these} ${plural ? 'are' : 'is'} not on this device, and there is no connection to fetch ${plural ? 'them' : 'it'}. ` +
        `Connect to the internet to load ${plural ? 'these areas' : 'this area'}. ` +
        `If you had ${plural ? 'them' : 'it'} here before, the saved copy has run out and has to be checked against your account.`
      );
    case 'error':
      return `${these} could not be loaded just now. Your account and your progress are untouched; try again in a moment.`;
    case 'denied':
      return (
        `${these} could not be opened for this account. If you have just subscribed or joined a class, give it a minute and try again; ` +
        'otherwise your Account screen says what your account opens.'
      );
    case 'absent':
      return `${these} ${plural ? 'are' : 'is'} not part of this demo. The full app has every area.`;
  }
}

const ORDER: Exclude<AreaFactsStatus, 'loaded'>[] = ['offline', 'error', 'denied', 'absent', 'loading'];

/** Which of an account's areas are not in hand, grouped by why. */
export function missingByReason(
  facts: ContentFacts,
  entitled: readonly Area[],
): { status: Exclude<AreaFactsStatus, 'loaded'>; areas: Area[] }[] {
  const missing = facts.missing(entitled);
  return ORDER.map((status) => ({ status, areas: missing.filter((a) => facts.status[a] === status) })).filter(
    (group) => group.areas.length > 0,
  );
}

interface AreaFactsNoticeProps {
  facts: ContentFacts;
  /** Every area the account may reach. */
  entitled: readonly Area[];
  className?: string;
}

/**
 * The banner. One block, one paragraph per reason, and a single "Try again"
 * when trying again could change anything.
 */
export function AreaFactsNotice({ facts, entitled, className = '' }: AreaFactsNoticeProps) {
  if (facts.source === 'bundled') return null;
  const groups = missingByReason(facts, entitled);
  if (groups.length === 0) return null;

  const onlyLoading = groups.every((g) => g.status === 'loading');
  const canRetry = groups.some((g) => g.status === 'offline' || g.status === 'error' || g.status === 'denied');

  return (
    <div
      role="status"
      data-testid="area-facts-notice"
      className={`mx-auto w-full px-4 py-3 ${className}`}
      style={{
        background: 'var(--sf)',
        borderBottom: '1.2px solid var(--line-strong)',
        borderLeft: `4px solid ${onlyLoading ? 'var(--line-strong)' : 'var(--acc2d)'}`,
      }}
    >
      <div className="mx-auto flex max-w-[980px] flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1" style={{ flexBasis: 260 }}>
          {groups.map((group) => (
            <p
              key={group.status}
              data-reason={group.status}
              style={{ font: '400 14px/1.5 var(--font-ui)', color: 'var(--ink2)', margin: 0 }}
            >
              {areaFactsMessage(group.status, group.areas)}
            </p>
          ))}
        </div>
        {canRetry && (
          <button
            type="button"
            onClick={facts.retry}
            className="shrink-0 rounded-[3px] px-4"
            style={{ minHeight: 44, font: '500 14px/1 var(--font-ui)', background: 'var(--accs)', color: 'var(--accd)' }}
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The same thing for ONE structure's card: its name and picture are drawn,
 * and where its facts would be, this. For a structure the account may reach
 * whose area is not in hand.
 */
export function StructureFactsUnavailable({ area, facts }: { area: Area; facts: ContentFacts }) {
  const status = facts.status[area];
  if (status === 'loaded') return null;
  return (
    <div data-testid="structure-facts-unavailable" role="status">
      <p style={{ font: '400 15px/1.6 var(--font-ui)', color: 'var(--ink2)' }}>{areaFactsMessage(status, [area])}</p>
      {status !== 'loading' && status !== 'absent' && (
        <button
          type="button"
          onClick={facts.retry}
          className="mt-3 rounded-[3px] px-4"
          style={{ minHeight: 44, font: '500 14px/1 var(--font-ui)', background: 'var(--accs)', color: 'var(--accd)' }}
        >
          Try again
        </button>
      )}
    </div>
  );
}
