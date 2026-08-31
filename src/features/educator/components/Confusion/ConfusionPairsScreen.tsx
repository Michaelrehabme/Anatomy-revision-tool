import { useParams } from 'react-router-dom';
import { useCohortAnalytics } from '../../hooks/useCohortAnalytics';
import { ConfusionPairsList } from '../../../admin/components/Analytics/ConfusionPairsList';

/** Educator's cohort-scoped counterpart to admin's platform-wide confusion-pairs view. */
export function EducatorConfusionPairsScreen() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const { snapshot, loading, error } = useCohortAnalytics(cohortId);

  if (loading) {
    return (
      <div className="mt-10 text-sm" style={{ color: 'var(--ink3)' }}>
        Loading attempt data…
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

  return (
    <div>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--ink2)', maxWidth: 640 }}>
        Ranked (correct, selected) pairs across every wrong attempt this cohort has made — each frequent pair is a
        distinction students consistently fail to make.
      </p>
      <ConfusionPairsList pairs={snapshot?.confusionPairs ?? []} />
    </div>
  );
}
