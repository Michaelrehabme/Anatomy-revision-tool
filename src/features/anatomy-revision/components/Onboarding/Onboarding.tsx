import { BodyFigure } from '../shared/BodyFigure';
import { Button } from '../shared/Button';
import type { Region } from '../../types/region';

const NOOP = new Set<Region>();

interface OnboardingProps {
  onDone: () => void;
}

/**
 * Screen 01. Single condensed step (the mockup's copy is placeholder-grade
 * per the design handoff doc — "should be rewritten before shipping" — so
 * this keeps to one screen rather than inventing two more steps of filler
 * copy). Continue and Skip both just mark onboarding complete.
 */
export function Onboarding({ onDone }: OnboardingProps) {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-8"
      style={{ background: 'var(--pg)', color: 'var(--ink)' }}
    >
      <div className="flex max-w-4xl items-center gap-24">
        <div className="flex-1">
          <div
            style={{
              font: '500 10px/1 var(--font-mono)',
              letterSpacing: '.16em',
              textTransform: 'uppercase',
              color: 'var(--acc)',
            }}
          >
            Welcome
          </div>
          <h1
            className="mt-5 mb-3.5"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 60,
              lineHeight: 1.02,
              letterSpacing: '-.026em',
            }}
          >
            Learn the map, not the list.
          </h1>
          <p className="max-w-md text-lg leading-relaxed" style={{ color: 'var(--ink2)' }}>
            Muscles stick when you know where they sit. Every question ties a name back to a place on
            the body.
          </p>
          <div className="mt-11 flex items-center gap-5">
            <Button onClick={onDone} className="min-w-[180px] min-h-[54px]">
              Continue
            </Button>
            <button type="button" onClick={onDone} className="text-base" style={{ color: 'var(--ink3)' }}>
              Skip
            </button>
          </div>
        </div>
        <div className="w-[220px] flex-none">
          <BodyFigure selected={NOOP} onToggle={() => {}} />
        </div>
      </div>
    </div>
  );
}
