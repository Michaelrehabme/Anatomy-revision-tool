import { useEffect } from 'react';
import { trackStep, type FunnelStep } from './data/telemetry';

/**
 * Records a funnel step when the screen that marks it is shown, or, with
 * `when`, once something on it becomes true. See data/telemetry.ts for why
 * calling it on every render costs nothing.
 */
export function useTrackStep(step: FunnelStep, when = true): void {
  useEffect(() => {
    if (when) trackStep(step);
  }, [step, when]);
}
