import { act, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AREAS, type Area } from '../../../anatomy-revision/types/region';
import type { UseEntitlement } from '../../../anatomy-revision/hooks/useEntitlement';
import { FREE_ENTITLEMENT } from '../../../anatomy-revision/lib/entitlement';
import type { AreaManifest, OfflineIndex } from '../manifest';
import { OfflineController, type ControllerDeps } from '../offlineController';
import { OfflineSection } from '../OfflineSection';
import type { OfflineSource } from '../offlineSource';
import { fakeStorage } from './fakeCaches';

/**
 * The section against a real controller and a pretend server, so what is
 * pinned is the whole path a student takes — press Download, see it finish,
 * press Remove — and not a snapshot of markup.
 */
const body = 'aaaa';
const picture = { url: '/anatomy/joints/a.webp', bytes: 10_000_000, hash: '61be55a8e2f6b4e1' };

const index: OfflineIndex = {
  version: 1,
  areas: Object.fromEntries(
    AREAS.map((a) => [a, { bytes: 10_000_000, files: 1, hash: '1111111111111111' }]),
  ) as OfflineIndex['areas'],
};

function controllerWith(overrides: Partial<ControllerDeps> = {}) {
  const { storage, fake } = fakeStorage();
  const source: OfflineSource = {
    fetchIndex: async () => index,
    fetchManifest: async (area): Promise<AreaManifest> => ({
      version: 1,
      area,
      hash: '1111111111111111',
      bytes: picture.bytes,
      files: [picture],
    }),
    fetchFile: async () => new TextEncoder().encode(body).buffer as ArrayBuffer,
  };
  const controller = new OfflineController({ source, storage, hasServiceWorker: async () => true, ...overrides });
  return { controller, fake };
}

/** The slice of useEntitlement the section reads. */
const access = (canAccess: (area: Area) => boolean, tier: UseEntitlement['tier']): UseEntitlement =>
  ({ entitlement: FREE_ENTITLEMENT, tier, loading: false, canAccess }) as UseEntitlement;

const paid = access(() => true, 'individual');
const freeWithElbow = access((area) => area === 'elbow', 'free');

const show = (props: Parameters<typeof OfflineSection>[0]) =>
  render(
    <MemoryRouter>
      <OfflineSection {...props} />
    </MemoryRouter>,
  );

const row = (name: string) => screen.getByText(name).closest('li')!;

describe('OfflineSection', () => {
  it('lists every area with its size and a Download button for a paid account', async () => {
    const { controller } = controllerWith();
    show({ access: paid, controller });

    await screen.findByText('Wrist & Hand');
    expect(screen.getAllByRole('listitem')).toHaveLength(AREAS.length);
    await waitFor(() => expect(within(row('Knee')).getByText(/10 MB · Not downloaded/)).toBeInTheDocument());
    expect(screen.getAllByRole('button', { name: /^Download / })).toHaveLength(AREAS.length);
    expect(screen.getByText(/Nothing downloaded yet/)).toBeInTheDocument();
    expect(screen.getByText(/add LocusMSK to your Home Screen/)).toBeInTheDocument();
  });

  it('downloads an area, says so, and removes it again', async () => {
    const { controller, fake } = controllerWith();
    show({ access: paid, controller });

    (await screen.findByRole('button', { name: 'Download Elbow' })).click();
    await waitFor(() => expect(within(row('Elbow')).getByText(/Downloaded ·/)).toBeInTheDocument());
    expect(fake.pictures('locusmsk-offline-elbow')).toEqual([picture.url]);
    expect(screen.getByText(/Downloads use 10 MB on this device/)).toBeInTheDocument();
    // Downloaded: nothing left to fetch, so the only button is the way back.
    expect(within(row('Elbow')).getAllByRole('button').map((b) => b.textContent)).toEqual(['Remove']);

    // Remove asks first, in the row, and "Keep" changes nothing.
    act(() => screen.getByRole('button', { name: 'Remove Elbow' }).click());
    expect(within(row('Elbow')).getByText('Remove 10 MB of downloads?')).toBeInTheDocument();
    const keep = screen.getByRole('button', { name: 'Keep Elbow downloads' });
    expect(keep).toHaveFocus();
    act(() => keep.click());
    expect(fake.caches.has('locusmsk-offline-elbow')).toBe(true);
    // …and the keyboard is back on the button it came from.
    expect(screen.getByRole('button', { name: 'Remove Elbow' })).toHaveFocus();

    act(() => screen.getByRole('button', { name: 'Remove Elbow' }).click());
    act(() => screen.getByRole('button', { name: 'Remove Elbow downloads' }).click());
    await waitFor(() => expect(within(row('Elbow')).getByText(/Not downloaded/)).toBeInTheDocument());
    expect(fake.caches.has('locusmsk-offline-elbow')).toBe(false);
  });

  it('shows a quiet Updating… with no bar and no buttons while a small update is applied unasked', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { controller } = controllerWith({
      download: async () => {
        await gate;
        throw new Error('stopped by the test');
      },
    });
    show({ access: paid, controller });
    await screen.findByRole('button', { name: 'Download Hip' });
    const focused = screen.getByRole('button', { name: 'Download Knee' });
    focused.focus();

    act(() => void controller.download('hip', { quiet: true }));
    expect(await within(row('Hip')).findByText(/Updating…/)).toBeInTheDocument();
    expect(within(row('Hip')).queryByRole('progressbar')).toBeNull();
    expect(within(row('Hip')).queryByRole('button')).toBeNull();
    // Nothing the student was doing is disturbed.
    expect(focused).toHaveFocus();

    release();
    await screen.findByRole('button', { name: 'Download Hip' });
    expect(within(row('Hip')).queryByRole('alert')).toBeNull();
  });

  it('shows progress with a labelled bar while a download runs, and a Cancel button', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { controller } = controllerWith({
      download: async ({ onProgress }) => {
        onProgress?.({ doneBytes: 4_200_000, totalBytes: 10_000_000 });
        await gate;
        throw new Error('stopped by the test');
      },
    });
    show({ access: paid, controller });

    (await screen.findByRole('button', { name: 'Download Hip' })).click();
    const bar = await screen.findByRole('progressbar', { name: 'Hip download' });
    expect(bar).toHaveAttribute('aria-valuenow', '42');
    expect(within(row('Hip')).getByText(/Downloading 42%/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel Hip' })).toBeInTheDocument();

    release();
    expect(await within(row('Hip')).findByRole('alert')).toHaveTextContent(/could not start/);
  });

  it('lets a free account download its free area and locks the rest behind the plans', async () => {
    const { controller } = controllerWith();
    show({ access: freeWithElbow, controller });

    await screen.findByRole('button', { name: 'Download Elbow' });
    expect(screen.getAllByRole('button', { name: /^Download / })).toHaveLength(1);
    expect(screen.getAllByText('Locked')).toHaveLength(AREAS.length - 1);
    const plans = screen.getByRole('link', { name: 'See the plans to unlock Knee' });
    expect(plans).toHaveAttribute('href', '/pricing');
    expect(screen.getByRole('link', { name: 'Unlock every region' })).toHaveAttribute('href', '/pricing');
  });

  it('still lets a locked area that was downloaded earlier be removed', async () => {
    const { controller } = controllerWith();
    await controller.download('knee');
    show({ access: freeWithElbow, controller });

    await screen.findByRole('button', { name: 'Remove Knee' });
    expect(screen.queryByRole('button', { name: /Update Knee|Download Knee/ })).toBeNull();
  });

  it('says downloads are unavailable where there is no service worker, and offers no buttons', async () => {
    const { controller } = controllerWith({ hasServiceWorker: async () => false });
    show({ access: paid, controller });

    expect(await screen.findByText(/Downloads are not available in this browser/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
