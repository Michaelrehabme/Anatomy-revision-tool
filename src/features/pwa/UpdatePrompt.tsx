import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Offers a new version rather than installing one (CR-023 item 3).
 *
 * registerType is 'prompt', not 'autoUpdate', and this is why: a service
 * worker that reloads the page the moment it finds an update will do it while
 * a student is halfway through a session, and their in-progress answers live
 * in React state. Losing eight answers to a deploy is a worse bug than running
 * yesterday's build for another ten minutes.
 *
 * So the new worker waits, this offers the swap, and the student takes it when
 * they are between sessions.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-3 z-[90] mx-auto flex max-w-[420px] items-center gap-3 rounded-[3px] px-4 py-3 shadow-lg"
      style={{ background: 'var(--ink)', color: 'var(--pg)', font: '400 13px/1.4 var(--font-ui)' }}
    >
      <span className="flex-1">A new version of LocusMSK is ready.</span>
      <button
        type="button"
        onClick={() => void updateServiceWorker(true)}
        className="shrink-0 rounded-[3px] px-3"
        style={{ font: '500 13px/1 var(--font-ui)', minHeight: 36, background: 'var(--acc)', color: 'var(--ink)', border: 0 }}
      >
        Reload
      </button>
      <button
        type="button"
        onClick={() => setNeedRefresh(false)}
        className="shrink-0 px-2"
        style={{ font: '400 13px/1 var(--font-ui)', minHeight: 36, color: 'var(--pg)', opacity: 0.7, background: 'none', border: 0 }}
      >
        Later
      </button>
    </div>
  );
}

export default UpdatePrompt;
