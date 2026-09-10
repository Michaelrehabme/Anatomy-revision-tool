import { useEffect, useState } from 'react';
import { fetchSiteSettings, setMarketingHomeEnabled } from '../../../site/data/siteSettings';

/**
 * The switches that change what the public site does, without a deploy.
 *
 * Currently one: whether locusmsk.co.uk shows the marketing home page or
 * drops a new visitor straight into the app. It lives here rather than in an
 * environment variable because the point of the control is undoing a launch —
 * and an env var means a rebuild, a Netlify queue and several minutes during
 * which the wrong thing is live.
 */
export function SitePage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSiteSettings().then((settings) => {
      if (!cancelled) setEnabled(settings.marketingHomeEnabled);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      await setMarketingHomeEnabled(next);
      setEnabled(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: 30,
          letterSpacing: '-.02em',
          margin: 0,
          color: 'var(--ink)',
        }}
      >
        Site
      </h1>

      <section className="mt-8 p-5" style={{ background: 'var(--sf)', border: '1.2px solid var(--line)' }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div style={{ maxWidth: 400 }}>
            <div style={{ font: '500 15px/1.3 var(--font-ui)', color: 'var(--ink)' }}>Marketing home page</div>
            <p className="mt-1.5" style={{ font: '400 13.5px/1.55 var(--font-ui)', color: 'var(--ink2)', margin: '6px 0 0' }}>
              When on, someone arriving at the site who has never used the app sees the pricing and institutions page
              first. Anyone who has been through onboarding goes straight to their revision, either way.
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={enabled === true}
            aria-label="Marketing home page"
            disabled={enabled === null || busy}
            onClick={() => toggle(!enabled)}
            style={{
              font: '500 13px/1 var(--font-ui)',
              padding: '10px 16px',
              minWidth: 96,
              background: enabled ? 'var(--acc-fill)' : 'var(--fig-off)',
              color: enabled ? 'var(--onacc)' : 'var(--ink2)',
              cursor: enabled === null || busy ? 'wait' : 'pointer',
            }}
          >
            {enabled === null ? '…' : busy ? 'Saving…' : enabled ? 'On' : 'Off'}
          </button>
        </div>

        {enabled === true && (
          <p className="mt-4" style={{ font: '400 12.5px/1.6 var(--font-mono)', color: 'var(--ink3)', margin: '16px 0 0' }}>
            Live now at the site root. Turning it off takes effect on each visitor's next load.
          </p>
        )}

        {error && (
          <div className="mt-3" role="alert" style={{ font: '400 13px/1.5 var(--font-ui)', color: 'var(--acc2d)' }}>
            {error}
          </div>
        )}
      </section>

      <p className="mt-5" style={{ font: '400 12.5px/1.6 var(--font-ui)', color: 'var(--ink3)' }}>
        Paid plans are not open yet, so the pricing tiers invite people to register interest rather than to pay. The
        institution section needs nothing further — cohort pricing is a conversation.
      </p>
    </div>
  );
}
