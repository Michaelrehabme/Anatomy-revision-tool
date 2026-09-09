import { Navigate, Route, Routes } from 'react-router-dom';
import { AttributionsPage } from './AttributionsPage';

/**
 * Public legal routes, mounted by App.tsx ABOVE its onboarding and content
 * gates — see LEGAL_PATHS there. Both app stores and UK GDPR require these
 * reachable from a cold link by someone with no account, who has not been
 * through onboarding, before any anatomy content has loaded.
 *
 * /privacy and /terms join this file under the rest of CR-025. They need
 * details only the operator can supply — legal entity, contact address,
 * retention periods — so the route container and the attributions page ship
 * first rather than a policy containing invented facts.
 */
export default function LegalRoutes() {
  return (
    <Routes>
      <Route path="/attributions" element={<AttributionsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
