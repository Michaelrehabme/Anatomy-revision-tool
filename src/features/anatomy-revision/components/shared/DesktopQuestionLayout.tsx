import { createContext, useContext, type ReactNode } from 'react';
import type { AnatomyStructure } from '../../types/structure';
import { describeStructure } from '../../lib/facts';
import { FeedbackHeading } from './FeedbackHeading';
import { ConfidenceButtons } from './ConfidenceButtons';
import type { Confidence } from '../../types/attempt';
import { Button } from './Button';

/*
 * The desktop question screen (15 Nov 2026 redesign): the picture fills a
 * stage on the left, as large as the screen's height allows, and the question,
 * answers and verdict sit in a wide column on the right. A question with no
 * picture puts its prompt on the stage instead, so the screen keeps the same
 * shape from one question to the next. Desktop only: the phone has its own
 * session components under mobile/.
 */

const EYEBROW = { font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accd)' } as const;

/**
 * Height kept free under the picture for the viewer's own controls (turn,
 * zoom, the angle readout and, on some plates, a tilt row), so a picture
 * sized to the stage's height never pushes them off screen.
 */
const VIEWER_CONTROLS_ALLOWANCE = 76;

export function DesktopQuestionLayout({ stage, children }: { stage: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1" data-desktop-question>
      <div className="relative min-w-0 flex-1" style={{ background: 'var(--stage)', containerType: 'size' }}>
        <div className="absolute inset-0 flex items-center justify-center overflow-y-auto px-8 py-6">{stage}</div>
      </div>
      <div
        className="flex min-h-0 flex-none flex-col overflow-y-auto px-11 py-10"
        style={{ width: 'clamp(520px, 40vw, 760px)', borderLeft: '1px solid var(--line)' }}
      >
        {/* my-auto centres a short column and lets a long one scroll from its top. */}
        <div className="my-auto w-full">{children}</div>
      </div>
    </div>
  );
}

/** The picture, as large as the stage allows in both directions. */
export function StagePicture({ children }: { children: ReactNode }) {
  return <div style={{ width: `min(100cqw - 64px, 100cqh - 48px - ${VIEWER_CONTROLS_ALLOWANCE}px)`, minWidth: 320 }}>{children}</div>;
}

/** A question without a picture: its prompt takes the stage, large. */
export function StageWords({ label, prompt, promptLines, children }: { label: ReactNode; prompt?: ReactNode; promptLines?: string[]; children?: ReactNode }) {
  return (
    <div className="w-full max-w-[860px] px-6">
      <div style={EYEBROW}>{label}</div>
      {/* Rendered even while empty: the locate question's words can arrive a moment late, and the heading should not jump into place. */}
      {prompt !== undefined && (
        <h2 className="mt-6" style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 52, lineHeight: 1.1, letterSpacing: '-.022em', minHeight: '1.1em' }}>
          {prompt}
        </h2>
      )}
      {promptLines?.length ? (
        <ul className="mt-6 flex list-disc flex-col gap-2 pl-6" style={{ font: '400 22px/1.4 var(--font-ui)', color: 'var(--ink)' }}>
          {promptLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {children}
    </div>
  );
}

/** The question at the top of the right-hand column, when the picture has the stage. */
export function RailHeader({ label, prompt, promptLines, children }: { label: ReactNode; prompt: ReactNode; promptLines?: string[]; children?: ReactNode }) {
  return (
    <div>
      <div style={EYEBROW}>{label}</div>
      <h2 className="mt-4" style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 42, lineHeight: 1.08, letterSpacing: '-.022em' }}>
        {prompt}
      </h2>
      {promptLines?.length ? (
        <ul className="mt-4 flex list-disc flex-col gap-1.5 pl-6" style={{ font: '400 18px/1.4 var(--font-ui)', color: 'var(--ink)' }}>
          {promptLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {children}
    </div>
  );
}

interface RailFeedbackProps {
  correct: boolean;
  /** What the heading shows, and what a screen reader hears when it takes focus. */
  title: ReactNode;
  label: string;
  /** Beside the heading, small: a score such as "2/3 correct". */
  aside?: ReactNode;
  children?: ReactNode;
  rated: boolean;
  onRate: (confidence: Confidence) => void;
  onNext: () => void;
  /** The structure the question was about, for the facts card once the verdict is in. */
  structureId?: string;
  /** The verdict's own explanation: facts it already states are not repeated in the card. */
  explanation?: string;
}

/** The verdict, the confidence rating and then Next, as one card in the column. */
export function RailFeedback({ correct, title, label, aside, children, rated, onRate, onNext, structureId, explanation }: RailFeedbackProps) {
  return (
    <>
      <div className="mt-6 rounded-[3px] px-6 py-5" style={{ background: correct ? 'var(--accs)' : 'var(--acc2s)' }}>
        <div className="flex items-baseline gap-3.5">
          <FeedbackHeading
            style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 28, color: correct ? 'var(--accd)' : 'var(--acc2d)' }}
            label={label}
          >
            {title}
          </FeedbackHeading>
          {aside && <span style={{ font: '500 12.5px/1 var(--font-mono)', color: 'var(--ink3)' }}>{aside}</span>}
        </div>
        {children && (
          <div className="mt-2 text-[16.5px] leading-relaxed" style={{ color: 'var(--ink)' }}>
            {children}
          </div>
        )}
        {!rated ? (
          <div className="mt-4">
            <ConfidenceButtons onRate={onRate} />
          </div>
        ) : (
          <Button onClick={onNext} className="mt-4 min-h-[52px] w-full">
            Next
          </Button>
        )}
      </div>
      {structureId && <GlanceFacts structureId={structureId} alreadySaid={explanation} />}
    </>
  );
}

/** Every structure, so the column can show what the question was about once it is answered. */
const StructureLookupContext = createContext<Map<string, AnatomyStructure> | null>(null);
export const StructureLookupProvider = StructureLookupContext.Provider;

/**
 * Origin, insertion, nerve and action (or attachments and articulations, for
 * a bone) of the structure just asked about, under the verdict. Only ever
 * rendered after the answer is checked, and never in an exam, so it cannot
 * give an answer away.
 */
const normalise = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

const SKIPPED_FACTS = new Set(['Area', 'Clinical relevance']);

export function GlanceFacts({ structureId, alreadySaid = '' }: { structureId: string; alreadySaid?: string }) {
  const structures = useContext(StructureLookupContext);
  const structure = structures?.get(structureId);
  if (!structure) return null;
  // The area is already in the eyebrow above the question, and the clinical
  // note is what most explanations in the verdict already say.
  const said = normalise(alreadySaid);
  const facts = describeStructure(structure)
    .map((line) => {
      const at = line.indexOf(': ');
      return at < 0 ? null : { label: line.slice(0, at), value: line.slice(at + 2) };
    })
    .filter((f): f is { label: string; value: string } => !!f && !SKIPPED_FACTS.has(f.label) && f.value.trim() !== '')
    // Many explanations already spell out origin, insertion and the rest; the card is for what they leave out.
    .filter((f) => !said.includes(normalise(f.value)));
  if (!facts.length) return null;
  return (
    <section className="mt-4 rounded-[3px] px-6 py-5" style={{ border: '1px solid var(--line)' }} aria-label={`${structure.name} at a glance`}>
      <div style={EYEBROW}>{structure.name} at a glance</div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4">
        {facts.map((f) => (
          <div key={f.label}>
            <dt style={{ ...EYEBROW, color: 'var(--ink3)' }}>{f.label}</dt>
            <dd className="mt-1.5 text-[15px] leading-snug" style={{ color: 'var(--ink)' }}>
              {f.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
