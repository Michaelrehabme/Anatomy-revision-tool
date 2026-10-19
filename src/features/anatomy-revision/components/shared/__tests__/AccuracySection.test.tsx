import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AccuracySection } from '../AccuracySection';
import type { AnatomyContent } from '../../../hooks/useAnatomyContent';
import type { AnatomyRepository } from '../../../data/repository';
import type { UserAttempt } from '../../../types/attempt';

const EMPTY_CONTENT = { structures: [] } as unknown as AnatomyContent;

describe('AccuracySection', () => {
  it('reads the attempts once, and shows Attempts, Accuracy, the caller\'s tiles and the chart with folded filters', async () => {
    const listAttempts = vi.fn(async (): Promise<UserAttempt[]> => []);
    const repository = { listAttempts } as unknown as AnatomyRepository;
    render(
      <AccuracySection
        compact
        repository={repository}
        userId="u1"
        content={EMPTY_CONTENT}
        stats={[{ label: 'Due tomorrow', value: '7' }]}
      />,
    );
    await waitFor(() => expect(listAttempts).toHaveBeenCalledTimes(1));
    expect(listAttempts).toHaveBeenCalledWith({ userId: 'u1', limit: 5000 });
    expect(screen.getByText('Attempts')).toBeInTheDocument();
    expect(screen.getByText('Accuracy')).toBeInTheDocument();
    expect(screen.getByText('Due tomorrow')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Accuracy over time' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filters' })).toHaveAttribute('aria-expanded', 'false');
  });
});
