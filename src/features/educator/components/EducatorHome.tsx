import { Navigate } from 'react-router-dom';
import { useCohorts } from '../hooks/useCohorts';

/** /educator index — redirects straight to the educator's first cohort (the common case: one cohort), or shows an empty/error state. */
export function EducatorHome() {
  const { cohorts, loading, error } = useCohorts();

  if (loading) {
    return (
      <div className="mt-10 text-sm" style={{ color: 'var(--ink3)' }}>
        Loading your cohorts…
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
  if (!cohorts || cohorts.length === 0) {
    return (
      <div className="mt-10 max-w-md text-sm leading-relaxed" style={{ color: 'var(--ink3)' }}>
        Your account is claimed for a cohort, but no matching cohort document could be found. Ask an admin to check
        the cohort setup.
      </div>
    );
  }

  return <Navigate to={`/educator/${cohorts[0].id}`} replace />;
}
