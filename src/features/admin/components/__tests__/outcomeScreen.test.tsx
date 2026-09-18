import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OutcomeScreen } from '../Analytics/OutcomeScreen';
import { computeOutcomeComparison } from '../../lib/outcomeComparison';
import { summariseDiagnostics, DIAGNOSTIC_VERSION, type DiagnosticResult } from '../../../anatomy-revision/lib/diagnostic';
import type { UserAttempt } from '../../../anatomy-revision/types/attempt';

/**
 * Every number on this screen is one somebody intends to say to a course
 * leader, so what is tested is the refusals: that a claim appears only when the
 * library licenses it, that the caveats are always present, and that the
 * confounded measures are labelled as not for quoting rather than quietly
 * omitted — an absent figure invites someone to go and compute it themselves.
 */

let seq = 0;
function attempt(userId: string, sessionId: string, correct: boolean, structureId: string): UserAttempt {
  seq += 1;
  return {
    id: `a${seq}`, userId, sessionId, questionId: `q${seq}`, questionType: 'mcq',
    structureId, promptKind: 'identify', region: 'shoulder-arm', category: 'muscle',
    correct, attemptNumber: 1,
    timestamp: `2026-10-${String(1 + (seq % 28)).padStart(2, '0')}T09:00:00.000Z`,
  };
}

/** A cohort big enough to be reportable. */
function reportableAttempts(): UserAttempt[] {
  const rows: UserAttempt[] = [];
  for (let u = 0; u < 10; u++) {
    for (let s = 0; s < 12; s++) {
      for (let k = 0; k < 4; k++) rows.push(attempt(`keen${u}`, `keen${u}-${s}`, true, `st-${k}`));
    }
  }
  for (let u = 0; u < 10; u++) {
    for (let s = 0; s < 2; s++) {
      for (let k = 0; k < 4; k++) rows.push(attempt(`light${u}`, `light${u}-${s}`, k === 0, `st-${k}`));
    }
  }
  return rows;
}

function diagnostics(n: number): DiagnosticResult[] {
  const rows: DiagnosticResult[] = [];
  for (let i = 0; i < n; i++) {
    rows.push({ userId: `u${i}`, cohortId: 'c1', version: DIAGNOSTIC_VERSION, phase: 'baseline', correct: 5, total: 15, takenAt: '2026-10-01T09:00:00.000Z' });
    rows.push({ userId: `u${i}`, cohortId: 'c1', version: DIAGNOSTIC_VERSION, phase: 'followUp', correct: 11, total: 15, takenAt: '2026-12-10T09:00:00.000Z' });
  }
  return rows;
}

describe('OutcomeScreen', () => {
  it('says plainly that there is no claim yet, rather than showing a weak one', () => {
    render(<OutcomeScreen comparison={computeOutcomeComparison([])} />);
    expect(screen.getByText('No claim yet')).toBeTruthy();
    expect(screen.getByText(/normal state for most of a pilot/)).toBeTruthy();
  });

  it('shows the sentence once the data supports one', () => {
    render(<OutcomeScreen comparison={computeOutcomeComparison(reportableAttempts())} />);
    expect(screen.getByText('The claim this supports')).toBeTruthy();
    expect(screen.getByText(/more structures on average/)).toBeTruthy();
  });

  it('always shows the caveats, at full weight', () => {
    render(<OutcomeScreen comparison={computeOutcomeComparison(reportableAttempts())} />);
    expect(screen.getByText('Say these too')).toBeTruthy();
    expect(screen.getByText(/Association, not causation/)).toBeTruthy();
  });

  it('labels the confounded measures instead of hiding them', () => {
    render(<OutcomeScreen comparison={computeOutcomeComparison(reportableAttempts())} />);
    // Omitting them would invite somebody to compute them independently and
    // quote them without the warning.
    expect(screen.getByText('Not for quoting')).toBeTruthy();
    // The phrase also appears in the caveat list, so assert on this
    // paragraph's own wording rather than a string both share.
    expect(screen.getByText(/holds accuracy near a target/)).toBeTruthy();
  });

  it('shows the before-and-after when paired sittings exist', () => {
    render(
      <OutcomeScreen
        comparison={computeOutcomeComparison(reportableAttempts())}
        diagnostics={summariseDiagnostics(diagnostics(12))}
      />,
    );
    expect(screen.getByText('Paired students')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.queryByText(/Too few paired sittings/)).toBeNull();
  });

  it('warns when too few students sat both', () => {
    render(
      <OutcomeScreen
        comparison={computeOutcomeComparison(reportableAttempts())}
        diagnostics={summariseDiagnostics(diagnostics(3))}
      />,
    );
    expect(screen.getByText(/Too few paired sittings/)).toBeTruthy();
    expect(screen.getByText(/bias the mean by exactly who dropped out/)).toBeTruthy();
  });

  it('omits the before-and-after section entirely when no sittings exist', () => {
    render(<OutcomeScreen comparison={computeOutcomeComparison(reportableAttempts())} />);
    expect(screen.queryByText('Paired students')).toBeNull();
  });
});
