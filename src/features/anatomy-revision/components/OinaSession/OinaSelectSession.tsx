import { useEffect, useState } from 'react';
import type { OinaSelectQuestion } from '../../types/question';
import type { Confidence } from '../../types/attempt';
import { scoreMultiSelect } from '../../lib/multiSelectScoring';
import { ConfidenceButtons } from '../shared/ConfidenceButtons';
import { Button } from '../shared/Button';
import { ExamAnswerFooter } from '../shared/ExamAnswerFooter';

export interface OinaAnswerParams {
  structureId: string;
  correct: boolean;
  confidence?: Confidence;
  selectedAnswer: string;
  correctAnswer: string;
}

interface OinaSelectSessionProps {
  question: OinaSelectQuestion;
  onAnswer: (params: OinaAnswerParams) => void;
  onNext: () => void;
  examMode?: boolean;
}

/**
 * OINA recognition phase (CR-018): select every value of one fact.
 *
 * Scored all-or-nothing, unlike MultiSelectSession's partial credit — the
 * skill being tested is knowing the complete set, so "2 of 3 origins" is not
 * two thirds of knowing where a muscle attaches. The correct count is shown
 * up front: 104 of 122 insertions have a single value, so without it the
 * all-or-nothing rule mostly punishes doubt about whether one was missed.
 */
export function OinaSelectSession({ question, onAnswer, onNext, examMode }: OinaSelectSessionProps) {
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

  const total = question.correctIndices.length;

  return (
    <div className="flex flex-col">
      <div className="flex flex-1 flex-col justify-center px-24 py-10">
        <div className="mx-auto w-full max-w-[920px]">
          <div
            className="text-center"
            style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--acc)' }}
          >
            OINA · {total === 1 ? '1 correct answer' : `${total} correct answers`}
          </div>
          <h2
            className="mx-auto mt-6 text-center"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 40, lineHeight: 1.15, letterSpacing: '-.018em' }}
          >
            {question.prompt}
          </h2>

          <div className="mt-11 grid grid-cols-2 gap-4">
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
                // Keyed by index as well as text: two choices can read the same
                // once head prefixes are stripped, and a bare text key would
                // collide and desync the reveal state.
                <button
                  key={`${choice}-${index}`}
                  type="button"
                  disabled={checked}
                  onClick={() => toggleIndex(index)}
                  className="flex min-h-[64px] items-center gap-3.5 rounded-[3px] px-6 text-left text-lg disabled:cursor-default"
                  style={{ border, background, color }}
                >
                  <span
                    className="flex h-[20px] w-[20px] flex-none items-center justify-center rounded-[3px]"
                    style={{
                      border: `1.4px solid ${isSelected ? 'currentColor' : 'var(--line)'}`,
                      background: isSelected ? 'currentColor' : 'transparent',
                    }}
                  >
                    {isSelected && <span style={{ color: background === 'transparent' ? color : background, fontSize: 13 }}>✓</span>}
                  </span>
                  <span className="flex-1">{choice}</span>
                </button>
              );
            })}
          </div>

          {!checked && (
            <div className="mt-11 flex justify-center">
              <Button
                onClick={examMode ? handleExamSubmit : () => setChecked(true)}
                className="min-w-[260px] min-h-[58px]"
              >
                {examMode ? 'Submit' : 'Check answer'}
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
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 500,
                    fontSize: 32,
                    color: score.isFullyCorrect ? 'var(--accd)' : 'var(--acc2d)',
                  }}
                >
                  {score.isFullyCorrect ? 'Correct' : 'Not quite'}
                </span>
                {!score.isFullyCorrect && (
                  <span style={{ font: '500 12.5px/1 var(--font-mono)', color: 'var(--ink3)' }}>
                    {score.correctCount}/{score.totalCorrect} found
                    {score.incorrectCount > 0 ? `, ${score.incorrectCount} wrong` : ''}
                  </span>
                )}
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
