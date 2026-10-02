import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { AREAS, AREA_LABELS, type Area } from '../../anatomy-revision/types/region';
import type { UseEntitlement } from '../../anatomy-revision/hooks/useEntitlement';
import { LockPill } from '../../anatomy-revision/components/shared/AreaLock';
import { actionsFor, percentDone, type AreaAction } from './areaStatus';
import { formatBytes } from './manifest';
import { offlineController, type AreaView, type OfflineController } from './offlineController';

/**
 * The Account screen's "Offline" block: one row per area, what each one would
 * cost in storage, and the buttons to take it offline or give the space back.
 *
 * WHY IT EXISTS AT ALL, when pictures are cached as they are seen: that cache
 * keeps the four hundred most recent for a month, and there are over five
 * thousand. A student who has looked at the shoulder all term and opens the
 * knee underground gets questions with holes where the pictures should be.
 * This is the "on purpose" version — everything the area can show, kept until
 * they remove it.
 *
 * THE GATE IS THE SAME ONE AS EVERYWHERE ELSE. A free account can download
 * its one free area; the rest show the same Locked pill and the same route to
 * the plans as the pickers do (AreaLock.tsx). Nothing here decides access —
 * it asks `access.canAccess`, like every other screen.
 *
 * The copy is flat and short on purpose. Storage is the only thing a student
 * is being asked to spend, so each row leads with the size.
 */

const ACTION_LABELS: Record<AreaAction, string> = {
  download: 'Download',
  cancel: 'Cancel',
  resume: 'Resume',
  update: 'Update',
  remove: 'Remove',
};

/** The actions that fetch are the primary ones; cancelling and removing are quiet. */
const PRIMARY: ReadonlySet<AreaAction> = new Set(['download', 'resume', 'update']);

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusText(view: AreaView): string {
  switch (view.status) {
    case 'not-downloaded':
      return 'Not downloaded';
    case 'downloading':
      return `Downloading ${percentDone(view.doneBytes, view.totalBytes)}%`;
    case 'updating':
      return 'Updating…';
    case 'paused':
      return `Paused at ${percentDone(view.doneBytes, view.totalBytes)}%`;
    case 'downloaded':
      return view.completedAt ? `Downloaded · ${formatDate(view.completedAt)}` : 'Downloaded';
    case 'update-available':
      return 'Update available';
  }
}

interface OfflineSectionProps {
  access: UseEntitlement;
  /** The phone layout: full-width rows and 44px targets. */
  compact?: boolean;
  /** Injected in tests. The app uses the shared one. */
  controller?: OfflineController;
}

export function OfflineSection({ access, compact = false, controller = offlineController() }: OfflineSectionProps) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  /** The area whose Remove has been pressed and is waiting for a yes or no. */
  const [confirming, setConfirming] = useState<Area | null>(null);
  const removeButtons = useRef(new Map<Area, HTMLButtonElement>());
  const returnFocusTo = useRef<Area | null>(null);

  // "Keep" puts the keyboard back where it came from. Only ever after a press
  // in this row — nothing here moves focus on its own, so an update running in
  // the background cannot pull it away from what the student is doing.
  useEffect(() => {
    if (confirming !== null || returnFocusTo.current === null) return;
    removeButtons.current.get(returnFocusTo.current)?.focus();
    returnFocusTo.current = null;
  }, [confirming]);

  useEffect(() => {
    // Sizes, and whether anything held is out of date. Both calls are safe to
    // repeat: the first runs once, the second is one small request.
    void controller.start().then(() => controller.refreshIndex());
  }, [controller]);

  const mono = { font: '400 11.5px/1.45 var(--font-mono)', color: 'var(--ink3)' } as const;
  const note = { font: `400 ${compact ? 13 : 13}px/1.55 var(--font-ui)`, color: 'var(--ink3)' } as const;

  if (snapshot.support === 'checking') return null;

  if (snapshot.support === 'unavailable') {
    return (
      <p className="mt-3" style={note}>
        Downloads are not available in this browser. Pictures you have already seen are still kept for a while.
      </p>
    );
  }

  const run = (action: AreaAction, area: Area) => {
    if (action === 'cancel') controller.cancel(area);
    // Remove asks first, in the row: getting it back costs the student's data.
    else if (action === 'remove') setConfirming(area);
    else void controller.download(area);
  };

  const keep = (area: Area) => {
    returnFocusTo.current = area;
    setConfirming(null);
  };

  const buttonStyle = (primary: boolean) =>
    ({
      font: '500 13px/1 var(--font-ui)',
      minHeight: compact ? 44 : 36,
      minWidth: 84,
      ...(primary
        ? { background: 'var(--acc-fill)', color: 'var(--onacc)', border: '1.2px solid transparent' }
        : { background: 'transparent', color: 'var(--ink2)', border: '1.2px solid var(--line)' }),
    }) as const;

  return (
    <div className="mt-3">
      <p style={{ font: '400 14px/1.55 var(--font-ui)', color: 'var(--ink2)' }}>
        Download an area to keep every picture in it on this device, for revising with no signal.
      </p>

      <ul className="mt-4" style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: '1px solid var(--line)' }}>
        {AREAS.map((area) => {
          const view = snapshot.areas[area];
          const label = AREA_LABELS[area];
          const locked = !access.canAccess(area);
          const actions = actionsFor(view.status, locked);
          const busy = view.status === 'downloading';
          const pct = percentDone(view.doneBytes, view.totalBytes);
          // Nothing to offer and nothing held: the row is only its lock.
          const lockedOut = locked && view.status === 'not-downloaded';

          return (
            <li
              key={area}
              className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${compact ? 'py-3' : 'py-3.5'}`}
              style={{ borderBottom: '1px solid var(--line)' }}
            >
              <div className="min-w-0 flex-1" style={{ flexBasis: 180 }}>
                <div className="flex items-center gap-2.5">
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: compact ? 16.5 : 17, color: 'var(--ink)' }}>
                    {label}
                  </span>
                  {locked && <LockPill compact />}
                </div>
                <div className="mt-1" style={mono}>
                  {view.totalBytes !== null && `${formatBytes(view.totalBytes)} · `}
                  {statusText(view)}
                </div>
                {(busy || view.status === 'paused') && (
                  <div
                    role="progressbar"
                    aria-label={`${label} download`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct}
                    aria-valuetext={`${pct}%, ${formatBytes(view.doneBytes)}${view.totalBytes ? ` of ${formatBytes(view.totalBytes)}` : ''}`}
                    className="mt-2 overflow-hidden rounded-full"
                    style={{ height: 4, background: 'var(--line)', maxWidth: 320 }}
                  >
                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--acc)', transition: 'width 200ms linear' }} />
                  </div>
                )}
                {view.error && (
                  <p role="alert" className="mt-1.5" style={{ font: '400 12.5px/1.45 var(--font-ui)', color: 'var(--acc2d)' }}>
                    {view.error}
                  </p>
                )}
              </div>

              <div className="flex flex-none items-center gap-2">
                {lockedOut && (
                  <Link
                    to="/pricing"
                    aria-label={`See the plans to unlock ${label}`}
                    className="inline-flex items-center"
                    style={{ font: '400 13px/1 var(--font-ui)', color: 'var(--accd)', minHeight: compact ? 44 : 36 }}
                  >
                    See the plans
                  </Link>
                )}
                {confirming === area && actions.includes('remove') ? (
                  <div role="group" aria-label={`Remove ${label} downloads?`} className="flex flex-wrap items-center gap-2">
                    <span style={{ font: '400 13px/1.4 var(--font-ui)', color: 'var(--ink2)' }}>
                      Remove {formatBytes(view.doneBytes)} of downloads?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirming(null);
                        void controller.remove(area);
                      }}
                      aria-label={`Remove ${label} downloads`}
                      className="rounded-[3px] px-3.5"
                      style={buttonStyle(false)}
                    >
                      Remove
                    </button>
                    {/* Focus lands on the answer that loses nothing. */}
                    <button
                      type="button"
                      autoFocus
                      onClick={() => keep(area)}
                      aria-label={`Keep ${label} downloads`}
                      className="rounded-[3px] px-3.5"
                      style={buttonStyle(true)}
                    >
                      Keep
                    </button>
                  </div>
                ) : (
                  actions.map((action) => (
                    <button
                      key={action}
                      type="button"
                      ref={
                        action === 'remove'
                          ? (el) => {
                              if (el) removeButtons.current.set(area, el);
                              else removeButtons.current.delete(area);
                            }
                          : undefined
                      }
                      onClick={() => run(action, area)}
                      aria-label={`${ACTION_LABELS[action]} ${label}`}
                      className="rounded-[3px] px-3.5"
                      style={buttonStyle(PRIMARY.has(action))}
                    >
                      {ACTION_LABELS[action]}
                    </button>
                  ))
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-3" style={mono}>
        {snapshot.usedBytes > 0 ? `Downloads use ${formatBytes(snapshot.usedBytes)} on this device` : 'Nothing downloaded yet'}
        {snapshot.freeBytes !== null && ` · about ${formatBytes(snapshot.freeBytes)} free`}
      </p>

      {access.tier === 'free' && !access.loading && (
        <p className="mt-2" style={note}>
          Your free area can be downloaded.{' '}
          <Link to="/pricing" style={{ color: 'var(--accd)' }}>
            Unlock every region
          </Link>{' '}
          to download the rest.
        </p>
      )}

      <p className="mt-2" style={note}>
        On iPhone and iPad, add LocusMSK to your Home Screen first. Otherwise Safari may clear downloads after a few
        weeks without use.
      </p>
    </div>
  );
}

export default OfflineSection;
