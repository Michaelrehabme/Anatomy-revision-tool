import { useParams } from 'react-router-dom';
import { useCohortAnalytics } from '../../hooks/useCohortAnalytics';
import { StructureWeaknessTable } from '../../../admin/components/Analytics/StructureWeaknessTable';

/** Educator's cohort-scoped counterpart to admin's platform-wide StructureWeaknessScreen — this is the screen the CR-012 prompt calls out as "the thing educators actually want", since it tells them what to reteach before the exam. */
export function EducatorStructureWeaknessScreen() {
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
        Every structure this cohort has attempted at least 5 times, worst accuracy first — a low first-attempt
        accuracy vs. overall means students are learning it through repetition; the reverse means they're forgetting
        it once revised.
      </p>
      <StructureWeaknessTable rows={snapshot?.structureWeakness ?? []} />
    </div>
  );
}
