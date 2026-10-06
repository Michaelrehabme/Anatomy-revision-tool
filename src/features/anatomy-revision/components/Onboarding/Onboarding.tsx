import { useEffect, useRef } from 'react';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { Area } from '../../types/region';
import { BodyFigure } from '../shared/BodyFigure';
import type { UseEntitlement } from '../../hooks/useEntitlement';
import { Button } from '../shared/Button';
import { AccountForm } from '../Auth/AccountForm';
import { OnboardingAreaList } from './OnboardingAreaList';
import { useOnboardingFlow, type OnboardingStepKind } from './onboardingSteps';

interface OnboardingProps {
  /** What this account may reach. Onboarding is where a free account picks which one area that is. */
  access: UseEntitlement;
  content: AnatomyContent;
  /** Areas already on record, if any — a device re-running onboarding starts from them. */
  initialAreas?: readonly Area[];
  /** Show only these steps. Left out: every step this visitor needs. */
  only?: readonly OnboardingStepKind[];
  /** Called with the chosen areas, or null for an account that turned out to be set up already. */
  onDone: (areas: Area[] | null) => void;
}

/**
 * Screen 01. The steps are onboardingSteps.ts's, the same on mobile: for a
 * new visitor, create an account, pick the free area, learn the confidence
 * rating, learn the rhythm.
 *
 * The heading takes focus as each step arrives, so a keyboard or screen
 * reader user is told the page changed and starts reading from its top
 * rather than from a button that is no longer there.
 */
export function Onboarding({ access, content, initialAreas = [], only, onDone }: OnboardingProps) {
  const flow = useOnboardingFlow({ access, initialAreas, only, onDone });
  const { current, selected } = flow;
  const onAreaStep = current.kind === 'areas';
  const onAccountStep = current.kind === 'account';

  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [flow.index]);

  return (
    <main
      className="flex min-h-screen items-center justify-center px-8 py-10"
      style={{ background: 'var(--pg)', color: 'var(--ink)' }}
    >
      <div className="flex max-w-5xl items-center gap-20">
        <div className="flex-1">
          <div
            style={{
              font: '500 10px/1 var(--font-mono)',
              letterSpacing: '.16em',
              textTransform: 'uppercase',
              color: 'var(--accd)',
            }}
          >
            {current.kicker}
          </div>
          <h1
            ref={heading}
            tabIndex={-1}
            className="mt-5 mb-3.5 outline-none"
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

          {flow.steps.length > 1 && (
            <div className="mt-8 flex gap-1.5" aria-hidden="true">
              {flow.steps.map((_, i) => (
                <span key={i} className="h-0.5 w-6.5 rounded-full" style={{ background: i === flow.index ? 'var(--ink)' : 'var(--line)' }} />
              ))}
            </div>
          )}

          {!onAccountStep && (
            <div className="mt-8 flex items-center gap-5">
              <Button onClick={flow.next} disabled={!flow.canContinue} className="min-w-[180px] min-h-[54px] px-6">
                {onAreaStep && selected.size === 0 ? (flow.single ? 'Choose an area' : 'Choose at least one area') : current.cta}
              </Button>
              {flow.canSkip && (
                <button type="button" onClick={flow.skip} className="min-h-[44px] text-base" style={{ color: 'var(--ink3)' }}>
                  Skip
                </button>
              )}
            </div>
          )}
          {flow.areaNote && (
            <p className="mt-3 text-sm" aria-live="polite" style={{ color: 'var(--ink3)' }}>
              {flow.areaNote}
            </p>
          )}
        </div>

        {onAccountStep ? (
          <div className="w-[380px] flex-none rounded-[3px] p-8" style={{ background: 'var(--sf)', boxShadow: 'var(--shadow-card)' }}>
            {flow.settingUp ? (
              <p role="status" style={{ font: '400 15px/1.5 var(--font-ui)', color: 'var(--ink2)' }}>
                Setting up your account…
              </p>
            ) : (
              <AccountForm onDone={flow.onAccountMade} />
            )}
          </div>
        ) : (
          <div className="flex w-[420px] flex-none items-start gap-8">
            <div className="w-[170px] flex-none">
              <BodyFigure selected={selected} onToggle={onAreaStep ? flow.toggle : undefined} />
            </div>
            {onAreaStep && (
              <div className="flex-1">
                <OnboardingAreaList content={content} selected={selected} onToggle={flow.toggle} single={flow.single} />
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
