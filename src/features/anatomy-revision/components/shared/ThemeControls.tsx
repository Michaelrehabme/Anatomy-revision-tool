import { useTheme } from '../../context/ThemeProvider';
import { THEME_PREFERENCES, THEME_PREFERENCE_LABELS } from '../../lib/theme';

/**
 * The appearance controls, shared by Account and MobileAccount — the app
 * mounts two independent render trees, so a control written once for the
 * desktop screen would be unreachable for every phone user.
 *
 * Both settings are three-state underneath, not two: "follow my device" is a
 * real answer and a different one from having picked what the device happens
 * to be asking for today. The theme says so with a third option; contrast is a
 * switch — an accessibility toggle people look for as a switch — and says so
 * in a line underneath instead, with "Use my device setting" appearing only
 * once an explicit choice has been made.
 */
export function ThemeControls({ compact = false }: { compact?: boolean }) {
  const {
    themePreference,
    contrastPreference,
    contrast,
    deviceHighContrast,
    setThemePreference,
    setContrastPreference,
  } = useTheme();

  const label = {
    font: `500 ${compact ? 10 : 10}px/1 var(--font-mono)`,
    letterSpacing: '.16em',
    textTransform: 'uppercase',
    color: 'var(--ink3)',
  } as const;

  return (
    <div>
      <div style={label}>Theme</div>
      <div className="mt-2.5 flex gap-2" role="radiogroup" aria-label="Theme">
        {THEME_PREFERENCES.map((preference) => {
          const on = themePreference === preference;
          return (
            <button
              key={preference}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setThemePreference(preference)}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-[3px] px-3"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: compact ? 15 : 15.5,
                border: on ? '1.4px solid var(--acc)' : '1.2px solid var(--line)',
                background: on ? 'var(--accs)' : 'transparent',
                color: on ? 'var(--accd)' : 'var(--ink2)',
              }}
            >
              {THEME_PREFERENCE_LABELS[preference]}
            </button>
          );
        })}
      </div>

      <div className="mt-7" style={label}>
        Accessibility
      </div>
      <div className="mt-2.5 flex items-center gap-3.5">
        <button
          type="button"
          role="switch"
          aria-checked={contrast === 'high'}
          onClick={() => setContrastPreference(contrast === 'high' ? 'normal' : 'high')}
          className="relative flex-none rounded-full"
          style={{
            width: 52,
            height: 31,
            border: '1.2px solid var(--line)',
            background: contrast === 'high' ? 'var(--acc-fill)' : 'transparent',
            transition: 'background 120ms',
          }}
        >
          <span
            className="absolute rounded-full"
            style={{
              width: 25,
              height: 25,
              top: 2,
              left: contrast === 'high' ? 24 : 2,
              background: contrast === 'high' ? 'var(--onacc)' : 'var(--ink3)',
              boxShadow: 'var(--shadow-knob)',
              transition: 'left 120ms',
            }}
          />
        </button>
        <div className="flex-1">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: compact ? 16 : 16.5, color: 'var(--ink)' }}>
            High contrast
          </div>
          <p className="mt-0.5" style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink3)' }}>
            {contrastPreference === 'system' && deviceHighContrast
              ? 'On, because your device asks for higher contrast.'
              : 'Stronger text, solid borders and a heavier focus ring.'}
          </p>
        </div>
      </div>
      {contrastPreference !== 'system' && (
        <button
          type="button"
          onClick={() => setContrastPreference('system')}
          className="mt-2.5 border-0 bg-transparent p-0 underline"
          style={{ fontSize: 13, color: 'var(--accd)' }}
        >
          Use my device setting
        </button>
      )}
    </div>
  );
}
