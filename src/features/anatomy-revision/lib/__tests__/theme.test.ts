import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONTRAST_KEY,
  CONTRAST_QUERY,
  DARK_QUERY,
  THEME_KEY,
  asContrastPreference,
  asThemePreference,
  resolveContrast,
  resolveTheme,
} from '../theme';

describe('resolveTheme', () => {
  it('follows the device only when no override is set', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('lets an explicit choice beat the device in both directions', () => {
    // The direction that is easy to get wrong: someone on a dark device who
    // deliberately asked for light.
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('resolveContrast', () => {
  it('follows the device only when no override is set', () => {
    expect(resolveContrast('system', true)).toBe('high');
    expect(resolveContrast('system', false)).toBe('normal');
  });

  it('lets someone turn high contrast off on a device that asks for it', () => {
    expect(resolveContrast('normal', true)).toBe('normal');
    expect(resolveContrast('high', false)).toBe('high');
  });
});

describe('stored preferences', () => {
  it('reads anything unrecognised as following the device', () => {
    // A stale or hand-edited value must not pin the app to a theme with no
    // control on screen that explains it.
    for (const junk of [null, '', 'System', 'DARK', 'auto', '{}']) {
      expect(asThemePreference(junk)).toBe('system');
      expect(asContrastPreference(junk)).toBe('system');
    }
    expect(asThemePreference('dark')).toBe('dark');
    expect(asThemePreference('light')).toBe('light');
    expect(asContrastPreference('high')).toBe('high');
    expect(asContrastPreference('normal')).toBe('normal');
  });
});

describe('the index.html bootstrap', () => {
  const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');

  /**
   * The bootstrap has to run before first paint, so it cannot import this
   * module and duplicates the keys and queries as literals. This is the guard
   * that keeps the copy honest: rename a key in theme.ts without touching
   * index.html and every returning student silently loses their choice, with
   * nothing failing anywhere.
   */
  it('still uses the same storage keys and media queries', () => {
    expect(html).toContain(THEME_KEY);
    expect(html).toContain(CONTRAST_KEY);
    expect(html).toContain(DARK_QUERY);
    expect(html).toContain(CONTRAST_QUERY);
  });

  it('runs synchronously, before the stylesheet can paint', () => {
    // A module or a deferred script paints the light palette first, which is
    // the whole failure this exists to prevent.
    const after = html.slice(html.indexOf('Theme bootstrap'));
    const openTag = after.slice(after.indexOf('<script'), after.indexOf('>', after.indexOf('<script')) + 1);
    // A bare <script> tag: no type="module", no defer, no async.
    expect(openTag).toBe('<script>');
    const body = after.slice(0, after.indexOf('</script>'));
    expect(body).toContain('data-theme');
    expect(body).toContain('data-contrast');
  });

  it('sets both attributes before React mounts', () => {
    expect(html.indexOf('data-theme')).toBeLessThan(html.indexOf('/src/main.tsx'));
  });
});
