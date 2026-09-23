import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import { RepositoryProvider } from './features/anatomy-revision/context/RepositoryProvider.tsx';
import { AuthProvider } from './features/anatomy-revision/context/AuthProvider.tsx';
import { ThemeProvider } from './features/anatomy-revision/context/ThemeProvider.tsx';
import { UpdatePrompt } from './features/pwa/UpdatePrompt.tsx';
import { OfflineIndicator } from './features/pwa/OfflineIndicator.tsx';
import { purgeStaleAnatomyCaches } from './features/pwa/anatomyCache.ts';

// Pictures from an earlier render, cached under the same filenames, are
// dropped before the first one is asked for.
void purgeStaleAnatomyCaches();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      {/* Outermost: App has early returns for loading, repository errors and
          the legal/dev routes, all of which render themed text, and the legal
          pages are reachable with no account. Theming needs neither auth nor
          the repository. */}
      <ThemeProvider>
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
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
