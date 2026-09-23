import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CONTRAST_QUERY,
  DARK_QUERY,
  THEME_COLORS,
  resolveContrast,
  resolveTheme,
  type Contrast,
  type ContrastPreference,
  type Theme,
  type ThemePreference,
} from '../lib/theme';
import {
  getContrastPreference,
  getThemePreference,
  setContrastPreference,
  setThemePreference,
} from '../lib/preferences';
import { useMediaQuery } from '../hooks/useMediaQuery';

interface ThemeContextValue {
  /** What the student chose — 'system' means follow the device. */
  themePreference: ThemePreference;
  contrastPreference: ContrastPreference;
  /** What is actually applied, after resolving the preference against the device. */
  theme: Theme;
  contrast: Contrast;
  /** What the device is asking for, so the controls can say "on, because...". */
  deviceDark: boolean;
  deviceHighContrast: boolean;
  setThemePreference: (preference: ThemePreference) => void;
  setContrastPreference: (preference: ContrastPreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Applies the appearance preferences to <html>.
 *
 * Mounted in main.tsx above everything else, not inside App: App has early
 * returns for the loading state, the repository error, the legal routes and
 * the dev routes, all of which render themed text, and the legal pages are
 * reachable without an account. Theming depends on neither auth nor the
 * repository, so it has no reason to sit below them.
 *
 * The attributes are already correct on first paint — the bootstrap script in
 * index.html sets them synchronously — so the first effect here is normally a
 * no-op. It exists to keep them right afterwards: when the OS appearance
 * changes while the app is open, and when the student picks an override.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themePreference, setThemeState] = useState<ThemePreference>(getThemePreference);
  const [contrastPreference, setContrastState] = useState<ContrastPreference>(getContrastPreference);

  const deviceDark = useMediaQuery(DARK_QUERY);
  const deviceHighContrast = useMediaQuery(CONTRAST_QUERY);

  const theme = resolveTheme(themePreference, deviceDark);
  const contrast = resolveContrast(contrastPreference, deviceHighContrast);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-contrast', contrast);

    // The media-scoped <meta theme-color> pair in index.html follows the
    // DEVICE, so it is wrong for anyone who overrode it. An unscoped meta
    // beats both, and is written here because only this knows the resolved
    // answer.
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = THEME_COLORS[theme];
  }, [theme, contrast]);

  const chooseTheme = useCallback((preference: ThemePreference) => {
    setThemePreference(preference);
    setThemeState(preference);
  }, []);

  const chooseContrast = useCallback((preference: ContrastPreference) => {
    setContrastPreference(preference);
    setContrastState(preference);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themePreference,
      contrastPreference,
      theme,
      contrast,
      deviceDark,
      deviceHighContrast,
      setThemePreference: chooseTheme,
      setContrastPreference: chooseContrast,
    }),
    [themePreference, contrastPreference, theme, contrast, deviceDark, deviceHighContrast, chooseTheme, chooseContrast],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside a ThemeProvider (see main.tsx).');
  return value;
}
