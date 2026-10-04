import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Native wrapper TRIAL — see docs/native-wrapper-trial.md. Nothing here ships
 * to a store; it exists to answer whether the PWA survives inside a shell.
 *
 * webDir is the ordinary production build. There is no second build and no
 * native-only code path beyond src/features/native/: the shell loads the same
 * dist/ the website serves, from https://localhost inside the WebView.
 *
 * appId IS PERMANENT once an app is published under it, on both stores. This
 * one is a placeholder for the trial; choose the real one before any upload.
 */
const config: CapacitorConfig = {
  appId: 'uk.rehabme.locusmsk',
  appName: 'LocusMSK',
  webDir: 'dist',
  server: {
    // The default, stated because the service worker depends on it: a secure
    // origin (https://localhost) is what lets it register on Android.
    androidScheme: 'https',
  },
};

export default config;
