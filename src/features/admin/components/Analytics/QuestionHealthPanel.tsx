import { useState } from 'react';
import { useQuestionHealth } from '../../hooks/useQuestionHealth';
import type { QuestionHealthFlagType } from '../../types/analytics';
import { Button } from '../../../anatomy-revision/components/shared/Button';

const FLAG_LABELS: Record<QuestionHealthFlagType, string> = {
  'low-accuracy': 'Likely broken',
  'no-discrimination': 'No discriminatory value',
  'slow-despite-accurate': 'Unclear wording',
};

const FLAG_COLORS: Record<QuestionHealthFlagType, { bg: string; fg: string }> = {
  'low-accuracy': { bg: 'var(--acc2s)', fg: 'var(--acc2d)' },
  'no-discrimination': { bg: 'var(--line)', fg: 'var(--ink2)' },
  'slow-despite-accurate': { bg: 'var(--accs)', fg: 'var(--accd)' },
};

export function QuestionHealthPanel() {
  const { flags, loading, error, markReviewed } = useQuestionHealth();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleReview = async (questionId: string, flagType: QuestionHealthFlagType) => {
    setPendingId(questionId);
    try {
      await markReviewed(questionId, flagType);
    } finally {
      setPendingId(null);
    }
  };

  if (loading) {
    return (
      <div className="mt-10 text-sm" style={{ color: 'var(--ink3)' }}>
        Loading attempt data…
      </div>
    );
  }
  if (error) {
    return (
      <div className="mt-10 text-sm" style={{ color: 'var(--acc2d)' }}>
        {error}
      </div>
    );
  }
  if (flags.length === 0) {
    return (
      <div className="mt-10 text-sm" style={{ color: 'var(--ink3)' }}>
        No flagged questions right now — nothing statistically suspicious, or everything's already been reviewed.
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col">
      {flags.map((flag) => {
        const colors = FLAG_COLORS[flag.flagType];
        return (
          <div
            key={`${flag.questionId}-${flag.flagType}`}
            className="flex items-start justify-between gap-6 py-4"
            style={{ borderBottom: '1px solid var(--line)' }}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="rounded-[3px] px-2 py-0.5"
                  style={{ font: '500 10.5px/1.6 var(--font-mono)', background: colors.bg, color: colors.fg }}
                >
                  {FLAG_LABELS[flag.flagType]}
                </span>
                <span style={{ font: '500 14px/1.3 var(--font-ui)', color: 'var(--ink)' }}>{flag.structureName}</span>
              </div>
              <p className="mt-1.5 text-sm" style={{ color: 'var(--ink2)' }}>
                {flag.reason}
              </p>
            </div>
            <Button
              variant="secondary"
              className="flex-none px-3 py-2 text-sm"
              disabled={pendingId === flag.questionId}
              onClick={() => handleReview(flag.questionId, flag.flagType)}
            >
              {pendingId === flag.questionId ? 'Marking…' : 'Mark reviewed'}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
