import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LegalLinks } from '../LegalLinks';
import { LEGAL_PATHS } from '../../../../legal/legalPaths';

/**
 * A link here to a path missing from LEGAL_PATHS would look fine and go
 * nowhere: App.tsx's onboarding gate redirects anything it does not know
 * before the router sees it. So every link must be a gated legal path.
 */
describe('LegalLinks', () => {
  it('links the four fine-print pages, each to a path the gate lets through', () => {
    render(
      <MemoryRouter>
        <LegalLinks />
      </MemoryRouter>,
    );
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/sources', '/privacy', '/attributions', '/terms']);
    for (const href of hrefs) expect(LEGAL_PATHS).toContain(href);
  });
});
