import { useEffect, useState } from 'react';
import type { OinaQuestion, OinaSelectQuestion, OinaTypedQuestion } from '../../types/question';
import type { Confidence } from '../../types/attempt';
import { scoreMultiSelect } from '../../lib/multiSelectScoring';
import { gradeTypedSlots } from '../../lib/oinaAnswer';
import { ConfidenceButtons } from '../shared/ConfidenceButtons';
import { BottomSheet } from '../shared/BottomSheet';
import { ExamAnswerFooter } from '../shared/ExamAnswerFooter';
import type { OinaAnswerParams } from '../OinaSession/OinaSelectSession';

interface MobileOinaSessionProps {
  question: OinaQuestion;
  onAnswer: (params: OinaAnswerParams) => void;
  onNext: () => void;
  examMode?: boolean;
}

const primaryButton = {
  minHeight: 52,
  background: 'var(--acc)',
  color: 'var(--onacc)',
  font: '500 16.5px/1 var(--font-ui)',
};

const eyebrow = {
  font: '500 10px/1 var(--font-mono)',
  letterSpacing: '.16em',
  textTransform: 'uppercase' as const,
  color: 'var(--accd)',
};

/** Mobile OINA (CR-018) — routes on format, same as the desktop OinaSession. */
export function MobileOinaSession({ question, onAnswer, onNext, examMode }: MobileOinaSessionProps) {
  return question.format === 'typed' ? (
    <MobileOinaTyped question={question} onAnswer={onAnswer} onNext={onNext} examMode={examMode} />
  ) : (
    <MobileOinaSelect question={question} onAnswer={onAnswer} onNext={onNext} examMode={examMode} />
  );
}

function MobileOinaSelect({
  question,
  onAnswer,
  onNext,
  examMode,
}: MobileOinaSessionProps & { question: OinaSelectQuestion }) {
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
  const total = question.correctIndices.length;

  const submit = (confidence?: Confidence) => {
    onAnswer({
      structureId: question.structureId,
      correct: score.isFullyCorrect,
      confidence,
      selectedAnswer: selectedList.map((i) => question.choices[i]).join(', ') || '(none selected)',
      correctAnswer: question.correctIndices.map((i) => question.choices[i]).join(', '),
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-6.5 pb-5">
        <div className="mt-4.5" style={eyebrow}>
          OINA · {total === 1 ? '1 correct' : `${total} correct`}
        </div>
        <h2
          className="mt-3"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 26, lineHeight: 1.16, letterSpacing: '-.012em' }}
        >
          {question.prompt}
        </h2>

        <div className="mt-6 flex flex-col gap-2.5">
          {question.choices.map((choice, index) => {
            const isSelected = selectedIndices.has(index);
            const isCorrectChoice = question.correctIndices.includes(index);
            const revealing = checked && !examMode;
            let border = '1.4px solid var(--line)';
            let background = 'transparent';
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
              // Index in the key: stripping head prefixes can leave two choices reading alike.
              <button
                key={`${choice}-${index}`}
                type="button"
                disabled={checked}
                onClick={() => toggleIndex(index)}
                className="flex min-h-[54px] items-center gap-3 rounded-[3px] px-4 text-left text-[16px] disabled:cursor-default"
                style={{ border, background, color: 'var(--ink)' }}
              >
                <span
                  className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[3px]"
                  style={{
                    border: `1.4px solid ${isSelected ? 'var(--acc)' : 'var(--line)'}`,
                    background: isSelected ? 'var(--acc)' : 'transparent',
                  }}
                >
                  {isSelected && <span style={{ color: 'var(--onacc)', fontSize: 11 }}>✓</span>}
                </span>
                <span className="flex-1">{choice}</span>
              </button>
            );
          })}
        </div>

        {!checked && (
          <button
            type="button"
            onClick={() => {
              setChecked(true);
              if (examMode) submit();
            }}
            className="mt-6 w-full rounded-[3px] border-0"
            style={primaryButton}
          >
            {examMode ? 'Submit' : 'Check answer'}
          </button>
        )}
      </div>

      {examMode && checked && <ExamAnswerFooter onNext={onNext} compact />}

      {!examMode && checked && (
        <BottomSheet
          correct={score.isFullyCorrect}
          title={score.isFullyCorrect ? 'Correct' : 'Not quite'}
          body={
            <>
              {!score.isFullyCorrect && (
                <>
                  {score.correctCount}/{score.totalCorrect} found
                  {score.incorrectCount > 0 ? `, ${score.incorrectCount} wrong` : ''}.{' '}
                </>
              )}
              {question.explanation}
            </>
          }
        >
          {rated ? (
            <button type="button" onClick={onNext} className="mt-4.5 w-full rounded-[3px] border-0" style={primaryButton}>
              Next
            </button>
          ) : (
            <div className="mt-4.5">
              <ConfidenceButtons
                onRate={(confidence) => {
                  setRated(true);
                  submit(confidence);
                }}
                label="How did that feel?"
              />
            </div>
          )}
        </BottomSheet>
      )}
    </div>
  );
}

function MobileOinaTyped({
  question,
  onAnswer,
  onNext,
  examMode,
}: MobileOinaSessionProps & { question: OinaTypedQuestion }) {
  const [inputs, setInputs] = useState<string[]>(() => question.slots.map(() => ''));
  const [checked, setChecked] = useState(false);
  const [rated, setRated] = useState(false);

  useEffect(() => {
    setInputs(question.slots.map(() => ''));
    setChecked(false);
    setRated(false);
  }, [question.id, question.slots]);

  const result = gradeTypedSlots(inputs, question.slots);

  const submit = (confidence?: Confidence) => {
    onAnswer({
      structureId: question.structureId,
      correct: result.allCorrect,
      confidence,
      selectedAnswer: inputs.map((v) => v.trim()).filter(Boolean).join(', ') || '(no answer)',
      correctAnswer: question.slots.map((s) => s.accepted[0]).join(', '),
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-6.5 pb-5">
        <div className="mt-4.5" style={eyebrow}>
          OINA · from memory
        </div>
        <h2
          className="mt-3"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 26, lineHeight: 1.16, letterSpacing: '-.012em' }}
        >
          {question.prompt}
        </h2>

        <div className="mt-6 flex flex-col gap-4">
          {question.slots.map((slot, index) => {
            const revealing = checked && !examMode;
            const slotCorrect = result.slotCorrect[index];
            const accent = !revealing ? 'var(--line)' : slotCorrect ? 'var(--acc)' : 'var(--acc2)';
            return (
              <div key={slot.label}>
                <label
                  htmlFor={`${question.id}-slot-${index}`}
                  className="block"
                  style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
                >
                  {slot.label}
                </label>
                <input
                  id={`${question.id}-slot-${index}`}
                  value={inputs[index] ?? ''}
                  onChange={(e) => !checked && setInputs((prev) => prev.map((v, i) => (i === index ? e.target.value : v)))}
                  disabled={checked}
                  autoComplete="off"
                  className="mt-1.5 w-full rounded-[3px] px-4 disabled:cursor-default"
                  style={{
                    minHeight: 52,
                    border: `1.4px solid ${accent}`,
                    background: 'var(--sf)',
                    color: 'var(--ink)',
                    font: '400 16.5px/1.4 var(--font-ui)',
                  }}
                />
                {revealing && !slotCorrect && (
                  <p className="mt-1.5 text-[15px]" style={{ color: 'var(--acc2d)' }}>
                    {slot.accepted[0]}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {!checked && (
          <button
            type="button"
            onClick={() => {
              setChecked(true);
              if (examMode) submit();
            }}
            className="mt-6 w-full rounded-[3px] border-0"
            style={primaryButton}
          >
            {examMode ? 'Submit' : 'Check answer'}
          </button>
        )}
      </div>

      {examMode && checked && <ExamAnswerFooter onNext={onNext} compact />}

      {!examMode && checked && (
        <BottomSheet
          correct={result.allCorrect}
          title={result.allCorrect ? 'Correct' : 'Not quite'}
          body={
            <>
              {!result.allCorrect && question.slots.length > 1 && (
                <>
                  {result.correctCount}/{question.slots.length} found.{' '}
                </>
              )}
              {question.explanation}
            </>
          }
        >
          {rated ? (
            <button type="button" onClick={onNext} className="mt-4.5 w-full rounded-[3px] border-0" style={primaryButton}>
              Next
            </button>
          ) : (
            <div className="mt-4.5">
              <ConfidenceButtons
                onRate={(confidence) => {
                  setRated(true);
                  submit(confidence);
                }}
                label="How did that feel?"
              />
            </div>
          )}
        </BottomSheet>
      )}
    </div>
  );
}
