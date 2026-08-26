import { Link, useParams } from 'react-router-dom';
import { REGION_LABELS } from '../../../anatomy-revision/types/region';
import { useAdminUserDetail } from '../../hooks/useAdminUserDetail';
import { formatDateTime } from '../../lib/formatDate';

const labelStyle = {
  font: '500 10px/1 var(--font-mono)',
  letterSpacing: '.14em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink3)',
};

export function UserDetailPage() {
  const { uid } = useParams<{ uid: string }>();
  const { detail, loading, error } = useAdminUserDetail(uid ?? '');

  return (
    <div className="px-16 pt-16 pb-16">
      <Link to="/admin/users" style={{ font: '400 12.5px/1 var(--font-ui)', color: 'var(--ink3)', textDecoration: 'none' }}>
        ← Users
      </Link>

      {loading && (
        <div className="mt-10 text-sm" style={{ color: 'var(--ink3)' }}>
          Loading user…
        </div>
      )}
      {error && (
        <div className="mt-10 text-sm" style={{ color: 'var(--acc2d)' }}>
          {error}
        </div>
      )}

      {detail && (
        <>
          <h1
            className="mt-4"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 40,
              lineHeight: 1.05,
              letterSpacing: '-.02em',
              margin: '16px 0 0',
            }}
          >
            {detail.profile.displayName ?? 'Unnamed user'}
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--ink2)' }}>
            {detail.profile.email ?? 'No email on file'} · last active {formatDateTime(detail.profile.lastActiveAt)}
          </p>

          <div className="mt-8 flex gap-12">
            <div>
              <div style={labelStyle}>Total attempts</div>
              <div className="mt-1.5" style={{ font: '500 22px/1 var(--font-mono)', color: 'var(--ink)' }}>
                {detail.totalAttempts}
              </div>
            </div>
            <div>
              <div style={labelStyle}>Accuracy</div>
              <div
                className="mt-1.5"
                style={{ font: '500 22px/1 var(--font-mono)', color: detail.accuracyPct < 60 ? 'var(--acc2d)' : 'var(--accd)' }}
              >
                {detail.totalAttempts > 0 ? `${detail.accuracyPct}%` : '—'}
              </div>
            </div>
            <div>
              <div style={labelStyle}>Streak</div>
              <div className="mt-1.5" style={{ font: '500 22px/1 var(--font-mono)', color: 'var(--acc2d)' }}>
                {detail.streak}
              </div>
            </div>
          </div>

          <div className="mt-13 flex gap-[88px]">
            <div className="flex-1">
              <div style={labelStyle}>Accuracy by region</div>
              {detail.byRegion.length === 0 ? (
                <p className="mt-4 text-sm" style={{ color: 'var(--ink3)' }}>
                  No attempts yet.
                </p>
              ) : (
                <div className="mt-5.5 flex flex-col gap-6.5">
                  {detail.byRegion.map((r) => (
                    <div key={r.region}>
                      <div className="flex items-baseline gap-3.5">
                        <span className="flex-1" style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>
                          {REGION_LABELS[r.region]}
                        </span>
                        <span style={{ font: '400 12px/1 var(--font-mono)', color: 'var(--ink3)' }}>
                          {r.correct} / {r.total}
                        </span>
                        <span
                          style={{
                            font: '500 13.5px/1 var(--font-mono)',
                            color: r.accuracyPct < 60 ? 'var(--acc2d)' : 'var(--accd)',
                            minWidth: 40,
                            textAlign: 'right',
                          }}
                        >
                          {r.accuracyPct}%
                        </span>
                      </div>
                      <div className="mt-2.5 h-2" style={{ background: 'var(--line)' }}>
                        <div
                          className="h-full"
                          style={{ width: `${r.accuracyPct}%`, background: r.accuracyPct < 60 ? 'var(--acc2)' : 'var(--acc)' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="w-[420px] flex-none">
              <div style={labelStyle}>Ten weakest structures</div>
              {detail.weakestStructures.length === 0 ? (
                <p className="mt-4 text-sm" style={{ color: 'var(--ink3)' }}>
                  Not enough attempts yet.
                </p>
              ) : (
                <div className="mt-5 flex flex-col gap-3">
                  {detail.weakestStructures.map((s) => (
                    <div key={s.structureId} className="flex items-center justify-between gap-3">
                      <span style={{ font: '400 14px/1.3 var(--font-ui)', color: 'var(--ink)' }}>{s.name}</span>
                      <span style={{ font: '400 12px/1 var(--font-mono)', color: 'var(--ink3)', whiteSpace: 'nowrap' }}>
                        {s.attemptsTotal} attempt{s.attemptsTotal === 1 ? '' : 's'}
                      </span>
                      <span
                        style={{
                          font: '500 13px/1 var(--font-mono)',
                          color: 'var(--acc2d)',
                          minWidth: 36,
                          textAlign: 'right',
                        }}
                      >
                        {s.accuracyPct}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
