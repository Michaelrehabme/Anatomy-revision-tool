import { Navigate, Route, Routes } from 'react-router-dom';
import { HotspotAuthoring } from './HotspotAuthoring';

/**
 * Dev-only tooling. App.tsx only reaches this behind import.meta.env.DEV, so
 * the whole chunk is dead code in a production build — verify with
 * `npm run build` that no DevRoutes chunk appears in dist/assets.
 */
export default function DevRoutes() {
  return (
    <Routes>
      <Route path="/dev/hotspots" element={<HotspotAuthoring />} />
      <Route path="*" element={<Navigate to="/dev/hotspots" replace />} />
    </Routes>
  );
}
