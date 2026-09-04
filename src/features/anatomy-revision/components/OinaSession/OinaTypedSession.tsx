import { useEffect, useState } from 'react';
import type { OinaTypedQuestion } from '../../types/question';
import type { Confidence } from '../../types/attempt';
import { gradeTypedSlots } from '../../lib/oinaAnswer';
import { ConfidenceButtons } from '../shared/ConfidenceButtons';
import { Button } from '../shared/Button';
import { ExamAnswerFooter } from '../shared/ExamAnswerFooter';
import type { OinaAnswerParams } from './OinaSelectSession';

interface OinaTypedSessionProps {
  question: OinaTypedQuestion;
  onAnswer: (params: OinaAnswerParams) => void;
  onNext: () => void;
  examMode?: boolean;
}

/**
 * OINA recall phase (CR-018): one box per authored value, so a muscle with
 * two heads gets two boxes and the count is never a surprise.
 *
 * Graded order-independently — a student who knows both heads of biceps
 * femoris should not be marked wrong for entering them the other way round.
 * The question as a whole is all-or-nothing, matching the select phase, but
 * the reveal is per box so the student can see which one they lost.
 */
export function OinaTypedSession({ question, onAnswer, onNext, examMode }: OinaTypedSessionProps) {
  const [inputs, setInputs] = useState<string[]>(() => question.slots.map(() => ''));
  const [checked, setChecked] = useState(false);
  const [rated, setRated] = useState(false);

  useEffect(() => {
    setInputs(question.slots.map(() => ''));
    setChecked(false);
    setRated(false);
  }, [question.id, question.slots]);

  const result = gradeTypedSlots(inputs, question.slots);
  const answerStrings = () => ({
    selectedAnswer: inputs.map((v) => v.trim()).filter(Boolean).join(', ') || '(no answer)',
    correctAnswer: question.slots.map((s) => s.accepted[0]).join(', '),
  });

  const submit = (confidence?: Confidence) => {
    onAnswer({ structureId: question.structureId, correct: result.allCorrect, confidence, ...answerStrings() });
  };

  const handleCheck = () => {
    setChecked(true);
    if (examMode) submit();
  };

  const handleRate = (confidence: Confidence) => {
    setRated(true);
    submit(confidence);
  };

  const setInput = (index: number, value: string) => {
    if (checked) return;
    setInputs((prev) => prev.map((v, i) => (i === index ? value : v)));
  };

  return (
    <div className="flex flex-col">
      <div className="flex flex-1 flex-col justify-center px-24 py-10">
        <div className="mx-auto w-full max-w-[760px]">
          <div
            className="text-center"
            style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--acc)' }}
          >
            OINA · from memory
          </div>
          <h2
            className="mx-auto mt-6 text-center"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 40, lineHeight: 1.15, letterSpacing: '-.018em' }}
          >
            {question.prompt}
          </h2>

          <div className="mt-11 flex flex-col gap-5">
            {question.slots.map((slot, index) => {
              const revealing = checked && !examMode;
              const slotCorrect = result.slotCorrect[index];
              const accent = !revealing ? 'var(--line)' : slotCorrect ? 'var(--acc)' : 'var(--acc2)';
              return (
                <div key={slot.label}>
                  <label
                    htmlFor={`${question.id}-slot-${index}`}
                    className="block"
                    style={{
                      font: '500 10px/1 var(--font-mono)',
                      letterSpacing: '.16em',
                      textTransform: 'uppercase',
                      color: 'var(--ink3)',
                    }}
                  >
                    {slot.label}
                  </label>
                  <input
                    id={`${question.id}-slot-${index}`}
                    value={inputs[index] ?? ''}
                    onChange={(e) => setInput(index, e.target.value)}
                    disabled={checked}
                    autoComplete="off"
                    autoFocus={index === 0}
                    className="mt-2 w-full rounded-[3px] px-5 disabled:cursor-default"
                    style={{
                      minHeight: 58,
                      border: `1.4px solid ${accent}`,
                      background: 'var(--sf)',
                      color: 'var(--ink)',
                      font: '400 18px/1.4 var(--font-ui)',
                    }}
                  />
                  {revealing && !slotCorrect && (
                    <p className="mt-2 text-base" style={{ color: 'var(--acc2d)' }}>
                      {slot.accepted[0]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {!checked && (
            <div className="mt-11 flex justify-center">
              <Button onClick={handleCheck} className="min-w-[260px] min-h-[58px]">
                {examMode ? 'Submit' : 'Check answer'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {examMode && checked && <ExamAnswerFooter onNext={onNext} />}

      {!examMode && checked && (
        <div className="flex-none px-24 py-10" style={{ background: result.allCorrect ? 'var(--accs)' : 'var(--acc2s)' }}>
          <div className="mx-auto flex max-w-[1000px] items-start gap-[72px]">
            <div className="flex-1">
              <div className="flex items-baseline gap-3.5">
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 500,
                    fontSize: 32,
                    color: result.allCorrect ? 'var(--accd)' : 'var(--acc2d)',
                  }}
                >
                  {result.allCorrect ? 'Correct' : 'Not quite'}
                </span>
                {!result.allCorrect && question.slots.length > 1 && (
                  <span style={{ font: '500 12.5px/1 var(--font-mono)', color: 'var(--ink3)' }}>
                    {result.correctCount}/{question.slots.length} found
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
