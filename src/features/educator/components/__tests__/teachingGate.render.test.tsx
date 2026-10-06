import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Cohort } from '../../types/cohort';

/**
 * Teaching needs full access (owner's decision, 6 Oct 2026). The rules refuse
 * the writes; this is what the educator SEES instead of a form that would
 * fail — at /educator, /educator/new, a class's own screens, and in the
 * Teaching block of the account screen.
 */

const state = vi.hoisted(() => ({
  own: false as boolean | 'fail',
  admin: false,
  anonymous: false,
  cohorts: [] as unknown[],
}));

vi.mock('../../../anatomy-revision/data/entitlementRepository', () => ({
  readOwnFullAccess: async () => {
    if (state.own === 'fail') throw new Error('offline');
    return state.own;
  },
}));
vi.mock('../../../roles/useCurrentRole', () => ({
  useCurrentRole: () => ({ uid: 'ed1', isAdmin: state.admin, loading: false }),
}));
vi.mock('../../../anatomy-revision/context/AuthProvider', () => ({
  AUTH_ENABLED: true,
  useAuth: () => ({ user: { uid: 'ed1', isAnonymous: state.anonymous, email: 'ed@uni.ac.uk', displayName: 'Ed' }, loading: false }),
}));
vi.mock('../../data/cohortsRepository', () => ({
  listCohortsOwnedBy: async () => state.cohorts,
}));
vi.mock('../RequireEducator', () => ({ useEducatorSession: () => ({ uid: 'ed1' }) }));

import { CohortsProvider } from '../CohortsProvider';
import { TeachingGate } from '../TeachingGate';
import { MyClasses } from '../../../anatomy-revision/components/Account/MyClasses';

const DAY = 86_400_000;
const cohort = (id: string, name: string, licensedUntil: string | null = null): Cohort => ({
  id, name, institution: '', ownerUid: 'ed1', joinCode: `${id.toUpperCase()}1`, createdAt: '2026-09-01T09:00:00.000Z', archivedAt: null, licensedUntil,
});

function at(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CohortsProvider>
        <TeachingGate>
          <p>the educator screen</p>
        </TeachingGate>
      </CohortsProvider>
    </MemoryRouter>,
  );
}
const panel = () => screen.findByRole('heading', { level: 1, name: 'Teaching tools need full access' });
const screenShown = () => screen.findByText('the educator screen');

beforeEach(() => {
  state.own = false;
  state.admin = false;
  state.anonymous = false;
  state.cohorts = [];
});
afterEach(cleanup);

describe('creating a class', () => {
  it.each(['/educator', '/educator/new'])('a free account at %s is shown the panel, not the form', async (path) => {
    at(path);
    expect(await panel()).toBeTruthy();
    expect(screen.queryByText('the educator screen')).toBeNull();
    expect(screen.getByRole('link', { name: 'See the plans' }).getAttribute('href')).toBe('/pricing');
    expect(screen.getByRole('link', { name: 'Back to your account' }).getAttribute('href')).toBe('/account');
    expect(screen.getByText(/come with full access: a subscription, or a licence\s+or complimentary account arranged with LocusMSK\./)).toBeTruthy();
    // Nobody who has never made a class is told their classes are kept.
    expect(screen.queryByText(/kept exactly as/)).toBeNull();
  });

  it('takes focus on its heading', async () => {
    at('/educator/new');
    const heading = await panel();
    expect(document.activeElement).toBe(heading);
  });

  it.each(['/educator', '/educator/new'])('an account with full access gets the form at %s', async (path) => {
    state.own = true;
    at(path);
    expect(await screenShown()).toBeTruthy();
  });

  it('an admin with no entitlement gets it too', async () => {
    state.admin = true;
    at('/educator/new');
    expect(await screenShown()).toBeTruthy();
  });

  it('a guest is told an account comes first', async () => {
    state.anonymous = true;
    at('/educator/new');
    await panel();
    expect(screen.getByText(/You will be asked to create a free account first\./)).toBeTruthy();
  });

  it('does not tell a paying educator to subscribe when the check could not be made', async () => {
    state.own = 'fail';
    at('/educator/new');
    expect(await screen.findByText(/We could not check this account's access just now\./)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'See the plans' })).toBeNull();
  });
});

describe('an educator whose access has lapsed', () => {
  beforeEach(() => {
    state.cohorts = [cohort('c1', 'Y2 Physiotherapy 2026')];
  });

  it.each(['/educator', '/educator/c1', '/educator/c1/students', '/educator/c1/assignments', '/educator/new'])(
    'sees the panel at %s, and is told the class is kept',
    async (path) => {
      at(path);
      expect(await panel()).toBeTruthy();
      expect(screen.getByText(/Your class, Y2 Physiotherapy 2026, is kept exactly as it is, and your students are still in it\./)).toBeTruthy();
      expect(screen.getByText(/They open again as soon as this account has full access\./)).toBeTruthy();
      expect(screen.queryByText('the educator screen')).toBeNull();
    },
  );

  it('counts their classes when there are several', async () => {
    state.cohorts = [cohort('c1', 'Y1'), cohort('c2', 'Y2'), cohort('c3', 'Y3')];
    at('/educator');
    await panel();
    expect(screen.getByText(/Your 3 classes are kept exactly as they are, and your students are still in them\./)).toBeTruthy();
  });

  it('is not alarming: no lock, no warning, no loss', async () => {
    at('/educator/c1');
    await panel();
    expect(document.body.textContent).not.toMatch(/locked|expired|blocked|denied|deleted|lost/i);
  });

  it('gets their screens back with full access', async () => {
    state.own = true;
    at('/educator/c1/students');
    expect(await screenShown()).toBeTruthy();
  });

  // The licence is granted to the class, for this teaching.
  describe('who owns a class that is itself licensed', () => {
    beforeEach(() => {
      state.cohorts = [
        cohort('c1', 'Licensed class', new Date(Date.now() + 100 * DAY).toISOString()),
        cohort('c2', 'Plain class'),
      ];
    });

    it('can open that class, and the list', async () => {
      at('/educator/c1');
      expect(await screenShown()).toBeTruthy();
      cleanup();
      at('/educator');
      expect(await screenShown()).toBeTruthy();
    });

    it('cannot open their unlicensed class, or start another', async () => {
      at('/educator/c2');
      expect(await panel()).toBeTruthy();
      cleanup();
      at('/educator/new');
      expect(await panel()).toBeTruthy();
    });

    it('cannot once the licence has run out', async () => {
      state.cohorts = [cohort('c1', 'Licensed class', new Date(Date.now() - DAY).toISOString())];
      at('/educator/c1');
      expect(await panel()).toBeTruthy();
    });
  });
});

describe('the Teaching block on the account screen', () => {
  const open = () => render(<MemoryRouter><MyClasses uid="ed1" /></MemoryRouter>);

  it('tells a free account what creating a class needs, in place of the button', async () => {
    open();
    expect(await screen.findByText('Teaching tools need full access')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Create a class' })).toBeNull();
    expect(screen.getByRole('link', { name: 'See the plans' }).getAttribute('href')).toBe('/pricing');
    // In the middle of the account screen it is a note, not a page: no page heading.
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('offers an account with full access the way to create one', async () => {
    state.own = true;
    open();
    expect((await screen.findByRole('link', { name: 'Create a class' })).getAttribute('href')).toBe('/educator/new');
    expect(screen.queryByText('Teaching tools need full access')).toBeNull();
  });

  it('still lists the classes of an educator whose access has lapsed', async () => {
    state.cohorts = [cohort('c1', 'Y2 Physiotherapy 2026')];
    open();
    expect(await screen.findByText('Y2 Physiotherapy 2026')).toBeTruthy();
    expect(screen.getByText('C11')).toBeTruthy();
    expect(screen.getByText('Teaching tools need full access')).toBeTruthy();
    expect(screen.getByText(/is kept exactly as it is/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'View my classes' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'New class' })).toBeNull();
  });

  it('shows an educator with full access their classes and both links', async () => {
    state.own = true;
    state.cohorts = [cohort('c1', 'Y2 Physiotherapy 2026')];
    open();
    expect((await screen.findByRole('link', { name: 'View my classes' })).getAttribute('href')).toBe('/educator');
    expect(screen.getByRole('link', { name: 'New class' }).getAttribute('href')).toBe('/educator/new');
  });

  it('lets the owner of a licensed class in, without offering a new class', async () => {
    state.cohorts = [cohort('c1', 'Licensed class', new Date(Date.now() + 100 * DAY).toISOString())];
    open();
    await waitFor(() => expect(screen.getByRole('link', { name: 'View my classes' })).toBeTruthy());
    expect(screen.queryByRole('link', { name: 'New class' })).toBeNull();
    expect(screen.queryByText('Teaching tools need full access')).toBeNull();
  });
});
