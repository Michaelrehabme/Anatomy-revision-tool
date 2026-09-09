import { useEffect, useState } from 'react';

/**
 * Says when the connection has gone, so a student knows why sign-in and class
 * join are unavailable (CR-023 item 4).
 *
 * Deliberately quiet and deliberately reassuring. Revision itself keeps
 * working offline — the questions are in the bundle and answers queue locally
 * — so this is not an error state and must not read like one. The failure this
 * prevents is a student on a train assuming the app is broken and closing it.
 *
 * navigator.onLine only proves the device thinks it has an interface, not that
 * anything is reachable, so it is used to show a hint and never to gate the
 * session path.
 */
export function useIsOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}

export function OfflineIndicator() {
  const online = useIsOnline();

  if (online) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[95] px-4 py-1.5 text-center"
      style={{ background: 'var(--accs)', color: 'var(--accd)', font: '500 12px/1.4 var(--font-ui)' }}
    >
      Offline — revision still works, and your answers will sync when you reconnect.
    </div>
  );
}

export default OfflineIndicator;
