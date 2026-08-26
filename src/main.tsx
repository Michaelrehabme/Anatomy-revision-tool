import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import { RepositoryProvider } from './features/anatomy-revision/context/RepositoryProvider.tsx';
import { AuthProvider } from './features/anatomy-revision/context/AuthProvider.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <RepositoryProvider>
          <App />
        </RepositoryProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
