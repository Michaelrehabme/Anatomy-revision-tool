import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { RepositoryProvider } from './features/anatomy-revision/context/RepositoryProvider.tsx';
import { AnonymousUserProvider } from './features/anatomy-revision/context/AnonymousUserProvider.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AnonymousUserProvider>
      <RepositoryProvider>
        <App />
      </RepositoryProvider>
    </AnonymousUserProvider>
  </StrictMode>,
);
