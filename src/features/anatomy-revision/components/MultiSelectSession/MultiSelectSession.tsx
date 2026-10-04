import { useEffect, useState } from 'react';
import { moveFocusWithArrows } from '../shared/arrowFocus';
import { choiceRevealNote } from '../shared/choiceReveal';
import { FeedbackHeading } from '../shared/FeedbackHeading';
import type { MultiSelectQuestion } from '../../types/question';
import type { Confidence } from '../../types/attempt';
import { scoreMultiSelect } from '../../lib/multiSelectScoring';
import { ConfidenceButtons } from '../shared/ConfidenceButtons';
import { Button } from '../shared/Button';
import { ExamAnswerFooter } from '../shared/ExamAnswerFooter';
import { questionHeaderLabel } from '../../lib/questionFormats';

interface MultiSelectSessionProps {
  question: MultiSelectQuestion;
  onAnswer: (params: {
    structureId: string;
    correct: boolean;
    confidence?: Confidence;
    /** Share of the answer that was right, net of wrong picks — see lib/mastery.ts scheduleConfidence. */
    partialCredit?: number;
    selectedAnswer: string;
    correctAnswer: string;
  }) => void;
  onNext: () => void;
  /** No color reveal, no explanation, no self-rating — answer submits and advances silently. See CR-009. */
  examMode?: boolean;
}

/** "Select all that apply" (CR-010) — scored partially, not all-or-nothing, but `correct` for scheduling/XP stays a binary "selected exactly the right set". */
export function MultiSelectSession({ question, onAnswer, onNext, examMode }: MultiSelectSessionProps) {
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

  const handleCheck = () => setChecked(true);

  const handleRate = (confidence: Confidence) => {
    setRated(true);
    onAnswer({ structureId: question.structureId, correct: score.isFullyCorrect, partialCredit: score.score, confidence, ...answerStrings() });
  };

  return (
    <div className="flex flex-col">
      <div className="flex flex-1 flex-col justify-center px-24 py-10">
        <div className="mx-auto w-full max-w-[920px]">
          <div
            className="text-center"
            style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accd)' }}
          >
            {questionHeaderLabel(question)}
          </div>
          <h2
            className="mx-auto mt-6 text-center"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 44, lineHeight: 1.15, letterSpacing: '-.018em' }}
          >
            {question.prompt}
          </h2>

          {/* A labelled group whose options say whether they are chosen, with the
              arrow keys moving between them — as multiple choice already had. */}
          <div className="mt-12 grid grid-cols-2 gap-4" role="group" aria-label="Answers — choose every one that applies" onKeyDown={moveFocusWithArrows}>
            {question.choices.map((choice, index) => {
              const isSelected = selectedIndices.has(index);
              const isCorrectChoice = question.correctIndices.includes(index);
              const revealing = checked && !examMode;
              let border = '1.2px solid var(--line)';
              let background = 'var(--sf)';
              let color = 'var(--ink)';
              if (revealing && isCorrectChoice && isSelected) {
                border = '1.4px solid var(--acc)';
                background = 'var(--accs)';
                color = 'var(--accd)';
              } else if (revealing && isCorrectChoice && !isSelected) {
                border = '1.4px dashed var(--acc)';
                background = 'transparent';
                color = 'var(--accd)';
              } else if (revealing && !isCorrectChoice && isSelected) {
                border = '1.4px solid var(--acc2)';
                background = 'var(--acc2s)';
                color = 'var(--acc2d)';
              } else if (isSelected) {
                border = '1.4px solid var(--acc)';
                background = 'var(--accs)';
                color = 'var(--accd)';
              }
              return (
                <button
                  key={choice}
                  type="button"
                  disabled={checked}
                  aria-pressed={isSelected}
                  onClick={() => toggleIndex(index)}
                  className="flex min-h-[64px] items-center gap-3.5 rounded-[3px] px-6 text-left text-lg disabled:cursor-default"
                  style={{ border, background, color }}
                >
                  <span
                    className="flex h-[20px] w-[20px] flex-none items-center justify-center rounded-[3px]"
                    style={{ border: `1.4px solid ${isSelected ? 'currentColor' : 'var(--line)'}`, background: isSelected ? 'currentColor' : 'transparent' }}
                  >
                    {/* The tick is decoration: aria-pressed says it, and a glyph in the name would be read as "check mark". */}
                  {isSelected && <span aria-hidden="true" style={{ color: background === 'transparent' ? color : background, fontSize: 13 }}>✓</span>}
                  </span>
                  <span className="flex-1">
                    {choice}
                    {revealing && choiceRevealNote(isCorrectChoice, isSelected) && (
                    <span className="sr-only"> ({choiceRevealNote(isCorrectChoice, isSelected)})</span>
                  )}
                  </span>
                </button>
              );
            })}
          </div>

          {!examMode && !checked && (
            <div className="mt-12 flex justify-center">
              <Button onClick={handleCheck} className="min-w-[260px] min-h-[58px]">
                Check answer
              </Button>
            </div>
          )}
          {examMode && !checked && (
            <div className="mt-12 flex justify-center">
              <Button onClick={handleExamSubmit} className="min-w-[260px] min-h-[58px]">
                Submit
              </Button>
            </div>
          )}
        </div>
      </div>

      {examMode && checked && <ExamAnswerFooter onNext={onNext} />}

      {!examMode && checked && (
        <div className="flex-none px-24 py-10" style={{ background: score.isFullyCorrect ? 'var(--accs)' : 'var(--acc2s)' }}>
          <div className="mx-auto flex max-w-[1000px] items-start gap-[72px]">
            <div className="flex-1">
              <div className="flex items-baseline gap-3.5">
                {/* Takes focus as it appears, like every other format's verdict: it was a
                    plain span, and checking left focus on the page body. */}
                <FeedbackHeading
                  style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 32, color: score.isFullyCorrect ? 'var(--accd)' : 'var(--acc2d)' }}
                  label={score.isFullyCorrect ? 'Correct' : `${Math.round(score.score * 100)}% credit. ${score.correctCount} of ${score.totalCorrect} correct${score.incorrectCount > 0 ? `, ${score.incorrectCount} wrong` : ''}.`}
                >
                  {score.isFullyCorrect ? 'Correct' : `${Math.round(score.score * 100)}% credit`}
                </FeedbackHeading>
                <span style={{ font: '500 12.5px/1 var(--font-mono)', color: 'var(--ink3)' }}>
                  {score.correctCount}/{score.totalCorrect} correct{score.incorrectCount > 0 ? `, ${score.incorrectCount} wrong` : ''}
                </span>
              </div>
              <p className="mt-3.5 max-w-[56ch] text-lg leading-relaxed" style={{ color: 'var(--ink)' }}>
                {question.explanation}
              </p>
              {rated && (
                <Button onClick={onNext} className="mt-6 min-w-[180px] min-h-[50px]">
                  Next
                </Button>
              )}
            </div>
            {!rated && (
              <div className="w-[420px] flex-none">
                <ConfidenceButtons onRate={handleRate} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
