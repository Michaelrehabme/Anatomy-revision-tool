import { Navigate, Route, Routes } from 'react-router-dom';
import { AttributionsPage } from './AttributionsPage';
import { PrivacyPage } from './PrivacyPage';
import { TermsPage } from './TermsPage';

/**
 * Public legal routes, mounted by App.tsx ABOVE its onboarding and content
 * gates — see LEGAL_PATHS there. Both app stores and UK GDPR require these
 * reachable from a cold link by someone with no account, who has not been
 * through onboarding, before any anatomy content has loaded.
 *
 * Account deletion and data export (CR-025 items 3 and 4) are the remaining
 * pieces. Both need a Cloud Functions project, which does not exist yet —
 * firebase.json declares only firestore rules and indexes.
 */
export default function LegalRoutes() {
  return (
    <Routes>
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/attributions" element={<AttributionsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
