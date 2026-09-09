import { Link, Navigate } from 'react-router-dom';
import { useCohorts } from './CohortsProvider';
import { CreateClassScreen } from './CreateClass/CreateClassScreen';

/**
 * /educator index — the create form for someone with no classes, straight
 * into the class for someone with exactly one, and a list for anyone with
 * more. There is no "you don't have access" state: owning a class is the
 * access, so the answer to having none is to make one.
 *
 * The list exists because this screen used to send everyone to cohorts[0].
 * With two classes that silently picked one and left the other reachable only
 * through a <select> in the desktop sidebar — invisible on a phone, and easy
 * to miss on a laptop. The single-class redirect stays, because for most
 * educators a list of one is a click that buys nothing.
 *
 * Archived classes sort last and say so rather than being hidden: an educator
 * looking for last year's cohort should be able to find it here.
 */
export function EducatorHome() {
  const { cohorts, loading, error } = useCohorts();

  if (loading) {
    return (
      <div className="mt-10 text-sm" style={{ color: 'var(--ink3)' }}>
        Loading your classes…
      </div>
    );
  }
  if (error) {
    return (
      <div className="mt-10 text-sm" style={{ color: 'var(--acc2d)' }}>
        {error}
      </div>
    );
  }
  if (!cohorts || cohorts.length === 0) return <CreateClassScreen firstRun />;
  if (cohorts.length === 1) return <Navigate to={`/educator/${cohorts[0].id}`} replace />;

  const ordered = [...cohorts].sort((a, b) => {
    if (Boolean(a.archivedAt) !== Boolean(b.archivedAt)) return a.archivedAt ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, letterSpacing: '-0.02em' }}>Your classes</h1>
      <p className="mt-1.5 text-sm" style={{ color: 'var(--ink3)' }}>
        {ordered.length} classes
      </p>

      <ul className="mt-6 flex list-none flex-col gap-2 p-0">
        {ordered.map((cohort) => (
          <li key={cohort.id}>
            <Link
              to={`/educator/${cohort.id}`}
              className="flex flex-col gap-1 rounded-[3px] border px-4 py-3.5 no-underline"
              // minHeight keeps the row a comfortable tap target on a phone,
              // where this list is the section's landing screen.
              style={{ borderColor: 'var(--line)', background: 'var(--sf)', minHeight: 44 }}
            >
              <span
                className="flex items-baseline gap-2"
                style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink)' }}
              >
                {cohort.name}
                {cohort.archivedAt && (
                  <span
                    style={{
                      font: '500 10px/1 var(--font-mono)',
                      letterSpacing: '.1em',
                      textTransform: 'uppercase',
                      color: 'var(--ink3)',
                    }}
                  >
                    Archived
                  </span>
                )}
              </span>
              <span className="text-sm" style={{ color: 'var(--ink3)' }}>
                {cohort.institution} · Join code {cohort.joinCode}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Link
        to="/educator/new"
        className="mt-5 inline-flex items-center no-underline"
        style={{ fontFamily: 'var(--font-display)', fontSize: 16, minHeight: 44, color: 'var(--accd)' }}
      >
        + New class
      </Link>
    </div>
  );
}
