import { Navigate } from 'react-router-dom';
import { useCohorts } from './CohortsProvider';
import { CreateClassScreen } from './CreateClass/CreateClassScreen';

/**
 * /educator index — straight to the first class (the common case: one class),
 * or the create form for someone who has none. There is no "you don't have
 * access" state any more: owning a class is the access, so the answer to
 * having none is to make one.
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

  return <Navigate to={`/educator/${cohorts[0].id}`} replace />;
}
