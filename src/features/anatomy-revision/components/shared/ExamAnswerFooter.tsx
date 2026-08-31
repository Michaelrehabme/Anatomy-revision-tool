import { Button } from './Button';

interface ExamAnswerFooterProps {
  onNext: () => void;
  compact?: boolean;
}

/**
 * Exam mode's "no feedback until the end" reveal replacement — deliberately
 * withholds correct/incorrect styling and explanation text. Shared across
 * every question type so exam mode looks/behaves identically regardless of
 * format, rather than five bespoke neutral states drifting apart.
 */
export function ExamAnswerFooter({ onNext, compact }: ExamAnswerFooterProps) {
  return (
    <div className={compact ? 'mt-5' : 'flex-none px-24 py-10'} style={compact ? undefined : { background: 'var(--sf)' }}>
      <div className={compact ? '' : 'mx-auto flex max-w-[1000px] items-center justify-between'}>
        <span style={{ font: '500 15px/1 var(--font-ui)', color: 'var(--ink3)' }}>Answer recorded.</span>
        <Button onClick={onNext} className={compact ? 'mt-3 min-h-[46px] w-full' : 'min-w-[180px] min-h-[50px]'}>
          Next
        </Button>
      </div>
    </div>
  );
}
