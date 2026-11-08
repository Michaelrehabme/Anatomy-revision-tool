import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReportScreen, hasScreen } from '../Feedback/ReportScreen';

const blank = { subject: '', prompt: '', lines: '', choices: '', correct: '', given: '', picture: '' };

describe('what the student saw, on the Feedback page', () => {
  it('shows the picture with their tap on it', () => {
    render(
      <ReportScreen
        shown={{
          ...blank,
          subject: 'Anatomical Neck of Humerus',
          prompt: 'Locate the Anatomical Neck of Humerus',
          correct: 'Anatomical Neck of Humerus',
          given: 'Tapped 40.0% across, 45.5% down on /anatomy/landmarks/anatomical-neck-humerus-lateral.webp',
          picture: '/anatomy/landmarks/anatomical-neck-humerus-lateral.webp',
        }}
      />,
    );
    expect(screen.getByRole('img')).toHaveAttribute('src', '/anatomy/landmarks/anatomical-neck-humerus-lateral.webp');
    const ring = screen.getByLabelText('Where they tapped');
    expect(ring.style.left).toBe('40%');
    expect(ring.style.top).toBe('45.5%');
  });

  it('marks the right choice and theirs', () => {
    render(<ReportScreen shown={{ ...blank, prompt: 'What is the action of Scalene Anterior?', choices: 'A\nB\nC', correct: 'B', given: 'C' }} />);
    expect(screen.getByText(/B\s+✓ right answer/)).toBeInTheDocument();
    expect(screen.getByText(/C\s+· their pick/)).toBeInTheDocument();
  });

  it('is left out for a report sent before snapshots existed', () => {
    expect(hasScreen(undefined)).toBe(false);
    expect(hasScreen(blank)).toBe(false);
  });
});
