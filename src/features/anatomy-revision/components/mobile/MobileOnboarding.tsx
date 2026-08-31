import { useState } from 'react';
import { RegionBodyFigure } from '../shared/BodyFigure';
import type { Region } from '../../types/region';
import { REGIONS } from '../../types/region';

interface OnboardingStep {
  kicker: string;
  title: string;
  body: string;
  cta: string;
  highlightRegions: Region[];
}

const STEPS: OnboardingStep[] = [
  {
    kicker: 'Step one of three',
    title: 'Which body are you learning?',
    body: 'Choose the regions you actually need. The pool is built from your selection — you will never be asked about the forearm if you did not ask for the forearm.',
    cta: 'Choose regions',
    highlightRegions: ['shoulder-arm', 'back-core'],
  },
  {
    kicker: 'Step two of three',
    title: 'Answer honestly, not correctly',
    body: 'After each question you rate how it felt. Hard brings a structure back tomorrow; easy pushes it out for a week or more. Guessing right and marking it easy only hurts you.',
    cta: 'Understood',
    highlightRegions: ['forearm-hand'],
  },
  {
    kicker: 'Step three of three',
    title: 'Ten minutes, most days',
    body: 'Short and daily beats an hour on Sunday. We will show what is due when you open the app, and nothing else.',
    cta: 'Start learning',
    highlightRegions: [...REGIONS],
  },
];

interface MobileOnboardingProps {
  onDone: () => void;
}

/** Screen 01 (mobile). Three real steps — the mockup ships real copy per step, unlike the desktop pass's condensed placeholder-copy version. */
export function MobileOnboarding({ onDone }: MobileOnboardingProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const fills = Object.fromEntries(current.highlightRegions.map((r) => [r, 'var(--acc)'])) as Partial<Record<Region, string>>;

  const handleNext = () => {
    if (step >= STEPS.length - 1) onDone();
    else setStep((s) => s + 1);
  };

  return (
    <div className="flex min-h-screen flex-col px-6.5 pt-6 pb-9" style={{ background: 'var(--pg)', color: 'var(--ink)', boxSizing: 'border-box' }}>
      <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accd)' }}>
        {current.kicker}
      </div>
      <h1
        className="mt-3.5 mb-3"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 36, lineHeight: 1.06, letterSpacing: '-.018em' }}
      >
        {current.title}
      </h1>
      <p className="text-[15.5px] leading-relaxed" style={{ color: 'var(--ink2)' }}>
        {current.body}
      </p>

      <div className="flex flex-1 items-center justify-center py-3.5">
        <div style={{ width: 112 }}>
          <RegionBodyFigure fills={fills} />
        </div>
      </div>

      <div className="mb-4.5 flex gap-1.5">
        {STEPS.map((_, i) => (
          <span key={i} className="h-0.5 w-6.5 rounded-full" style={{ background: i === step ? 'var(--ink)' : 'var(--line)' }} />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleNext}
          className="flex-1 rounded-[3px] border-0"
          style={{ minHeight: 50, background: 'var(--acc)', color: 'var(--onacc)', font: '500 16.5px/1 var(--font-ui)' }}
        >
          {current.cta}
        </button>
        <button type="button" onClick={onDone} className="border-0 bg-transparent px-1.5" style={{ fontSize: 15, color: 'var(--ink3)' }}>
          Skip
        </button>
      </div>
    </div>
  );
}
