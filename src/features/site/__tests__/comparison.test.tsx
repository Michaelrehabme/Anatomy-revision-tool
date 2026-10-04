import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ComparisonPage } from '../components/ComparisonPage';
import { COMPARISON_ROWS, RECHECK_BY, asOf } from '../data/comparison';
import { FAMILIES } from '../../legal/data/provenance.generated';
import { PLANS } from '../../billing/lib/checkout';

/**
 * The comparison page makes statements about other people's products, which is
 * the one kind of claim that goes false without anybody here touching it. The
 * roadmap's bar is "every comparative line points at a dated screenshot", so
 * that is what these tests hold: a row with no screenshot, a screenshot filed
 * under a different date, or a row rendered without its date all fail.
 */

// vitest runs from the repository root (see marketingPanels.test.ts).
const ROOT = process.cwd();
const evidenceDir = (capturedOn: string) => join(ROOT, 'docs', 'evidence', `competitors-${capturedOn}`);

afterEach(cleanup);

function page() {
  return render(<MemoryRouter><ComparisonPage /></MemoryRouter>);
}

describe('comparison evidence', () => {
  it.each(COMPARISON_ROWS)('$product points at a screenshot that is on file', (row) => {
    expect(row.evidence.file).toMatch(/\.png$/);
    expect(row.evidence.capturedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(existsSync(join(evidenceDir(row.evidence.capturedOn), row.evidence.file))).toBe(true);
  });

  it.each(COMPARISON_ROWS)('$product cites the page its screenshot was taken from', (row) => {
    // The folder's README is the capture log: file, URL, time. A row whose URL
    // is not on the same README line as its file names a page nobody captured.
    const readme = readFileSync(join(evidenceDir(row.evidence.capturedOn), 'README.md'), 'utf8');
    const line = readme.split('\n').find((l) => l.includes(row.evidence.file));
    expect(line).toBeDefined();
    expect(line).toContain(row.evidence.url);
  });

  it.each(COMPARISON_ROWS)('$product states at least one thing, and nothing it has no line for', (row) => {
    expect(row.lines.length).toBeGreaterThan(0);
    for (const line of row.lines) {
      expect(line.label.trim()).not.toBe('');
      expect(line.text.trim()).not.toBe('');
    }
  });

  it('is filed in docs/CLAIMS.md, which the page must not ship without', () => {
    const claims = readFileSync(join(ROOT, 'docs', 'CLAIMS.md'), 'utf8');
    for (const row of COMPARISON_ROWS) {
      expect(claims).toContain(`competitors-${row.evidence.capturedOn}/${row.evidence.file}`);
    }
  });

  it('has a re-check date after every capture', () => {
    for (const row of COMPARISON_ROWS) expect(RECHECK_BY > row.evidence.capturedOn).toBe(true);
  });

  it('leaves out Quizlet, whose capture is a bot check and shows no price', () => {
    expect(COMPARISON_ROWS.some((r) => /quizlet/i.test(r.product))).toBe(false);
    // The file exists, so somebody will be tempted. It is a 403 page.
    expect(readdirSync(evidenceDir('2026-09-28'))).toContain('quizlet-upgrade.png');
  });
});

describe('ComparisonPage', () => {
  it('prints the date beside every row, tied to that row\'s screenshot', () => {
    const { container } = page();
    for (const row of COMPARISON_ROWS) {
      const block = container.querySelector(`[data-comparison-row="${row.id}"]`);
      expect(block).not.toBeNull();
      const cite = block!.querySelector(`[data-evidence="${row.evidence.file}"]`);
      expect(cite?.textContent).toContain(asOf(row.evidence));
      expect(cite?.querySelector('a')?.getAttribute('href')).toBe(row.evidence.url);
    }
    // No competitor block without a row behind it.
    expect(container.querySelectorAll('[data-comparison-row]').length).toBe(COMPARISON_ROWS.length);
  });

  it('says dollars are dollars rather than converting them', () => {
    const { container } = page();
    for (const row of COMPARISON_ROWS.filter((r) => r.currency === 'USD')) {
      expect(container.querySelector(`[data-comparison-row="${row.id}"]`)?.textContent).toMatch(/not converted/);
    }
  });

  it('derives its own numbers instead of typing them', () => {
    page();
    const total = FAMILIES.reduce((n, f) => n + f.total, 0);
    expect(screen.getByText(new RegExp(`${total} structures`))).toBeTruthy();
    for (const plan of PLANS) expect(screen.getByText(`${plan.price} ${plan.per}`)).toBeTruthy();
  });

  it('makes no claim about quality, accuracy or outcomes, and uses no superlative', () => {
    const { container } = page();
    const text = container.textContent ?? '';
    // "better" appears once, in the sentence that declines to say who is.
    expect(text.match(/\bbetter\b/gi)?.length ?? 0).toBe(1);
    expect(text).toMatch(/does not say which product is better/);
    expect(text).not.toMatch(/\b(best|cheaper|cheapest|worse|only one|most complete|more accurate|score[ds]? higher|faster)\b/i);
  });

  it('admits what LocusMSK does not have', () => {
    page();
    expect(screen.getByText(/What LocusMSK does not have/)).toBeTruthy();
  });

  it('is marked as a draft and kept out of search results', () => {
    page();
    expect(screen.getByRole('note').textContent).toMatch(/Draft/);
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toMatch(/noindex/);
  });

  it('is not linked from the pages a visitor can reach', () => {
    // Unlinked until approved. A grep, because the links live in JSX strings.
    for (const file of [
      'src/features/site/components/MarketingHome.tsx',
      'src/features/legal/LegalLayout.tsx',
      'src/features/billing/PricingPage.tsx',
      'src/features/anatomy-revision/components/shared/LegalLinks.tsx',
    ]) {
      expect(readFileSync(join(ROOT, file), 'utf8')).not.toMatch(/["'`]\/compare\b/);
    }
  });
});
