import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { STRUCTURE_INDEX } from '../../../anatomy-revision/data/structureIndex';
import { AREAS, AREA_LABELS, type Area } from '../../../anatomy-revision/types/region';
import type { StudentStatsDoc } from '../../data/cohortRollups';
import { createChallenge, listChallenges } from '../../data/assignmentsRepository';
import { activeChallenge, areaTotal, challengeEnd, challengeWeeks, securedInArea, suggestedTarget } from '../../lib/classChallenge';
import type { ChallengeAssignment, CohortStudent } from '../../types/cohort';

const inputStyle = {
  font: '400 13.5px/1 var(--font-ui)',
  color: 'var(--ink)',
  background: 'var(--pg)',
  border: '1.2px solid var(--line)',
  borderRadius: 3,
  padding: '8px 10px',
} as const;

const labelStyle = { font: '500 11px/1 var(--font-mono)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink3)' } as const;

function weekLabel(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  return `${start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${challengeEnd(weekStart).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
}

function ChallengeCard({
  challenge,
  students,
  statsByUid,
  cohortId,
  current,
}: {
  challenge: ChallengeAssignment;
  students: CohortStudent[];
  statsByUid: Map<string, StudentStatsDoc>;
  cohortId: string;
  current: boolean;
}) {
  const rows = students
    .map((student) => {
      const levels = statsByUid.get(student.uid)?.rollup?.levels;
      return { student, secured: levels ? securedInArea(levels, STRUCTURE_INDEX, challenge.area) : null };
    })
    .sort((a, b) => (a.secured ?? -1) - (b.secured ?? -1) || (a.student.displayName ?? '').localeCompare(b.student.displayName ?? ''));
  const met = rows.filter((r) => (r.secured ?? 0) >= challenge.targetSecure).length;

  return (
    <div className="rounded-[4px] p-4" style={{ background: 'var(--sf)', border: current ? '1.4px solid var(--acc)' : '1px solid var(--line)' }}>
      <div className="flex items-baseline justify-between gap-3">
        <span style={{ font: '500 15px/1.3 var(--font-ui)', color: 'var(--ink)' }}>{challenge.title}</span>
        <span className="whitespace-nowrap" style={{ font: '400 12px/1 var(--font-mono)', color: current ? 'var(--accd)' : 'var(--ink3)' }}>
          {weekLabel(challenge.weekStart)}
          {current ? ' · this week' : ''}
        </span>
      </div>
      <div className="mt-2" style={{ font: '400 13px/1.4 var(--font-ui)', color: 'var(--ink2)' }}>
        {challenge.targetSecure} of {areaTotal(STRUCTURE_INDEX, challenge.area)} {AREA_LABELS[challenge.area].toLowerCase()} structures secure (Intermediate or above) by Sunday.
        Any revision counts; it is each student’s weekly focus.
      </div>
      <div className="mt-2.5" style={{ font: '500 13px/1.3 var(--font-mono)', color: 'var(--accd)' }}>
        {met}/{rows.length} met the target
      </div>
      {rows.length > 0 && (
        <details className="mt-3" open={current}>
          <summary className="cursor-pointer" style={{ font: '400 13px/1 var(--font-ui)', color: 'var(--accd)' }}>
            Students
          </summary>
          <div className="mt-2 flex flex-col gap-1.5">
            {rows.map(({ student, secured }) => {
              const pct = secured === null ? 0 : Math.min(100, (secured / challenge.targetSecure) * 100);
              return (
                <div key={student.uid} className="flex items-center gap-3">
                  <Link
                    to={`/educator/${cohortId}/students/${student.uid}`}
                    className="w-[180px] flex-none truncate"
                    style={{ font: '500 13px/1.3 var(--font-ui)', color: 'var(--accd)', textDecoration: 'none' }}
                  >
                    {student.displayName ?? student.email ?? student.uid}
                  </Link>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--fig-off)' }} aria-hidden>
                    <div className="h-full" style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--acc)' : 'var(--acc2)' }} />
                  </div>
                  <span className="w-[86px] flex-none text-right tabular-nums" style={{ font: '400 12.5px/1 var(--font-mono)', color: 'var(--ink2)' }}>
                    {secured === null ? 'no activity' : `${secured}/${challenge.targetSecure}`}
                  </span>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}

/**
 * Weekly class challenges on the assignments screen (owner, 19 Oct 2026). The
 * teacher sets an area, a week and a target; each student's progress comes
 * from the mastery levels their app already reports (studentStats rollup), so
 * there is nothing for a student to start — it is their weekly focus.
 * Students never see one another: this screen is the only place the class's
 * progress appears.
 */
export function ChallengeSection({
  cohortId,
  createdBy,
  students,
  statsByUid,
}: {
  cohortId: string;
  createdBy: string;
  students: CohortStudent[] | null;
  statsByUid: Map<string, StudentStatsDoc> | null;
}) {
  const now = new Date();
  const { thisWeek, nextWeek } = challengeWeeks(now);
  const [challenges, setChallenges] = useState<ChallengeAssignment[] | null>(null);
  const [area, setArea] = useState<Area>('shoulder');
  const [week, setWeek] = useState(thisWeek);
  const total = useMemo(() => areaTotal(STRUCTURE_INDEX, area), [area]);
  const [target, setTarget] = useState(() => String(suggestedTarget(areaTotal(STRUCTURE_INDEX, 'shoulder'))));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listChallenges(cohortId)
      .then((list) => !cancelled && setChallenges(list))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Failed to load challenges.'));
    return () => {
      cancelled = true;
    };
  }, [cohortId]);

  const targetNum = Number.parseInt(target, 10);
  const targetValid = Number.isInteger(targetNum) && targetNum >= 1 && targetNum <= total;
  const current = challenges ? activeChallenge(challenges, now) : null;

  const create = async () => {
    if (!targetValid) return;
    setSaving(true);
    setError(null);
    try {
      const challenge = await createChallenge({
        cohortId,
        createdBy,
        area,
        weekStart: week,
        targetSecure: targetNum,
        title: `Class challenge: ${AREA_LABELS[area]}`,
      });
      setChallenges((prev) => [challenge, ...(prev ?? [])]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set the challenge.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section data-tour="edu-challenge" className="mb-8">
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, letterSpacing: '-.01em', margin: '0 0 6px' }}>Weekly challenge</h2>
      <p className="m-0 mb-4" style={{ font: '400 13.5px/1.5 var(--font-ui)', color: 'var(--ink2)', maxWidth: 640 }}>
        One area for the week. It becomes every student’s weekly focus, and any revision in it counts. Students see only their own progress.
      </p>

      <div className="flex flex-wrap items-end gap-3 rounded-[4px] p-4" style={{ background: 'var(--sf)', border: '1px solid var(--line)' }}>
        <label className="flex flex-col gap-1.5">
          <span style={labelStyle}>Area</span>
          <select
            value={area}
            onChange={(e) => {
              const next = e.target.value as Area;
              setArea(next);
              setTarget(String(suggestedTarget(areaTotal(STRUCTURE_INDEX, next))));
            }}
            style={inputStyle}
          >
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {AREA_LABELS[a]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span style={labelStyle}>Week</span>
          <select value={week} onChange={(e) => setWeek(e.target.value)} style={inputStyle}>
            <option value={thisWeek}>This week ({weekLabel(thisWeek)})</option>
            <option value={nextWeek}>Next week ({weekLabel(nextWeek)})</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span style={labelStyle}>Secure by Sunday</span>
          <span className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={total}
              inputMode="numeric"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              aria-invalid={!targetValid}
              style={{ ...inputStyle, width: 76, borderColor: targetValid ? 'var(--line)' : 'var(--acc2)' }}
            />
            <span style={{ font: '400 13.5px/1 var(--font-ui)', color: 'var(--ink2)' }}>of {total} structures</span>
          </span>
        </label>
        <button
          type="button"
          onClick={() => void create()}
          disabled={!targetValid || saving}
          className="rounded-[3px] px-4 py-2 disabled:opacity-50"
          style={{ font: '500 13.5px/1 var(--font-ui)', background: 'var(--acc-fill)', color: 'var(--onacc)', border: 0 }}
        >
          {saving ? 'Setting…' : 'Set challenge'}
        </button>
      </div>
      {error && (
        <div className="mt-3 text-sm" style={{ color: 'var(--acc2d)' }}>
          {error}
        </div>
      )}

      {challenges && challenges.length > 0 && students && statsByUid && (
        <div className="mt-4 flex flex-col gap-3">
          {challenges.slice(0, 4).map((c) => (
            <ChallengeCard key={c.id} challenge={c} students={students} statsByUid={statsByUid} cohortId={cohortId} current={c.id === current?.id} />
          ))}
        </div>
      )}
    </section>
  );
}
