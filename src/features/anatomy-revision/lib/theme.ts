/**
 * What "follow my device, unless I said otherwise" means, in one place.
 *
 * Both axes are resolved here rather than in CSS. Expressing a device signal
 * AND a manual override for two independent axes purely in media queries takes
 * up to sixteen crossed selectors and writes every dark value two or four
 * times; resolving in JS and stamping a concrete attribute on <html> means
 * src/index.css has exactly four blocks, one per visible combination.
 *
 * The keys are duplicated by the bootstrap script in index.html, which has to
 * run before React to avoid a flash of the wrong theme. That duplication is
 * deliberate and guarded — see __tests__/theme.test.ts, which reads index.html
 * and asserts the strings still match.
 */

const PREFIX = 'anatomy-revision:v1:';
export const THEME_KEY = `${PREFIX}theme`;
export const CONTRAST_KEY = `${PREFIX}contrast`;

export const DARK_QUERY = '(prefers-color-scheme: dark)';
export const CONTRAST_QUERY = '(prefers-contrast: more)';

/** What the student chose. 'system' is the default and follows the device. */
export type ThemePreference = 'light' | 'dark' | 'system';
export type ContrastPreference = 'normal' | 'high' | 'system';

/** What <html> ends up carrying, and what src/index.css keys its scopes on. */
export type Theme = 'light' | 'dark';
export type Contrast = 'normal' | 'high';

export const THEME_PREFERENCES: ThemePreference[] = ['light', 'dark', 'system'];

export const THEME_PREFERENCE_LABELS: Record<ThemePreference, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'Follow device',
};

export function resolveTheme(preference: ThemePreference, deviceDark: boolean): Theme {
  return preference === 'system' ? (deviceDark ? 'dark' : 'light') : preference;
}

export function resolveContrast(preference: ContrastPreference, deviceHigh: boolean): Contrast {
  return preference === 'system' ? (deviceHigh ? 'high' : 'normal') : preference;
}

/**
 * Anything unrecognised reads as 'system'. A hand-edited or stale value must
 * leave the app following the device rather than pinned to a theme nobody
 * asked for and no control appears to explain.
 */
export function asThemePreference(raw: string | null): ThemePreference {
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

export function asContrastPreference(raw: string | null): ContrastPreference {
  return raw === 'normal' || raw === 'high' ? raw : 'system';
}

/** The browser-chrome colour for each theme — see index.html. */
export const THEME_COLORS: Record<Theme, string> = {
  light: '#1f2a44',
  dark: '#121927',
};
