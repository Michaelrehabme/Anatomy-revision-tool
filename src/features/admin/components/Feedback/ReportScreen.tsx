import type { CSSProperties } from 'react';
import type { QuestionShown } from '../../../feedback/data/rows';
import { parseTap } from '../../../feedback/data/tapAnswer';

/**
 * What the student had on screen when they reported a question (owner,
 * 8 Nov 2026: "include the screen that was shown"): the picture, the prompt,
 * the choices with the right one marked, and their answer. A locate report
 * carries the tap (feedback/data/tapAnswer.ts) and it is drawn on the picture,
 * on the frame they had turned to.
 *
 * Folded away under each report, because the list is read first and a
 * picture per row would push it off the screen.
 */

const label: CSSProperties = { font: '500 10px/1 var(--font-mono)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink3)' };
const text: CSSProperties = { font: '400 13.5px/1.45 var(--font-ui)', color: 'var(--ink)', whiteSpace: 'pre-wrap', margin: 0 };

function lines(value: string | undefined): string[] {
  return (value ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
}

export function hasScreen(shown: QuestionShown | undefined): boolean {
  return !!shown && Object.values(shown).some((value) => !!value);
}

export function ReportScreen({ shown }: { shown: QuestionShown }) {
  const tap = parseTap(shown.given);
  const picture = tap?.picture ?? shown.picture;
  const choices = lines(shown.choices);
  const correct = new Set(lines(shown.correct));
  const given = new Set(tap ? [] : lines(shown.given).flatMap((g) => g.split(/,\s*/)));

  return (
    <details className="mt-2">
      <summary style={{ font: '500 12.5px/1.4 var(--font-ui)', color: 'var(--ink2)', cursor: 'pointer' }}>What they saw</summary>
      <div className="mt-3 grid gap-3" style={{ maxWidth: 420 }}>
        {picture && (
          <div style={{ position: 'relative', border: '1px solid var(--line)', background: '#fff' }}>
            <img src={picture} alt={`The picture shown: ${picture}`} style={{ display: 'block', width: '100%', height: 'auto' }} />
            {tap && (
              <span
                aria-label="Where they tapped"
                style={{
                  position: 'absolute',
                  left: `${tap.x * 100}%`,
                  top: `${tap.y * 100}%`,
                  width: 18,
                  height: 18,
                  transform: 'translate(-50%, -50%)',
                  borderRadius: '50%',
                  border: '3px solid #e0245e',
                  boxShadow: '0 0 0 2px #fff',
                }}
              />
            )}
          </div>
        )}
        {shown.prompt && <p style={text}>{shown.prompt}</p>}
        {lines(shown.lines).length > 0 && (
          <ul style={{ ...text, paddingLeft: 18 }}>
            {lines(shown.lines).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
        {choices.length > 0 && (
          <div className="grid gap-1">
            <span style={label}>Choices</span>
            {choices.map((choice) => (
              <span
                key={choice}
                style={{
                  ...text,
                  padding: '4px 8px',
                  border: '1px solid var(--line)',
                  fontWeight: correct.has(choice) ? 600 : 400,
                  background: correct.has(choice) ? 'var(--accs)' : given.has(choice) ? 'var(--acc2s)' : 'transparent',
                }}
              >
                {choice}
                {correct.has(choice) ? '  ✓ right answer' : given.has(choice) ? '  · their pick' : ''}
              </span>
            ))}
          </div>
        )}
        {shown.correct && choices.length === 0 && (
          <div className="grid gap-1">
            <span style={label}>Right answer</span>
            <p style={text}>{shown.correct}</p>
          </div>
        )}
        {shown.given && (
          <div className="grid gap-1">
            <span style={label}>Their answer</span>
            <p style={text}>{tap ? `Tapped where the red ring is${tap.picture && tap.picture !== shown.picture ? ' (on a turned frame)' : ''}` : shown.given}</p>
          </div>
        )}
      </div>
    </details>
  );
}
