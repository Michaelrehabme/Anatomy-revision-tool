/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PERSISTENCE?: 'local' | 'firestore';
  /** '1' swaps the educator data layer for fixtures — dev only, see README "Educator demo mode". */
  readonly VITE_EDUCATOR_DEMO?: '1';
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
