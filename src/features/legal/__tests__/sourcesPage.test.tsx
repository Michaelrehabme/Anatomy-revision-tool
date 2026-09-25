import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SourcesPage } from '../SourcesPage';
import { LEGAL_PATHS } from '../legalPaths';
import LegalRoutes from '../LegalRoutes';
import { FAMILIES, WORKS } from '../data/provenance.generated';
import { CATEGORIES } from '../../anatomy-revision/types/structure';

/**
 * /sources is the one page whose subject is its own accuracy, so the ways it
 * breaks are quiet ones: a number typed in rather than derived and then left
 * behind by the content; the AI disclosure softened by a later edit until it
 * says nothing; a sixth structure family shipping with no provenance section
 * and nobody noticing because the page still renders. Each test below is one
 * of those.
 */

function page() {
  render(<MemoryRouter><SourcesPage /></MemoryRouter>);
}

describe('SourcesPage', () => {
  it('says the content was AI-drafted, without hedging it', () => {
    page();
    // The whole point of the page. If this sentence goes, the page becomes a
    // list of impressive-looking sources with the important part removed.
    expect(screen.getByText(/drafted with AI assistance/i)).toBeTruthy();
  });

  it('keeps the not-a-clinical-resource warning, which naming sources makes MORE necessary', () => {
    page();
    expect(screen.getByText(/not a clinical, diagnostic or treatment resource/i)).toBeTruthy();
  });

  it('has a section for every structure family, so a new one cannot ship unstated', () => {
    page();
    expect(FAMILIES.map((f) => f.category).sort()).toEqual([...CATEGORIES].sort());
  });

  it('states no count that is not derived from the content', () => {
    page();
    const total = FAMILIES.reduce((n, f) => n + f.total, 0);
    const checked = FAMILIES.reduce((n, f) => n + f.checked, 0);
    // A literal typed into the prose would survive a content change; these
    // assertions fail the moment the page and the data disagree.
    expect(screen.getByText(new RegExp(`LocusMSK holds ${total} structures`))).toBeTruthy();
    expect(screen.getByText(new RegExp(`${checked} of the ${total} structures`))).toBeTruthy();
  });

  it('admits, per family, what has not been checked', () => {
    page();
    const untouched = FAMILIES.filter((f) => f.method === 'ai-drafted' && f.checked === 0);
    if (untouched.length > 0) {
      expect(screen.getByText(/have not been checked against a published work at all/i)).toBeTruthy();
    }
    // The ligament caveat is the one most likely to be lost in an edit: their
    // ATTACHMENTS were checked, their descriptions were not.
    expect(screen.getByText(/descriptions have not been checked to the same/i)).toBeTruthy();
  });

  it('names the Visible Body link in the muscle chain', () => {
    page();
    // /attributions named the deck and stopped there for months. The chain is
    // Visible Body -> the deck -> here, and both pages now have to say so.
    expect(screen.getByText(/drew on Visible Body/i)).toBeTruthy();
  });

  it('names no work it has decided not to cite', () => {
    page();
    // Mirrors EXCLUDED_WORKS in scripts/lib/provenance.ts. Kept here as well
    // as in the validator because a test failure names the page, and this is
    // the artifact a reader actually sees.
    for (const banned of [/kenhub/i, /teachmeanatomy/i, /imaios/i, /complete anatomy/i]) {
      expect(WORKS.some((w) => banned.test(`${w.title} ${w.url ?? ''}`))).toBe(false);
    }
  });

  it('gives every listed work a citation count, so an unused one is visible', () => {
    for (const work of WORKS) expect(work.citations).toBeGreaterThan(0);
  });
});

describe('legal routing', () => {
  it.each([...LEGAL_PATHS])('%s resolves to a real page, not the catch-all redirect', (path) => {
    // The two-place footgun: a path has to be in LEGAL_PATHS (or App.tsx's
    // onboarding gate redirects it away before the router sees it) AND in the
    // route table (or it falls through to <Navigate to="/">). Either half
    // alone looks correct in review and leaves the page unreachable cold.
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<div data-testid="redirected-home" />} />
          <Route path="*" element={<LegalRoutes />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('redirected-home')).toBeNull();
  });
});
