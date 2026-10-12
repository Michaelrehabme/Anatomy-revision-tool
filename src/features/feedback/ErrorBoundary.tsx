import { Component, type ReactNode } from 'react';
import { reportClientError } from './data/telemetry';

/**
 * The last line of defence: a render that throws shows this, not a blank page.
 *
 * React unmounts the whole tree on an uncaught render error, and until this
 * existed that meant a white screen with nothing to press. The commonest cause
 * in a deployed single-page app is not a bug in a screen at all: a tab left
 * open across a deploy asks for a chunk that no longer exists. Reloading
 * fetches the new build, which is why Reload is the one action offered.
 *
 * WHAT THE COPY MAY PROMISE. Answers are saved as each one is recorded
 * (useRevisionSession), so "your saved answers are safe" is true; an answer on
 * screen that had not been rated yet is not saved, and the copy does not say
 * otherwise.
 *
 * A class, because an error boundary still has to be one.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    reportClientError('boundary', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main
        role="alert"
        className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"
        style={{ background: 'var(--pg)', color: 'var(--ink)' }}
      >
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 26, margin: 0 }}>
          This page has stopped working
        </h1>
        <p style={{ font: '400 15px/1.55 var(--font-ui)', color: 'var(--ink2)', maxWidth: '44ch', margin: 0 }}>
          Reloading usually fixes it. Your saved answers are safe, and the problem has been reported.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-[3px] px-5"
          style={{ font: '500 14px/1 var(--font-ui)', minHeight: 44, background: 'var(--acc-fill)', color: 'var(--onacc)' }}
        >
          Reload
        </button>
      </main>
    );
  }
}
