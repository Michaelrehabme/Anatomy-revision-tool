import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import { RepositoryProvider } from './features/anatomy-revision/context/RepositoryProvider.tsx';
import { AuthProvider } from './features/anatomy-revision/context/AuthProvider.tsx';
import { UpdatePrompt } from './features/pwa/UpdatePrompt.tsx';
import { OfflineIndicator } from './features/pwa/OfflineIndicator.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <RepositoryProvider>
          <App />
          {/* Outside App so they survive its loading and error early returns —
              losing the connection during content load is exactly when a
              student needs telling why. */}
          <OfflineIndicator />
          <UpdatePrompt />
        </RepositoryProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
