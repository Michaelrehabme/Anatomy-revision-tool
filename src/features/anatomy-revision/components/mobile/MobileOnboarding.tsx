import { lazy, Suspense, useEffect, useRef } from 'react';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { Area } from '../../types/region';
import type { UseEntitlement } from '../../hooks/useEntitlement';
import { BodyFigure } from '../shared/BodyFigure';
import { AccountForm } from '../Auth/AccountForm';
import { OnboardingAreaList } from '../Onboarding/OnboardingAreaList';
import { useOnboardingFlow, type OnboardingStepKind } from '../Onboarding/onboardingSteps';

/** "Check your inbox" — see Onboarding.tsx. */
const EmailConfirmPanel = lazy(() => import('../Auth/EmailConfirmPanel'));

interface MobileOnboardingProps {
  /** What this account may reach — see Onboarding.tsx. */
  access: UseEntitlement;
  content: AnatomyContent;
  initialAreas?: readonly Area[];
  /** Show only these steps. Left out: every step this visitor needs. */
  only?: readonly OnboardingStepKind[];
  /** Called with the chosen areas, or null for an account that turned out to be set up already. */
  onDone: (areas: Area[] | null) => void;
}

/** Screen 01 (mobile). The same steps as desktop — see onboardingSteps.ts and Onboarding.tsx. */
export function MobileOnboarding({ access, content, initialAreas = [], only, onDone }: MobileOnboardingProps) {
  const flow = useOnboardingFlow({ access, initialAreas, only, onDone });
  const { current, selected } = flow;
  // See Onboarding.tsx: the form or the confirmation may be standing in for the step.
  const onAreaStep = current.kind === 'areas' && flow.stage === 'step';
  const onAccountStep = flow.stage !== 'step';
  const confirming = flow.stage === 'confirm';

  const heading = useRef<HTMLHeadingElement>(null);
  const opened = useRef(false);
  useEffect(() => {
    // Not as the screen opens — see Onboarding.tsx.
    if (!opened.current) { opened.current = true; return; }
    heading.current?.focus();
    window.scrollTo(0, 0);
  }, [flow.index, confirming]);

  return (
    <main className="flex min-h-screen flex-col px-6.5 pt-6 pb-9" style={{ background: 'var(--pg)', color: 'var(--ink)', boxSizing: 'border-box' }}>
      <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accd)' }}>
        {current.kicker}
      </div>
      <h1
        ref={heading}
        tabIndex={-1}
        className="mt-3.5 mb-3 outline-none"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 34, lineHeight: 1.06, letterSpacing: '-.018em' }}
      >
        {current.title}
      </h1>
      <p className="text-[15px] leading-relaxed" style={{ color: 'var(--ink2)' }}>
        {current.body}
      </p>

      {onAccountStep ? (
        <div className="flex-1 pt-6">
          {confirming ? (
            <Suspense fallback={<p role="status" style={{ font: '400 15px/1.5 var(--font-ui)', color: 'var(--ink2)' }}>One moment…</p>}>
              <EmailConfirmPanel purpose="free-area" onDifferentEmail={flow.onDifferentEmail} />
            </Suspense>
          ) : flow.stage === 'setting-up' ? (
            <p role="status" style={{ font: '400 15px/1.5 var(--font-ui)', color: 'var(--ink2)' }}>
              Setting up your account…
            </p>
          ) : (
            <AccountForm onDone={flow.onAccountMade} />
          )}
        </div>
      ) : onAreaStep ? (
        <div className="flex-1 py-3">
          <div className="flex justify-center">
            <div style={{ width: 104 }}>
              <BodyFigure selected={selected} onToggle={flow.toggle} />
            </div>
          </div>
          <div className="mt-1">
            <OnboardingAreaList content={content} selected={selected} onToggle={flow.toggle} columns={2} single={flow.single} />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center py-3.5">
          <div style={{ width: 112 }}>
            <BodyFigure selected={selected} />
          </div>
        </div>
      )}

      {flow.steps.length > 1 && (
        <div className="mb-4.5 flex gap-1.5" aria-hidden="true">
          {flow.steps.map((_, i) => (
            <span key={i} className="h-0.5 w-6.5 rounded-full" style={{ background: i === flow.index ? 'var(--ink)' : 'var(--line)' }} />
          ))}
        </div>
      )}

      {!onAccountStep && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={flow.next}
            disabled={!flow.canContinue}
            className="flex-1 rounded-[3px] border-0 disabled:opacity-45"
            style={{ minHeight: 50, background: 'var(--acc-fill)', color: 'var(--onacc)', font: '500 16.5px/1 var(--font-ui)' }}
          >
            {onAreaStep && selected.size === 0 ? (flow.single ? 'Choose an area' : 'Choose at least one area') : current.cta}
          </button>
          {flow.canSkip && (
            <button type="button" onClick={flow.skip} className="border-0 bg-transparent px-1.5" style={{ minHeight: 44, fontSize: 15, color: 'var(--ink3)' }}>
              Skip
            </button>
          )}
        </div>
      )}
      {flow.areaNote && (
        <p className="pt-3" aria-live="polite" style={{ font: '400 12.5px/1.5 var(--font-ui)', color: 'var(--ink3)' }}>
          {flow.areaNote}
        </p>
      )}
    </main>
  );
}
