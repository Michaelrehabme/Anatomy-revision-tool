import { useState } from 'react';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { Area } from '../../types/region';
import { BodyFigure } from '../shared/BodyFigure';
import { Button } from '../shared/Button';
import { OnboardingAreaList } from './OnboardingAreaList';
import { ONBOARDING_STEPS } from './onboardingSteps';

interface OnboardingProps {
  content: AnatomyContent;
  /** Areas already on record, if any — a device re-running onboarding starts from them. */
  initialAreas?: readonly Area[];
  /** Called with the chosen areas; empty means "every area" (Skip). */
  onDone: (areas: Area[]) => void;
}

/**
 * Screen 01. Three steps, the same three as mobile: choose areas, learn the
 * confidence rating, learn the rhythm. The first step is the actual area
 * picker, and what it collects becomes the default scope of every session
 * from here on — the single most useful thing onboarding can know.
 */
export function Onboarding({ content, initialAreas = [], onDone }: OnboardingProps) {
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
    <div
      className="flex min-h-screen items-center justify-center px-8"
      style={{ background: 'var(--pg)', color: 'var(--ink)' }}
    >
      <div className="flex max-w-5xl items-center gap-20">
        <div className="flex-1">
          <div
            style={{
              font: '500 10px/1 var(--font-mono)',
              letterSpacing: '.16em',
              textTransform: 'uppercase',
              color: 'var(--acc)',
            }}
          >
            {current.kicker}
          </div>
          <h1
            className="mt-5 mb-3.5"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 54,
              lineHeight: 1.02,
              letterSpacing: '-.026em',
            }}
          >
            {current.title}
          </h1>
          <p className="max-w-md text-lg leading-relaxed" style={{ color: 'var(--ink2)' }}>
            {current.body}
          </p>

          <div className="mt-8 flex gap-1.5">
            {ONBOARDING_STEPS.map((_, i) => (
              <span key={i} className="h-0.5 w-6.5 rounded-full" style={{ background: i === step ? 'var(--ink)' : 'var(--line)' }} />
            ))}
          </div>

          <div className="mt-8 flex items-center gap-5">
            <Button onClick={handleNext} disabled={!canContinue} className="min-w-[180px] min-h-[54px] px-6">
              {onAreaStep && selected.size === 0 ? 'Choose at least one area' : current.cta}
            </Button>
            <button type="button" onClick={() => onDone([])} className="text-base" style={{ color: 'var(--ink3)' }}>
              Skip
            </button>
          </div>
          {onAreaStep && (
            <p className="mt-3 text-sm" style={{ color: 'var(--ink3)' }}>
              Skip keeps every area in play.
            </p>
          )}
        </div>

        <div className="flex w-[420px] flex-none items-start gap-8">
          <div className="w-[170px] flex-none">
            <BodyFigure selected={selected} onToggle={onAreaStep ? toggle : undefined} />
          </div>
          {onAreaStep && (
            <div className="flex-1">
              <OnboardingAreaList content={content} selected={selected} onToggle={toggle} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
