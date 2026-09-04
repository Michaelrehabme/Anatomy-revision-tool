import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireEducator } from './components/RequireEducator';
import { EducatorShell } from './components/shell/EducatorShell';
import { EducatorHome } from './components/EducatorHome';
import { EducatorCohortOverviewScreen } from './components/Overview/CohortOverviewScreen';
import { EducatorStructureWeaknessScreen } from './components/Weakness/StructureWeaknessScreen';
import { EducatorConfusionPairsScreen } from './components/Confusion/ConfusionPairsScreen';
import { EducatorStudentsListScreen } from './components/Students/StudentsListScreen';
import { EducatorStudentDetailScreen } from './components/Students/StudentDetailScreen';
import { EducatorAssignmentsScreen } from './components/Assignments/AssignmentsScreen';
import { CreateClassScreen } from './components/CreateClass/CreateClassScreen';

/**
 * Entry point for /educator/* — mirrors admin/AdminApp.tsx's shape (a
 * React.lazy() target so students never download this bundle). RequireEducator
 * is the UI-hiding guard; the real security boundary is firestore.rules'
 * educator-claim checks on users/attemptEvents (see that file's comments).
 */
export default function EducatorApp() {
  return (
    <RequireEducator>
      <Routes>
        <Route element={<EducatorShell />}>
          <Route index element={<EducatorHome />} />
          <Route path="new" element={<CreateClassScreen />} />
          <Route path=":cohortId" element={<EducatorCohortOverviewScreen />} />
          <Route path=":cohortId/weakness" element={<EducatorStructureWeaknessScreen />} />
          <Route path=":cohortId/confusion" element={<EducatorConfusionPairsScreen />} />
          <Route path=":cohortId/students" element={<EducatorStudentsListScreen />} />
          <Route path=":cohortId/students/:uid" element={<EducatorStudentDetailScreen />} />
          <Route path=":cohortId/assignments" element={<EducatorAssignmentsScreen />} />
          <Route path="*" element={<Navigate to="/educator" replace />} />
        </Route>
      </Routes>
    </RequireEducator>
  );
}
