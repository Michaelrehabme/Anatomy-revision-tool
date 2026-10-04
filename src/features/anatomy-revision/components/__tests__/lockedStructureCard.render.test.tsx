import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MuscleCard } from '../MuscleCard/MuscleCard';
import { MobileMuscleCard } from '../mobile/MobileMuscleCard';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import { FREE_ENTITLEMENT, type Entitlement, type FreeAreaChoice } from '../../lib/entitlement';
import { AREAS, type Area } from '../../types/region';
import { areasOf, isMuscle, type MuscleStructure } from '../../types/structure';
import type { UseEntitlement } from '../../hooks/useEntitlement';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';

/**
 * A locked structure's card, reached by its address
 * (docs/PAYWALL-TRACE-2026-09-29.md, item 14).
 *
 * The Atlas hides locked structures, but /structure/deltoid can be typed. It
 * used to show a free Knee account the deltoid's picture and every fact, with
 * the lock on the drill button alone. Held here, on both layouts: the locked
 * card is the name, the region and the way to unlock, and nothing that is
 * sold; every other account sees the card exactly as it was.
 */

afterEach(cleanup);

const content: AnatomyContent = {
  structures: ALL_STRUCTURES,
  images: ALL_IMAGES,
  structuresById: new Map(ALL_STRUCTURES.map((s) => [s.id, s])),
  imagesById: new Map(ALL_IMAGES.map((i) => [i.id, i])),
  loading: false,
  error: null,
  retry: () => {},
};

/** A muscle in this area and no other, with a reviewed blood supply to withhold. */
const muscleIn = (area: Area): MuscleStructure => {
  const found = ALL_STRUCTURES.filter(isMuscle).find((s) => areasOf(s).join() === area && s.bloodSupply?.primary);
  if (!found) throw new Error(`no muscle with a blood supply in ${area} alone`);
  return found;
};

const shoulderMuscle = muscleIn('shoulder');
const kneeMuscle = muscleIn('knee');

function accessFor(kind: 'free' | 'paid' | 'licensed', overrides: Partial<UseEntitlement> = {}): UseEntitlement {
  const freeArea: FreeAreaChoice = { area: 'knee', chosenAt: '2026-10-01T12:00:00.000Z', switches: 0 };
  const areas: Area[] = kind === 'free' ? ['knee'] : [...AREAS];
  const entitlement: Entitlement =
    kind === 'free'
      ? FREE_ENTITLEMENT
      : { tier: kind === 'paid' ? 'individual' : 'institutional', source: kind === 'paid' ? 'paddle' : 'licence', expiresAt: null };
  return {
    entitlement,
    tier: entitlement.tier,
    loading: false,
    canAccess: (area) => areas.includes(area),
    locked: (all) => all.filter((a) => !areas.includes(a)),
    areas,
    freeArea,
    chooseFreeArea: () => {},
    canSwitchFree: false,
    daysUntilSwitch: 27,
    switchUsed: false,
    refresh: () => {},
    ...overrides,
  };
}

const LAYOUTS = [
  {
    name: 'desktop',
    renderCard: (structureId: string, access: UseEntitlement) =>
      render(
        <MemoryRouter>
          <MuscleCard
            access={access}
            structureId={structureId}
            content={content}
            repository={null}
            userId={null}
            contextIds={[]}
            onNavigateStructure={vi.fn()}
            onBack={vi.fn()}
            onDrill={vi.fn()}
            onNavigate={vi.fn()}
          />
        </MemoryRouter>,
      ),
  },
  {
    name: 'mobile',
    renderCard: (structureId: string, access: UseEntitlement) =>
      render(
        <MemoryRouter>
          <MobileMuscleCard access={access} structureId={structureId} content={content} repository={null} userId={null} onBack={vi.fn()} onDrill={vi.fn()} />
        </MemoryRouter>,
      ),
  },
] as const;

/** Everything the card states about a muscle that a subscription is what opens. */
function expectFactsShown(muscle: MuscleStructure, container: HTMLElement) {
  const text = container.textContent ?? '';
  expect(text).toContain(muscle.origin.join('; '));
  expect(text).toContain(muscle.insertion.join('; '));
  expect(text).toContain(muscle.actionText);
  expect(text).toContain(muscle.bloodSupply!.primary!);
  expect(container.querySelector('img')).not.toBeNull();
  expect(screen.getByRole('button', { name: 'Drill this muscle' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'See the plans' })).not.toBeInTheDocument();
}

function expectFactsWithheld(muscle: MuscleStructure, container: HTMLElement) {
  const text = container.textContent ?? '';
  for (const fact of [...muscle.origin, ...muscle.insertion, muscle.actionText, ...muscle.nerve.map((n) => n.name)]) {
    expect(text, `the locked card still states "${fact}"`).not.toContain(fact);
  }
  if (muscle.bloodSupply?.primary) expect(text).not.toContain(muscle.bloodSupply.primary);
  // (The student's own record still lists "Origin" and the like as skills
  // with a level beside them. Those are the names of question types, not facts.)
  expect(container.querySelector('img'), 'the picture').toBeNull();
  expect(screen.queryByRole('button', { name: 'Drill this muscle' })).not.toBeInTheDocument();
}

describe.each(LAYOUTS)('the structure card on $name', ({ renderCard }) => {
  it('free account, own area: the whole card', () => {
    const { container } = renderCard(kneeMuscle.id, accessFor('free'));
    expectFactsShown(kneeMuscle, container);
  });

  it('free account, locked area: the name, the region and the way to unlock, and nothing that is sold', () => {
    const { container } = renderCard(shoulderMuscle.id, accessFor('free'));
    expectFactsWithheld(shoulderMuscle, container);

    expect(screen.getByRole('heading', { level: 1, name: shoulderMuscle.name })).toBeInTheDocument();
    expect(
      screen.getByText(
        `${shoulderMuscle.name} is part of Shoulder, which is locked on this account. Its picture, facts and practice open with that area.`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Your free area is Knee\. A subscription opens every region/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See the plans' })).toHaveAttribute('href', '/pricing');
    // The one change of free area, where it applies: not yet, here, and it says when.
    expect(screen.getByRole('button', { name: /^Changeable / })).toBeDisabled();
  });

  it('free account, locked area, change available: offers the one change', () => {
    renderCard(shoulderMuscle.id, accessFor('free', { canSwitchFree: true, daysUntilSwitch: 0 }));
    expect(screen.getByRole('button', { name: 'Use my one change: make Shoulder free instead' })).toBeEnabled();
  });

  it('free account, locked area, change already used: the plans are the only way', () => {
    renderCard(shoulderMuscle.id, accessFor('free', { switchUsed: true }));
    expect(screen.getByRole('link', { name: 'See the plans' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /one change|Changeable/ })).not.toBeInTheDocument();
  });

  it('puts the lock before anything else on the card, not at the foot of it', () => {
    const { container } = renderCard(shoulderMuscle.id, accessFor('free'));
    const heading = screen.getByRole('heading', { level: 1 });
    const plans = screen.getByRole('link', { name: 'See the plans' });
    expect(heading.compareDocumentPosition(plans) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Nothing sits between the name and the panel but the name's own lines.
    const between = (container.textContent ?? '').split(shoulderMuscle.name)[1].split('See the plans')[0];
    expect(between.length).toBeLessThan(400);
  });

  it('a structure in two areas is open if either is', () => {
    // A facet joint revises under all three spine levels. The account holds
    // the LAST of its areas, not the first, which is the one the lock panel
    // would have named.
    const shared = ALL_STRUCTURES.find((s) => areasOf(s).length > 1);
    expect(shared, 'a structure in more than one area').toBeDefined();
    const held = areasOf(shared!).at(-1)!;
    renderCard(
      shared!.id,
      accessFor('free', { areas: [held], canAccess: (area) => area === held, freeArea: { area: held, chosenAt: '2026-10-01T12:00:00.000Z', switches: 0 } }),
    );
    expect(screen.getByRole('button', { name: 'Drill this muscle' })).toBeInTheDocument();
  });

  it.each(['paid', 'licensed'] as const)('%s account: the whole card in any area', (kind) => {
    for (const muscle of [kneeMuscle, shoulderMuscle]) {
      const { container, unmount } = renderCard(muscle.id, accessFor(kind));
      expectFactsShown(muscle, container);
      unmount();
    }
  });

  it('while the entitlement is still being read: neither the content nor a paywall that may be wrong', () => {
    // The hook answers "free" until the first read settles, and a subscriber
    // opening a bookmark must not be told their free area is set elsewhere.
    const { container } = renderCard(shoulderMuscle.id, accessFor('free', { loading: true }));
    expectFactsWithheld(shoulderMuscle, container);
    expect(screen.getByRole('status')).toHaveTextContent('Checking what your account can open…');
    expect(screen.queryByRole('link', { name: 'See the plans' })).not.toBeInTheDocument();
  });
});
