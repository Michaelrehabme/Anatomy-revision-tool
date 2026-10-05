import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AreaLoad, AreaLoadRequest, BundledContent } from '../../data/content/contentSource';
import type { Area } from '../../types/region';

/**
 * The app in a build that fetches facts per area, with only SOME areas in
 * hand (docs/DESIGN-CONTENT-BEHIND-SERVER.md, step 6).
 *
 * `bundledContent` is replaced by what a server build carries — the real
 * generated index and vocabulary, no facts — and a loader that answers from
 * the real area payloads as this test tells it to. Then the hook, the notice,
 * the generators and the screens most likely to go wrong are run over it: a
 * free account with one area, an account offline with nothing saved, an
 * account that has just paid.
 */

const server = vi.hoisted(() => ({
  /** What the loader answers for each area. Missing means granted. */
  answers: {} as Record<string, 'offline' | 'error' | 'denied'>,
  requests: [] as { uid: string; areas: string[]; known: boolean }[],
  purged: 0,
  /** Set to hold every load until released. */
  gate: null as Promise<void> | null,
}));

vi.mock('../../data/content/bundledContent', async () => {
  const { BUNDLED_CONTENT: real } = await import('../../data/content/bundledContent.server');
  const { buildAreaFacts } = await import('../../data/content/split');
  const { AUTHORED_STRUCTURES } = await import('../../data/seed');
  const payloads = JSON.parse(JSON.stringify(buildAreaFacts(AUTHORED_STRUCTURES))) as ReturnType<typeof buildAreaFacts>;
  const BUNDLED_CONTENT: BundledContent = {
    ...real,
    loader: {
      async load(request: AreaLoadRequest): Promise<AreaLoad[]> {
        server.requests.push({ uid: request.uid, areas: [...request.areas], known: request.known });
        if (server.gate) await server.gate;
        return request.areas.map((area) => {
          const refused = server.answers[area];
          return refused
            ? { area, status: refused }
            : { area, status: 'loaded' as const, facts: payloads[area], leaseUntil: '2099-01-01T00:00:00.000Z', from: 'server' as const };
        });
      },
      prefetch: async (_uid: string, area: Area) => ({ area, status: 'loaded' as const, facts: payloads[area] }),
      held: async () => [],
      purgeAll: async () => {
        server.purged += 1;
      },
    },
  };
  return { BUNDLED_CONTENT };
});

import { useAnatomyContent, type ContentAccess } from '../useAnatomyContent';
import { useProgressData } from '../useProgressData';
import { useTodayData } from '../useTodayData';
import { createMemoryRepository } from '../../data/memoryRepository';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import { AREAS } from '../../types/region';
import { areasOf } from '../../types/structure';
import { generateRevisionSet } from '../../lib/questionGenerators/generateSet';
import { buildStarterSet } from '../../lib/questionGenerators/starterSet';
import { AreaFactsNotice } from '../../components/shared/AreaFactsNotice';
import { MuscleCard } from '../../components/MuscleCard/MuscleCard';
import { MobileMuscleCard } from '../../components/mobile/MobileMuscleCard';
import { previewAssignment } from '../../../educator/lib/assignmentScope';
import type { UseEntitlement } from '../useEntitlement';
import { FREE_ENTITLEMENT } from '../../lib/entitlement';
import type { StructureMastery } from '../../types/attempt';

const repository = createMemoryRepository();
/** A fact only the deltoid's own facts could put on screen. ("Origin" alone will not do: the student's record lists the KINDS of fact.) */
const DELTOID = ALL_STRUCTURES.find((s) => s.id === 'deltoid') as Extract<(typeof ALL_STRUCTURES)[number], { category: 'muscle' }>;
const DELTOID_FACT = DELTOID.origin[0];
const idsIn = (areas: readonly Area[]) => ALL_STRUCTURES.filter((s) => areasOf(s).some((a) => areas.includes(a))).map((s) => s.id);

const access = (areas: Area[], over: Partial<ContentAccess> = {}): ContentAccess => ({ uid: 'u1', areas, loading: false, known: true, ...over });

function entitlement(areas: Area[]): UseEntitlement {
  return {
    entitlement: FREE_ENTITLEMENT,
    tier: 'free',
    loading: false,
    known: true,
    canAccess: (area) => areas.includes(area),
    locked: (all) => all.filter((a) => !areas.includes(a)),
    areas,
    freeArea: { area: areas[0], chosenAt: '2026-10-01T12:00:00.000Z', switches: 0 },
    chooseFreeArea: () => {},
    canSwitchFree: false,
    daysUntilSwitch: 27,
    switchUsed: false,
    refresh: () => {},
  };
}

beforeEach(() => {
  server.answers = {};
  server.requests.length = 0;
  server.gate = null;
  server.purged = 0;
});
afterEach(cleanup);

async function loaded(areas: Area[], over: Partial<ContentAccess> = {}) {
  const hook = renderHook((props: ContentAccess) => useAnatomyContent(repository, props), { initialProps: access(areas, over) });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe('a free account with one area', () => {
  it('holds the facts of that area and the names of everything', async () => {
    const { result } = await loaded(['knee']);
    const content = result.current;

    expect(content.structures.map((s) => s.id)).toEqual(idsIn(['knee']));
    expect(content.index).toHaveLength(ALL_STRUCTURES.length);
    expect(content.indexById.get('deltoid')?.name).toBe('Deltoid');
    expect(content.structuresById.has('deltoid')).toBe(false);
    expect(content.facts.source).toBe('server');
    expect(content.facts.has('knee')).toBe(true);
    expect(content.facts.missing(['knee'])).toEqual([]);
    expect(content.facts.status.hip).toBe('absent');
    expect(server.requests).toEqual([{ uid: 'u1', areas: ['knee'], known: true }]);
  });

  it('shows no notice: everything the account may have is in hand', async () => {
    const { result } = await loaded(['knee']);
    const { container } = render(<AreaFactsNotice facts={result.current.facts} entitled={['knee']} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('builds a full session from its one area, and a starter set', async () => {
    const { result } = await loaded(['knee']);
    const { structures, images, sources } = result.current;
    const set = generateRevisionSet(structures, images, {
      types: ['mcq', 'locate', 'identify-typed', 'multi-select', 'oina'], mode: 'practice', entitledAreas: ['knee'], seed: 3,
    }, sources);
    expect(set.length).toBeGreaterThan(100);
    const knee = new Set(idsIn(['knee']));
    expect(set.every((q) => knee.has(q.structureId))).toBe(true);
    // No multiple-choice question is left with a single option for want of neighbours.
    expect(set.filter((q) => q.type === 'mcq').every((q) => q.choices.length >= 2)).toBe(true);
    expect(buildStarterSet(structures, images, { areas: ['knee'], seed: 1 }, sources).length).toBeGreaterThan(0);
  });

  it('cannot be asked about an area it does not hold, whatever the config says', async () => {
    const { result } = await loaded(['knee']);
    const { structures, images, sources } = result.current;
    const set = generateRevisionSet(structures, images, { types: ['mcq', 'oina'], mode: 'practice', areas: ['shoulder'], entitledAreas: AREAS, seed: 1 }, sources);
    expect(set).toEqual([]);
  });

  // The progress screen shows the whole body, and a level must come out the
  // same whether or not the structure's facts are on the device.
  it('still counts progress over the whole body, with the levels the facts would give', async () => {
    const { result } = await loaded(['knee']);
    const rows: StructureMastery[] = ['deltoid', 'patella'].map((structureId) => ({
      structureId, userId: 'u1', attemptsTotal: 4, attemptsCorrect: 4, lastAttemptAt: new Date().toISOString(),
    }));
    const repo = createMemoryRepository();
    for (const row of rows) await repo.upsertMastery(row);

    const partial = renderHook(() => useProgressData(repo, 'u1', result.current));
    await waitFor(() => expect(partial.result.current.totalSeen).toBe(2));

    const { anatomyContentFrom } = await import('../useAnatomyContent');
    const whole = renderHook(() => useProgressData(repo, 'u1', anatomyContentFrom(ALL_STRUCTURES, ALL_IMAGES)));
    await waitFor(() => expect(whole.result.current.totalSeen).toBe(2));

    expect(partial.result.current.totalStructures).toBe(ALL_STRUCTURES.length);
    expect(partial.result.current.muscles.length).toBe(whole.result.current.muscles.length);
    expect(partial.result.current.seenByCategory).toEqual(whole.result.current.seenByCategory);
    expect(partial.result.current.byRegion).toEqual(whole.result.current.byRegion);
  });

  it('shows a locked structure its name and its lock, not "not found"', async () => {
    const { result } = await loaded(['knee']);
    render(
      <MemoryRouter>
        <MobileMuscleCard structureId="deltoid" content={result.current} repository={repository} userId="u1" access={entitlement(['knee'])} onBack={() => {}} onDrill={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Deltoid' })).toBeInTheDocument();
    expect(screen.getByText(/which is locked on this account/)).toBeInTheDocument();
    expect(screen.queryByText(/not found/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(DELTOID_FACT);
  });
});

describe('an area the account may have that is not on the device', () => {
  it('is reported as offline, named in the notice, and can be tried again', async () => {
    server.answers = { hip: 'offline', elbow: 'offline' };
    const { result } = await loaded(['knee', 'hip', 'elbow']);
    const content = result.current;

    expect(content.facts.missing(['knee', 'hip', 'elbow'])).toEqual(['elbow', 'hip']);
    expect(content.structures.map((s) => s.id)).toEqual(idsIn(['knee']));

    render(<AreaFactsNotice facts={content.facts} entitled={['knee', 'hip', 'elbow']} />);
    const notice = screen.getByTestId('area-facts-notice');
    expect(notice).toHaveTextContent('Elbow and Hip are not on this device');
    expect(notice).toHaveTextContent('Connect to the internet to load these areas.');
    expect(notice).not.toHaveTextContent('Knee');

    server.answers = {};
    act(() => screen.getByRole('button', { name: 'Try again' }).click());
    await waitFor(() => expect(result.current.facts.missing(['knee', 'hip', 'elbow'])).toEqual([]));
  });

  it('gives each reason its own sentence', async () => {
    server.answers = { hip: 'offline', elbow: 'error', shoulder: 'denied' };
    const { result } = await loaded(['knee', 'hip', 'elbow', 'shoulder']);
    render(<AreaFactsNotice facts={result.current.facts} entitled={['knee', 'hip', 'elbow', 'shoulder']} />);
    const reasons = [...screen.getByTestId('area-facts-notice').querySelectorAll('[data-reason]')].map((p) => p.getAttribute('data-reason'));
    expect(reasons).toEqual(['offline', 'error', 'denied']);
    expect(screen.getByText(/Elbow could not be loaded just now/)).toBeInTheDocument();
    expect(screen.getByText(/Shoulder could not be opened for this account/)).toBeInTheDocument();
  });

  it('draws the card with its name and picture and says why the facts are missing', async () => {
    server.answers = { shoulder: 'offline' };
    const { result } = await loaded(['knee', 'shoulder']);
    for (const Card of [MuscleCard, MobileMuscleCard]) {
      render(
        <MemoryRouter>
          <Card
            structureId="deltoid" content={result.current} repository={repository} userId="u1" access={entitlement(['knee', 'shoulder'])}
            contextIds={[]} onNavigateStructure={() => {}} onBack={() => {}} onDrill={() => {}} onNavigate={() => {}}
          />
        </MemoryRouter>,
      );
      expect(screen.getByRole('heading', { name: 'Deltoid' })).toBeInTheDocument();
      expect(screen.getByTestId('structure-facts-unavailable')).toHaveTextContent('Shoulder is not on this device');
      expect(document.body.textContent).not.toContain(DELTOID_FACT);
      expect(screen.queryByText(/locked on this account/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Drill this muscle' })).not.toBeInTheDocument();
      cleanup();
    }
  });

  it('does not shrink Today\'s totals, and queues only what can be asked', async () => {
    server.answers = { shoulder: 'offline' };
    const { result } = await loaded(['knee', 'shoulder']);
    const repo = createMemoryRepository();
    const due = new Date(Date.now() - 86_400_000).toISOString();
    for (const structureId of ['deltoid', 'patella']) {
      await repo.upsertMastery({ structureId, userId: 'u1', attemptsTotal: 3, attemptsCorrect: 1, lastAttemptAt: due, dueAt: due });
    }
    const today = renderHook(() => useTodayData(repo, 'u1', result.current, ['knee', 'shoulder']));
    await waitFor(() => expect(today.result.current.loading).toBe(false));

    expect(today.result.current.totalStructureCount).toBe(idsIn(['knee', 'shoulder']).length);
    expect(today.result.current.seenStructureCount).toBe(2);
    const queued = new Set(today.result.current.reviewItems.map((i) => i.structureId));
    expect(queued.has('patella')).toBe(true);
    expect(queued.has('deltoid')).toBe(false);
  });

  it('with nothing in hand at all: no structures, no crash, and a notice', async () => {
    server.answers = Object.fromEntries(AREAS.map((a) => [a, 'offline'])) as typeof server.answers;
    const { result } = await loaded([...AREAS]);
    expect(result.current.structures).toEqual([]);
    expect(result.current.index).toHaveLength(ALL_STRUCTURES.length);
    expect(generateRevisionSet(result.current.structures, result.current.images, { types: ['mcq'], mode: 'practice', entitledAreas: AREAS }, result.current.sources)).toEqual([]);
    render(<AreaFactsNotice facts={result.current.facts} entitled={AREAS} />);
    expect(screen.getByTestId('area-facts-notice')).toHaveTextContent('Connect to the internet');
  });
});

describe('waiting, and changes of account', () => {
  it('asks for nothing until the entitlement has been read, and stays loading', async () => {
    const hook = renderHook((props: ContentAccess) => useAnatomyContent(repository, props), {
      initialProps: access(['shoulder'], { loading: true, known: false }),
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(server.requests).toEqual([]);
    expect(hook.result.current.loading).toBe(true);

    hook.rerender(access(['knee']));
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(server.requests).toEqual([{ uid: 'u1', areas: ['knee'], known: true }]);
  });

  it('passes on whether the entitlement was actually read', async () => {
    await loaded(['knee'], { known: false });
    expect(server.requests[0].known).toBe(false);
  });

  it('loads the rest after a subscription without going back to the loading screen', async () => {
    const hook = await loaded(['knee']);
    let release!: () => void;
    server.gate = new Promise((r) => (release = r));

    hook.rerender(access([...AREAS]));
    await waitFor(() => expect(hook.result.current.facts.status.hip).toBe('loading'));
    expect(hook.result.current.loading).toBe(false);
    // What was in hand stays in hand while the rest arrives.
    expect(hook.result.current.facts.has('knee')).toBe(true);
    expect(hook.result.current.structures.map((s) => s.id)).toEqual(idsIn(['knee']));

    release();
    await waitFor(() => expect(hook.result.current.structures).toHaveLength(ALL_STRUCTURES.length));
    expect(hook.result.current.facts.missing(AREAS)).toEqual([]);
  });

  it('drops an area the account has lost', async () => {
    const hook = await loaded([...AREAS]);
    hook.rerender(access(['knee']));
    await waitFor(() => expect(hook.result.current.structures.map((s) => s.id)).toEqual(idsIn(['knee'])));
    expect(hook.result.current.facts.status.hip).toBe('absent');
  });

  it("never shows the last account's facts to the next", async () => {
    const hook = await loaded([...AREAS]);
    expect(hook.result.current.structures.length).toBeGreaterThan(400);

    let release!: () => void;
    server.gate = new Promise((r) => (release = r));
    hook.rerender(access(['knee'], { uid: 'u2' }));
    // Before u2's load has answered, nothing of u1's is on screen.
    await waitFor(() => expect(hook.result.current.structures).toEqual([]));
    release();
    await waitFor(() => expect(hook.result.current.structures.map((s) => s.id)).toEqual(idsIn(['knee'])));
  });

  it('holds nothing once there is no account, and stops waiting', async () => {
    const hook = await loaded([...AREAS]);
    hook.rerender(access(['shoulder'], { uid: null, known: false }));
    await waitFor(() => expect(hook.result.current.structures).toEqual([]));
    expect(hook.result.current.loading).toBe(false);
    expect(hook.result.current.facts.status.shoulder).toBe('offline');
  });

  it('a first visit with no account and no network is not left on the loading screen', async () => {
    const hook = renderHook(() => useAnatomyContent(repository, access(['shoulder'], { uid: null, known: false })));
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(server.requests).toEqual([]);
  });
});

describe("the educator's assignment preview", () => {
  it('counts exactly where the areas are in hand, and says so where they are not', async () => {
    await loaded(['knee']);
    const held = previewAssignment({ areas: ['knee'] }, ['mcq', 'oina']);
    expect(held.exact).toBe(true);
    expect(held.poolSize).toBe(idsIn(['knee']).length);
    expect(held.available).toBeGreaterThan(50);

    const notHeld = previewAssignment({ areas: ['shoulder'], category: 'muscle' }, ['mcq', 'oina']);
    expect(notHeld.exact).toBe(false);
    // The pool is still counted exactly: it comes from the index.
    expect(notHeld.poolSize).toBe(ALL_STRUCTURES.filter((s) => s.category === 'muscle' && areasOf(s).includes('shoulder')).length);
    expect(notHeld.available).toBeGreaterThan(0);

    // A scope the index says can build nothing is still caught.
    expect(previewAssignment({ areas: ['shoulder'], category: 'landmark' }, ['oina']).available).toBe(0);
  });
});
