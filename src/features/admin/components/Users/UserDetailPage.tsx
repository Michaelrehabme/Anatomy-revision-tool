import { Link, useParams } from 'react-router-dom';
import { REGION_LABELS } from '../../../anatomy-revision/types/region';
import { useAdminUserDetail } from '../../hooks/useAdminUserDetail';
import { useTestAccounts } from '../../hooks/useTestAccounts';
import { formatDateTime, formatRelativeDay } from '../../lib/formatDate';
import { COURSE_LABELS, STUDY_LENGTH_LABELS, STUDY_LEVEL_LABELS, TRAINING_GROUP_LABELS, trainingGroup } from '../../lib/questionnaire';
import { ADMIN_PAGE_PAD, ADMIN_TITLE_STYLE } from '../shared/AdminMobile';
import { Panel, StatCard, Switch, Tag } from '../shared/AdminUi';

const labelStyle = {
  font: '500 10px/1 var(--font-mono)',
  letterSpacing: '.14em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink3)',
};

export function UserDetailPage() {
  const { uid } = useParams<{ uid: string }>();
  const { detail, loading, error } = useAdminUserDetail(uid ?? '');
  const { testIds, setMarked } = useTestAccounts();
  const isTest = uid ? testIds.has(uid) : false;
  const q = detail?.profile.questionnaire ?? { status: 'none' as const };

  return (
    <div className={`${ADMIN_PAGE_PAD} mx-auto w-full max-w-[1240px]`}>
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
          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <h1 className="flex flex-wrap items-center gap-3" style={{ ...ADMIN_TITLE_STYLE, margin: '16px 0 0' }}>
                {detail.profile.displayName ?? detail.profile.email ?? 'Guest'}
                {isTest && <Tag tone="warn">Test</Tag>}
              </h1>
              <p className="mt-2 text-sm" style={{ color: 'var(--ink2)', overflowWrap: 'anywhere' }}>
                {detail.profile.email ?? 'No email on file'} · joined {formatDateTime(detail.profile.createdAt)}
              </p>
            </div>
            <Switch
              checked={isTest}
              onChange={(next) => void setMarked(detail.profile.uid, next, { email: detail.profile.email, displayName: detail.profile.displayName })}
              label="Test account"
            />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2.5 lg:grid-cols-5 lg:gap-3">
            <StatCard label="Last session" value={formatRelativeDay(detail.lastSessionAt)} note={formatDateTime(detail.lastSessionAt)} tone="accent" compact />
            <StatCard label="Last opened app" value={formatRelativeDay(detail.profile.lastActiveAt)} note={formatDateTime(detail.profile.lastActiveAt)} compact />
            <StatCard label="Attempts" value={detail.totalAttempts} />
            <StatCard label="Accuracy" value={detail.totalAttempts > 0 ? `${detail.accuracyPct}%` : '—'} />
            <StatCard className="col-span-2 lg:col-span-1" label="Streak" value={detail.streak} note={detail.streak === 1 ? 'day' : 'days'} />
          </div>

          <Panel className="mt-3" title="Questionnaire" aside={q.status === 'skipped' ? 'Skipped' : q.status === 'none' ? 'Not answered' : TRAINING_GROUP_LABELS[trainingGroup(q)]}>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3" style={{ margin: 0 }}>
              {(
                [
                  ['Level', q.level ? STUDY_LEVEL_LABELS[q.level] : '—'],
                  ['Course', q.course ? COURSE_LABELS[q.course] : '—'],
                  ['Studied anatomy for', q.studyLength ? STUDY_LENGTH_LABELS[q.studyLength] : '—'],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt style={labelStyle}>{label}</dt>
                  <dd className="mt-1.5" style={{ margin: '6px 0 0', font: '400 14.5px/1.35 var(--font-ui)', color: value === '—' ? 'var(--ink3)' : 'var(--ink)' }}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>

          <div className="mt-13 flex flex-col gap-12 lg:flex-row lg:gap-[88px]">
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

            <div className="w-full flex-none lg:w-[420px]">
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
