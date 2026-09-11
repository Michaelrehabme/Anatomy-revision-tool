import { useState } from 'react';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { Area } from '../../types/region';
import { BodyFigure } from '../shared/BodyFigure';
import { OnboardingAreaList } from '../Onboarding/OnboardingAreaList';
import { ONBOARDING_STEPS } from '../Onboarding/onboardingSteps';

interface MobileOnboardingProps {
  content: AnatomyContent;
  initialAreas?: readonly Area[];
  /** Called with the chosen areas; empty means "every area" (Skip). */
  onDone: (areas: Area[]) => void;
}

/** Screen 01 (mobile). Three steps; the first is the real area picker — see onboardingSteps.ts. */
export function MobileOnboarding({ content, initialAreas = [], onDone }: MobileOnboardingProps) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Set<Area>>(() => new Set(initialAreas));
  const current = ONBOARDING_STEPS[step];
  const onAreaStep = step === 0;
  const canContinue = !onAreaStep || selected.size > 0;

  const toggle = (area: Area) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(area)) next.delete(area);
      else next.add(area);
      return next;
    });
  };

  const handleNext = () => {
    if (step >= ONBOARDING_STEPS.length - 1) onDone([...selected]);
    else setStep((s) => s + 1);
  };

  return (
    <div className="flex min-h-screen flex-col px-6.5 pt-6 pb-9" style={{ background: 'var(--pg)', color: 'var(--ink)', boxSizing: 'border-box' }}>
      <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accd)' }}>
        {current.kicker}
      </div>
      <h1
        className="mt-3.5 mb-3"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 34, lineHeight: 1.06, letterSpacing: '-.018em' }}
      >
        {current.title}
      </h1>
      <p className="text-[15px] leading-relaxed" style={{ color: 'var(--ink2)' }}>
        {current.body}
      </p>

      {onAreaStep ? (
        <div className="flex-1 py-3">
          <div className="flex justify-center">
            <div style={{ width: 104 }}>
              <BodyFigure selected={selected} onToggle={toggle} />
            </div>
          </div>
          <div className="mt-1">
            <OnboardingAreaList content={content} selected={selected} onToggle={toggle} columns={2} />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center py-3.5">
          <div style={{ width: 112 }}>
            <BodyFigure selected={selected} />
          </div>
        </div>
      )}

      <div className="mb-4.5 flex gap-1.5">
        {ONBOARDING_STEPS.map((_, i) => (
          <span key={i} className="h-0.5 w-6.5 rounded-full" style={{ background: i === step ? 'var(--ink)' : 'var(--line)' }} />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleNext}
          disabled={!canContinue}
          className="flex-1 rounded-[3px] border-0 disabled:opacity-45"
          style={{ minHeight: 50, background: 'var(--acc)', color: 'var(--onacc)', font: '500 16.5px/1 var(--font-ui)' }}
        >
          {onAreaStep && selected.size === 0 ? 'Choose at least one area' : current.cta}
        </button>
        <button type="button" onClick={() => onDone([])} className="border-0 bg-transparent px-1.5" style={{ fontSize: 15, color: 'var(--ink3)' }}>
          Skip
        </button>
      </div>
    </div>
  );
}
