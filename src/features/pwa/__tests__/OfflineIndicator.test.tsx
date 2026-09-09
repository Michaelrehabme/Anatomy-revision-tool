import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { OfflineIndicator } from '../OfflineIndicator';

/**
 * The offline banner is the one piece of the offline story that is testable
 * without a Firestore emulator: the queue-and-sync behaviour underneath it is
 * Firestore's own persistentLocalCache, so a test here would be asserting that
 * the SDK works rather than that we do.
 *
 * What is worth pinning is the reassurance. A student who loses signal
 * mid-session must be told revision still works — if this ever regresses into
 * an error state, or starts hiding when it should show, they close the app.
 */

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
  act(() => {
    window.dispatchEvent(new Event(value ? 'online' : 'offline'));
  });
}

describe('OfflineIndicator', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('renders nothing while online', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    const { container } = render(<OfflineIndicator />);
    expect(container).toBeEmptyDOMElement();
  });

  it('appears when the connection drops, and says revision still works', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    render(<OfflineIndicator />);

    setOnline(false);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/offline/i);
    // The specific promise, not just the word "offline" — this is what stops
    // someone assuming the app has broken.
    expect(status).toHaveTextContent(/revision still works/i);
    expect(status).toHaveTextContent(/sync when you reconnect/i);
  });

  it('disappears again on reconnect', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    render(<OfflineIndicator />);
    expect(screen.getByRole('status')).toBeInTheDocument();

    setOnline(true);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
