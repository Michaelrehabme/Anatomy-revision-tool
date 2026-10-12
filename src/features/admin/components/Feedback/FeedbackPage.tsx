import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { STRUCTURE_INDEX_BY_ID } from '../../../anatomy-revision/data/structureIndex';
import { REPORT_REASONS, type FunnelEvent } from '../../../feedback/data/telemetry';
import {
  ERROR_LIMIT,
  FUNNEL_LIMIT,
  REPORT_LIMIT,
  listClientErrors,
  listFunnelEvents,
  listQuestionReports,
  resolveQuestionReport,
  type StoredError,
  type StoredReport,
} from '../../data/feedbackRepository';
import { funnelRows, funnelSources } from '../../lib/funnel';

/**
 * What the app has reported about itself: how far new visitors get, the
 * questions students say are wrong, and the pages that broke.
 *
 * One page, because during a launch they are read together: a step of the
 * funnel that loses people is usually explained by a row further down.
 */

const PERIODS = [
  { days: 1, label: 'Today' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
] as const;

const REASON_LABEL = new Map<string, string>(REPORT_REASONS.map((r) => [r.id, r.label]));

const heading: CSSProperties = { font: '500 17px/1.3 var(--font-ui)', color: 'var(--ink)', margin: 0 };
const small: CSSProperties = { font: '400 12.5px/1.55 var(--font-ui)', color: 'var(--ink3)', margin: 0 };
const cell: CSSProperties = { font: '400 13.5px/1.45 var(--font-ui)', color: 'var(--ink2)', padding: '8px 12px 8px 0', textAlign: 'left', verticalAlign: 'top' };
const head: CSSProperties = { ...cell, font: '500 10px/1 var(--font-mono)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink3)' };

function when(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Midnight at the start of the period, so "Today" means today and not the last 24 hours. */
function since(days: number): string {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start.toISOString();
}

function Panel({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="mt-8 p-5" style={{ background: 'var(--sf)', border: '1.2px solid var(--line)' }}>
      <h2 style={heading}>{title}</h2>
      {note && <p className="mt-1.5" style={small}>{note}</p>}
      <div className="mt-4 overflow-x-auto">{children}</div>
    </section>
  );
}

function useLoad<T>(load: () => Promise<T>, key: unknown): { data: T | null; error: string | null } {
  const [state, setState] = useState<{ data: T | null; error: string | null }>({ data: null, error: null });
  useEffect(() => {
    let cancelled = false;
    setState({ data: null, error: null });
    load().then(
      (data) => !cancelled && setState({ data, error: null }),
      (err) => !cancelled && setState({ data: null, error: err instanceof Error ? err.message : 'Could not load that.' }),
    );
    return () => {
      cancelled = true;
    };
    // `load` is a fresh closure each render; `key` is what it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

function Status({ error, loading }: { error: string | null; loading: boolean }) {
  if (error) return <p role="alert" style={{ ...small, color: 'var(--acc2d)' }}>{error}</p>;
  if (loading) return <p style={small}>Loading…</p>;
  return null;
}

function Funnel() {
  const [days, setDays] = useState<number>(7);
  const [source, setSource] = useState<string | null>(null);
  const { data, error } = useLoad<FunnelEvent[]>(() => listFunnelEvents(since(days)), days);
  const rows = useMemo(() => (data ? funnelRows(data, source) : []), [data, source]);
  const sources = useMemo(() => (data ? funnelSources(data) : []), [data]);
  const most = Math.max(1, ...rows.map((r) => r.people));

  return (
    <Panel
      title="New visitors"
      note="People who reached each step for the first time in the period. Each account is counted once per step, ever."
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {PERIODS.map((period) => (
          <button
            key={period.days}
            type="button"
            aria-pressed={days === period.days}
            onClick={() => setDays(period.days)}
            className="rounded-[3px] px-3"
            style={{
              font: '500 12.5px/1 var(--font-ui)',
              minHeight: 32,
              background: days === period.days ? 'var(--acc-fill)' : 'transparent',
              color: days === period.days ? 'var(--onacc)' : 'var(--ink2)',
              border: '1.2px solid var(--line)',
            }}
          >
            {period.label}
          </button>
        ))}
        {sources.length > 0 && (
          <label className="ml-2 flex items-center gap-2" style={small}>
            Arrived from
            <select
              value={source ?? ''}
              onChange={(event) => setSource(event.target.value || null)}
              style={{ font: '400 13px/1 var(--font-ui)', minHeight: 32, color: 'var(--ink)', background: 'var(--pg)', border: '1.2px solid var(--line)' }}
            >
              <option value="">Anywhere</option>
              {sources.map((s) => (
                <option key={s.source} value={s.source}>
                  {s.source} ({s.people})
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <Status error={error} loading={!data && !error} />
      {data && (
        <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 640 }}>
          <thead>
            <tr>
              <th style={head}>Step</th>
              <th style={{ ...head, textAlign: 'right' }}>People</th>
              <th style={{ ...head, textAlign: 'right' }}>Of previous</th>
              <th style={head} aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.step} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ ...cell, color: 'var(--ink)' }}>{row.label}</td>
                <td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.people}</td>
                <td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {row.ofPrevious === null ? '—' : `${row.ofPrevious}%`}
                </td>
                <td style={{ ...cell, width: 160 }} aria-hidden="true">
                  <div style={{ height: 8, width: `${(row.people / most) * 100}%`, minWidth: row.people ? 2 : 0, background: 'var(--acc)' }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data && data.length >= FUNNEL_LIMIT && (
        <p className="mt-3" style={small}>
          More than {FUNNEL_LIMIT.toLocaleString('en-GB')} events in this period: these counts are of the newest only. Choose a shorter period.
        </p>
      )}
    </Panel>
  );
}

function Reports() {
  const { data, error } = useLoad<StoredReport[]>(listQuestionReports, 0);
  const [resolved, setResolved] = useState<Record<string, string>>({});
  const [showResolved, setShowResolved] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const reports = (data ?? []).map((r) => ({ ...r, resolvedAt: resolved[r.id] ?? r.resolvedAt }));
  const open = reports.filter((r) => !r.resolvedAt);
  const shown = showResolved ? reports : open;

  async function resolve(id: string) {
    setFailed(null);
    try {
      const at = await resolveQuestionReport(id);
      setResolved((current) => ({ ...current, [id]: at }));
    } catch (err) {
      setFailed(err instanceof Error ? err.message : 'Could not save that.');
    }
  }

  return (
    <Panel title={`Reported questions${data ? ` (${open.length} open)` : ''}`} note={`The newest ${REPORT_LIMIT}, sent from "Report a problem" during a session.`}>
      <Status error={error ?? failed} loading={!data && !error} />
      {data && (
        <label className="mb-3 flex items-center gap-2" style={small}>
          <input type="checkbox" checked={showResolved} onChange={(event) => setShowResolved(event.target.checked)} />
          Show resolved
        </label>
      )}
      {data && shown.length === 0 && <p style={small}>Nothing reported.</p>}
      {shown.length > 0 && (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={head}>When</th>
              <th style={head}>Structure</th>
              <th style={head}>Question</th>
              <th style={head}>Problem</th>
              <th style={head} />
            </tr>
          </thead>
          <tbody>
            {shown.map((report) => (
              <tr key={report.id} style={{ borderTop: '1px solid var(--line)', opacity: report.resolvedAt ? 0.6 : 1 }}>
                <td style={{ ...cell, whiteSpace: 'nowrap' }}>{when(report.createdAt)}</td>
                <td style={{ ...cell, color: 'var(--ink)' }}>
                  {STRUCTURE_INDEX_BY_ID.get(report.structureId)?.name ?? report.structureId}
                  <div style={small}>{report.area ?? ''}</div>
                </td>
                <td style={cell}>
                  {report.questionType} · {report.promptKind}
                  <div style={{ ...small, font: '400 11.5px/1.4 var(--font-mono)', wordBreak: 'break-all' }}>{report.questionId}</div>
                </td>
                <td style={{ ...cell, maxWidth: 360 }}>
                  {REASON_LABEL.get(report.reason) ?? report.reason}
                  {report.note && <div style={{ ...small, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{report.note}</div>}
                </td>
                <td style={{ ...cell, paddingRight: 0, whiteSpace: 'nowrap' }}>
                  {report.resolvedAt ? (
                    <span style={small}>Resolved {when(report.resolvedAt)}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => resolve(report.id)}
                      className="rounded-[3px] px-3"
                      style={{ font: '500 12.5px/1 var(--font-ui)', minHeight: 32, background: 'transparent', color: 'var(--ink2)', border: '1.2px solid var(--line)' }}
                    >
                      Mark resolved
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function Errors() {
  const { data, error } = useLoad<StoredError[]>(listClientErrors, 0);
  // The same failure from forty phones is one problem, not forty.
  const groups = useMemo(() => {
    const byMessage = new Map<string, { latest: StoredError; count: number; people: Set<string> }>();
    for (const row of data ?? []) {
      const group = byMessage.get(row.message);
      if (group) {
        group.count += 1;
        group.people.add(row.userId);
      } else {
        byMessage.set(row.message, { latest: row, count: 1, people: new Set([row.userId]) });
      }
    }
    return [...byMessage.values()];
  }, [data]);

  return (
    <Panel title="Errors" note={`The newest ${ERROR_LIMIT}, grouped by message. At most five are sent from one page load.`}>
      <Status error={error} loading={!data && !error} />
      {data && groups.length === 0 && <p style={small}>No errors reported.</p>}
      {groups.map(({ latest, count, people }) => (
        <details key={latest.id} style={{ borderTop: '1px solid var(--line)', padding: '10px 0' }}>
          <summary style={{ font: '400 13.5px/1.45 var(--font-ui)', color: 'var(--ink)', cursor: 'pointer' }}>
            {latest.message}
            <span style={{ ...small, display: 'block' }}>
              {count} {count === 1 ? 'time' : 'times'}, {people.size} {people.size === 1 ? 'person' : 'people'} · last {when(latest.createdAt)} · {latest.path} · {latest.source}
            </span>
          </summary>
          <pre className="mt-2 overflow-x-auto" style={{ font: '400 11.5px/1.5 var(--font-mono)', color: 'var(--ink2)', margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>
            {latest.stack || 'No stack.'}
            {'\n\n'}
            {latest.userAgent}
            {'\n'}build {latest.build}
          </pre>
        </details>
      ))}
    </Panel>
  );
}

export function FeedbackPage() {
  return (
    <div style={{ maxWidth: 980 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 30, letterSpacing: '-.02em', margin: 0, color: 'var(--ink)' }}>
        Feedback
      </h1>
      <Funnel />
      <Reports />
      <Errors />
    </div>
  );
}
