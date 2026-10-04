import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AccessibilityPage } from '../AccessibilityPage';

/**
 * A statement is assessed by someone who will test one of its claims. What is
 * pinned here is that it admits the gaps rather than claiming full compliance
 * — an overstatement is worse than no statement, because the first thing a
 * reviewer does is try to disprove something.
 *
 * Revised 5 October 2026. The second block pins the three rules that revision
 * was written to (see the comment at the top of AccessibilityPage.tsx): what
 * was tested and how rather than a standard met, nothing "announced" that no
 * screen reader has been heard to announce, and locate described as it is.
 */

function renderPage() {
  const { container } = render(<MemoryRouter><AccessibilityPage /></MemoryRouter>);
  return container.textContent ?? '';
}

describe('AccessibilityPage', () => {
  it('claims partial compliance, not full', () => {
    renderPage();
    expect(screen.getByText(/Partially compliant/)).toBeTruthy();
    expect(screen.queryByText(/fully compliant/i)).toBeNull();
  });

  it('names the locate list as not equivalent rather than as a solution', () => {
    const text = renderPage();
    expect(screen.getByText(/Locate has no equivalent without sight/)).toBeTruthy();
    expect(text).toMatch(/a different and easier exercise than finding a structure on an image/);
    expect(text).toMatch(/about a third of locate questions — the list contains only the answer/);
  });

  it('admits there has been no independent audit', () => {
    renderPage();
    expect(screen.getByText(/No independent audit has been carried out/)).toBeTruthy();
  });

  it('gives a route to report a problem and an escalation', () => {
    renderPage();
    expect(screen.getByRole('link', { name: /michael@rehabme.uk/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /equalityadvisoryservice/ })).toBeTruthy();
  });

  it('tells an institution plainly what does not exist', () => {
    renderPage();
    expect(screen.getByText(/no formal conformance report, ISO certification or third-party/)).toBeTruthy();
  });

  it('commits the outstanding work to a deadline', () => {
    renderPage();
    expect(screen.getByText(/Before the first pilot cohort completes a term/)).toBeTruthy();
  });
});

describe('AccessibilityPage, as revised on 5 October 2026', () => {
  it('is dated', () => {
    const text = renderPage();
    expect(text).toMatch(/5 October 2026/);
    expect(text).toMatch(/last revised on 5 October 2026/);
  });

  it('says what was tested and how, and makes no conformance claim', () => {
    const text = renderPage();
    expect(text).toMatch(/We do not claim to meet it/);
    expect(text).toMatch(/axe-core, using its WCAG 2\.0 and 2\.1 level A and AA rules/);
    expect(text).toMatch(/passing it is not the same as meeting the\s+standard/);
    expect(text).not.toMatch(/tested against WCAG/i);
    expect(text).not.toMatch(/\b(conforms|complies|meets WCAG|WCAG[- ]compliant)\b/i);
  });

  it('does not say a screen reader announces or reads anything, because none has been run', () => {
    const text = renderPage();
    expect(text).toMatch(/We have not tested with a screen reader/);
    expect(text).toMatch(/No session has been\s+run with NVDA or VoiceOver/);
    expect(text).not.toMatch(/\bannounced\b|\bannounces\b|reads it straight away|is read out/i);
  });

  it('says who did the testing without dressing it up', () => {
    const text = renderPage();
    expect(text).toMatch(/done by the person who builds the app, who is a student and not an accessibility\s+specialist/);
    expect(text).not.toMatch(/therapist|clinician|practitioner|expert/i);
  });

  it('describes locate as it is and promises nothing about it', () => {
    const text = renderPage();
    expect(text).toMatch(/The picture itself cannot be operated from a keyboard/);
    expect(text).toMatch(/Locate without sight is being worked on\. This page will describe what is built when it is\s+built\./);
    expect(text).not.toMatch(/crosshair|we will (add|build|ship)|coming soon/i);
  });

  it('limits picture descriptions to sessions', () => {
    const text = renderPage();
    expect(text).toMatch(/cover sessions only, and have not been heard on a\s+screen reader/);
    expect(text).toMatch(/pictures on a structure card and in the Atlas have only a name/);
  });

  it('says End session asks first, now that it does', () => {
    const text = renderPage();
    expect(text).toMatch(/Ending a session asks first/);
    expect(text).not.toMatch(/Ending a session has no confirmation/);
  });

  it('records the achievements contrast failure as found and removed, not as never there', () => {
    const text = renderPage();
    expect(text).toMatch(/achievements not yet earned dimmed below 4\.5:1\. The dimming has been removed/);
  });
});
