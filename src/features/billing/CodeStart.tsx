/**
 * What a student with an access code does first: start revising.
 *
 * NO AREA TO PICK. The owner's decision, 28 October 2026: with every region
 * open there is nothing to choose before the first question, so the area
 * step of onboarding is skipped. The free area is asked for when the code
 * ends (App's gate asks any free account without one).
 *
 * Two ways in, and the first is the one most people want: ten mixed
 * questions from across the body at the easier level, flashcards first for
 * anything new. The other is the session builder, for a student who already
 * knows which region their course is covering.
 */

const label = {
  font: '500 10px/1 var(--font-mono)',
  letterSpacing: '.12em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink3)',
};

const prose = { font: '400 14px/1.55 var(--font-ui)', color: 'var(--ink2)', margin: 0 } as const;

// What App's quickStartAfterCode asks for: flashcard, mcq (identify and
// multiple choice), locate and OINA. No typed answers at the easier level.
const KINDS = ['Flashcards', 'Locate', 'Identify', 'Multiple choice', 'OINA'];

interface Props {
  onQuickStart: () => void;
  onCustomSession: () => void;
}

export function CodeStart({ onQuickStart, onCustomSession }: Props) {
  return (
    <section className="mt-6" aria-labelledby="code-start-heading">
      <h2 id="code-start-heading" style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '-0.01em' }}>
        How would you like to start?
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-[4px] px-5 py-5" style={{ background: 'var(--accs)', border: '1.5px solid var(--acc)' }}>
          <div className="flex justify-between gap-3" style={label}>
            <span>Quick start</span>
            <span style={{ color: 'var(--accd)' }}>Suggested</span>
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>Ten mixed questions</div>
          <p style={prose}>
            A random set from across the body at the easier level. New facts get a flashcard first, and the questions
            mix several types.
          </p>
          <ul className="flex flex-wrap gap-1.5" aria-label="Question types in the mix" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {KINDS.map((k) => (
              <li
                key={k}
                style={{ font: '500 12px/1 var(--font-ui)', padding: '6px 8px', borderRadius: 3, background: 'var(--pg)', color: 'var(--ink2)', border: '1px solid var(--line)' }}
              >
                {k}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onQuickStart}
            className="mt-1 rounded-[3px] px-5 py-3"
            style={{ font: '500 14.5px/1 var(--font-ui)', background: 'var(--acc-fill)', color: 'var(--onacc)' }}
          >
            Start 10 questions
          </button>
        </div>

        <div className="flex flex-col gap-3 rounded-[4px] px-5 py-5" style={{ border: '1.2px solid var(--line-strong)' }}>
          <div style={label}>Your choice</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>Build a custom session</div>
          <p style={prose}>
            Pick the regions and structures your course is covering, the question types, and how many questions.
          </p>
          <button
            type="button"
            onClick={onCustomSession}
            className="mt-auto rounded-[3px] px-5 py-3"
            style={{ font: '500 14.5px/1 var(--font-ui)', background: 'transparent', color: 'var(--ink)', border: '1.2px solid var(--line-strong)' }}
          >
            Build a session
          </button>
        </div>
      </div>
    </section>
  );
}
