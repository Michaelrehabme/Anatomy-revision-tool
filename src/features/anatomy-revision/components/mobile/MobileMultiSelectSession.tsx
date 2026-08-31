import { useEffect, useState } from 'react';
import type { MultiSelectQuestion } from '../../types/question';
import type { Confidence } from '../../types/attempt';
import { questionLocationLabel } from '../../types/region';
import { scoreMultiSelect } from '../../lib/multiSelectScoring';
import { ConfidenceButtons } from '../shared/ConfidenceButtons';
import { BottomSheet } from '../shared/BottomSheet';
import { ExamAnswerFooter } from '../shared/ExamAnswerFooter';

interface MobileMultiSelectSessionProps {
  question: MultiSelectQuestion;
  onAnswer: (params: {
    structureId: string;
    correct: boolean;
    confidence?: Confidence;
    selectedAnswer: string;
    correctAnswer: string;
  }) => void;
  onNext: () => void;
  examMode?: boolean;
}

export function MobileMultiSelectSession({ question, onAnswer, onNext, examMode }: MobileMultiSelectSessionProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [checked, setChecked] = useState(false);
  const [rated, setRated] = useState(false);

  useEffect(() => {
    setSelectedIndices(new Set());
    setChecked(false);
    setRated(false);
  }, [question.id]);

  const toggleIndex = (index: number) => {
    if (checked) return;
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const selectedList = [...selectedIndices];
  const score = scoreMultiSelect(question.correctIndices, selectedList);
  const answerStrings = () => ({
    selectedAnswer: selectedList.map((i) => question.choices[i]).join(', ') || '(none selected)',
    correctAnswer: question.correctIndices.map((i) => question.choices[i]).join(', '),
  });

  const handleExamSubmit = () => {
    setChecked(true);
    onAnswer({ structureId: question.structureId, correct: score.isFullyCorrect, ...answerStrings() });
  };

  const handleRate = (confidence: Confidence) => {
    setRated(true);
    onAnswer({ structureId: question.structureId, correct: score.isFullyCorrect, confidence, ...answerStrings() });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-6.5 pb-5">
        <div className="mt-4.5" style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accd)' }}>
          Select all · {questionLocationLabel(question)}
        </div>
        <h2 className="mt-3" style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 26, lineHeight: 1.16, letterSpacing: '-.012em' }}>
          {question.prompt}
        </h2>

        <div className="mt-6 flex flex-col gap-2.5">
          {question.choices.map((choice, index) => {
            const isSelected = selectedIndices.has(index);
            const isCorrectChoice = question.correctIndices.includes(index);
            const revealing = checked && !examMode;
            let border = '1.4px solid var(--line)';
            let background = 'transparent';
            const color = 'var(--ink)';
            if (revealing && isCorrectChoice && isSelected) {
              border = '1.4px solid var(--acc)';
              background = 'var(--accs)';
            } else if (revealing && isCorrectChoice && !isSelected) {
              border = '1.4px dashed var(--acc)';
            } else if (revealing && !isCorrectChoice && isSelected) {
              border = '1.4px solid var(--acc2)';
              background = 'var(--acc2s)';
            } else if (isSelected) {
              border = '1.4px solid var(--acc)';
              background = 'var(--accs)';
            }
            return (
              <button
                key={choice}
                type="button"
                disabled={checked}
                onClick={() => toggleIndex(index)}
                className="flex min-h-[54px] items-center gap-3 rounded-[3px] px-4 text-left text-[16px] disabled:cursor-default"
                style={{ border, background, color }}
              >
                <span
                  className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[3px]"
                  style={{ border: `1.4px solid ${isSelected ? 'var(--acc)' : 'var(--line)'}`, background: isSelected ? 'var(--acc)' : 'transparent' }}
                >
                  {isSelected && <span style={{ color: 'var(--onacc)', fontSize: 11 }}>✓</span>}
                </span>
                <span className="flex-1">{choice}</span>
              </button>
            );
          })}
        </div>

        {!examMode && !checked && (
          <button
            type="button"
            onClick={() => setChecked(true)}
            className="mt-6 w-full rounded-[3px] border-0"
            style={{ minHeight: 52, background: 'var(--acc)', color: 'var(--onacc)', font: '500 16.5px/1 var(--font-ui)' }}
          >
            Check answer
          </button>
        )}
        {examMode && !checked && (
          <button
            type="button"
            onClick={handleExamSubmit}
            className="mt-6 w-full rounded-[3px] border-0"
            style={{ minHeight: 52, background: 'var(--acc)', color: 'var(--onacc)', font: '500 16.5px/1 var(--font-ui)' }}
          >
            Submit
          </button>
        )}
      </div>

      {examMode && checked && <ExamAnswerFooter onNext={onNext} compact />}

      {!examMode && checked && (
        <BottomSheet
          correct={score.isFullyCorrect}
          title={score.isFullyCorrect ? 'Correct' : `${Math.round(score.score * 100)}% credit`}
          body={
            <>
              {score.correctCount}/{score.totalCorrect} correct{score.incorrectCount > 0 ? `, ${score.incorrectCount} wrong` : ''}.{' '}
              {question.explanation}
            </>
          }
        >
          {rated ? (
            <button
              type="button"
              onClick={onNext}
              className="mt-4.5 w-full rounded-[3px] border-0"
              style={{ minHeight: 52, background: 'var(--acc)', color: 'var(--onacc)', font: '500 16.5px/1 var(--font-ui)' }}
            >
              Next
            </button>
          ) : (
            <div className="mt-4.5">
              <ConfidenceButtons onRate={handleRate} label="How did that feel?" />
            </div>
          )}
        </BottomSheet>
      )}
    </div>
  );
}
