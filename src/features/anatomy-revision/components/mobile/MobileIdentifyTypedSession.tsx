import { useEffect, useMemo, useState } from 'react';
import type { TypedIdentifyQuestion } from '../../types/question';
import type { AnatomyImageAsset } from '../../types/image';
import type { Confidence } from '../../types/attempt';
import { questionLocationLabel } from '../../types/region';
import { PromptHighlightOverlay } from '../shared/PromptHighlightOverlay';
import { ImageViewer } from '../shared/ImageViewer';
import { rotationFramesFor } from '../../lib/rotationFrames';
import { promptHighlightFrames } from '../../lib/promptHighlight';
import { ConfidenceButtons } from '../shared/ConfidenceButtons';
import { BottomSheet } from '../shared/BottomSheet';
import { ExamAnswerFooter } from '../shared/ExamAnswerFooter';
import { isAnswerMatch } from '../../lib/answerMatching';
import { gradeTypedSlots } from '../../lib/oinaAnswer';

interface MobileIdentifyTypedSessionProps {
  question: TypedIdentifyQuestion;
  imagesById: Map<string, AnatomyImageAsset>;
  onAnswer: (params: {
    structureId: string;
    correct: boolean;
    confidence?: Confidence;
    selectedAnswer: string;
    correctAnswer: string;
  }) => void;
  onNext: () => void;
  onFullCard: () => void;
  /** No color reveal, no explanation, no self-rating — answer submits and advances silently. See CR-009. */
  examMode?: boolean;
}

export function MobileIdentifyTypedSession({ question, imagesById, onAnswer, onNext, onFullCard, examMode }: MobileIdentifyTypedSessionProps) {
  const [attempt, setAttempt] = useState('');
  const slots = useMemo(() => question.attachmentSlots ?? [], [question.attachmentSlots]);
  const [slotInputs, setSlotInputs] = useState<string[]>(() => slots.map(() => ''));
  const [submitted, setSubmitted] = useState<{ correct: boolean; slotCorrect: boolean[] } | null>(null);
  const [rated, setRated] = useState(false);

  useEffect(() => {
    setAttempt('');
    setSlotInputs(slots.map(() => ''));
    setSubmitted(null);
    setRated(false);
  }, [question.id, slots]);

  const promptImage = imagesById.get(question.promptImageId);
  // Every angle of the same picture, so the student can turn it. A plate
  // that is not part of a rotation set gives back nothing and the viewer
  // simply shows no turn controls.
  const promptFrames = rotationFramesFor(promptImage, imagesById.values());
  const canonical = question.acceptedAnswers[0];
  const hints = useMemo(() => [`${canonical.length} letters`, `starts with ${canonical[0]?.toUpperCase()}`], [canonical]);

  const correctAnswer = slots.length
    ? `${canonical} — attaches to ${slots.map((sl) => sl.accepted[0]).join(', ')}`
    : canonical;
  const selectedAnswer = () => (slots.length ? [attempt, ...slotInputs].join(' / ') : attempt);

  const handleSubmit = () => {
    if (submitted || !attempt.trim()) return;
    const nameCorrect = isAnswerMatch(attempt, question.acceptedAnswers);
    const graded = gradeTypedSlots(slotInputs, slots);
    const correct = nameCorrect && graded.allCorrect;
    setSubmitted({ correct, slotCorrect: graded.slotCorrect });
    if (examMode) {
      onAnswer({ structureId: question.structureId, correct, selectedAnswer: selectedAnswer(), correctAnswer });
    }
  };
  const handleRate = (confidence: Confidence) => {
    if (!submitted) return;
    setRated(true);
    onAnswer({
      structureId: question.structureId,
      correct: submitted.correct,
      confidence,
      selectedAnswer: selectedAnswer(),
      correctAnswer,
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-6.5 pb-5">
        <div className="mt-4.5 flex items-baseline gap-2.5">
          <span style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accd)' }}>
            {question.promptKind}
          </span>
          <span style={{ font: '400 10px/1 var(--font-mono)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
            {questionLocationLabel(question)}
          </span>
        </div>
        <h2
          className="mt-3"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: question.prompt.length > 62 ? 26 : 30, lineHeight: 1.14, letterSpacing: '-.012em' }}
        >
          {question.prompt}
        </h2>

        {promptImage && (
          <ImageViewer
              className="mt-4"
              image={promptImage}
              frames={promptHighlightFrames(promptFrames, question.structureId)}
              resetKey={question.id}
              overlay={(current) => <PromptHighlightOverlay image={current} structureId={question.structureId} />}
            />
        )}

        <input
          type="text"
          value={attempt}
          onChange={(e) => setAttempt(e.target.value)}
          disabled={!!submitted}
          placeholder="Type your answer"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          className="mt-6 w-full disabled:opacity-70"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            padding: '14px 2px',
            border: 0,
            borderBottom: `1.6px solid ${submitted && !submitted.correct && !examMode ? 'var(--acc2)' : 'var(--fig-line)'}`,
            background: 'none',
            color: 'var(--ink)',
            boxSizing: 'border-box',
          }}
        />

        {slots.map((slot, i) => (
          <input
            key={i}
            type="text"
            value={slotInputs[i] ?? ''}
            onChange={(e) => setSlotInputs((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
            disabled={!!submitted}
            placeholder={`${slot.label} (${i + 1} of ${slots.length})`}
            aria-label={`${slot.label} ${i + 1}`}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="mt-3 w-full disabled:opacity-70"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 19,
              padding: '10px 2px',
              border: 0,
              borderBottom: `1.6px solid ${submitted && !examMode ? (submitted.slotCorrect[i] ? 'var(--acc)' : 'var(--acc2)') : 'var(--fig-line)'}`,
              background: 'none',
              color: 'var(--ink)',
              boxSizing: 'border-box',
            }}
          />
        ))}

        {!submitted && question.hints !== 'none' && (
          <div className="mt-4 flex flex-wrap gap-2">
            {hints.map((hint) => (
              <span
                key={hint}
                className="rounded-full px-3.5 py-2.5"
                style={{ font: '400 11.5px/1 var(--font-mono)', background: 'var(--accs)', color: 'var(--accd)' }}
              >
                {hint}
              </span>
            ))}
          </div>
        )}
        {!submitted && question.hints === 'none' && (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full px-3.5 py-2.5" style={{ font: '400 11.5px/1 var(--font-mono)', background: 'var(--accs)', color: 'var(--accd)' }}>
              No hints · extra XP
            </span>
          </div>
        )}

        {!submitted && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!attempt.trim()}
            className="mt-6 w-full rounded-[3px] border-0 disabled:opacity-45"
            style={{ minHeight: 52, background: 'var(--acc)', color: 'var(--onacc)', font: '500 16.5px/1 var(--font-ui)' }}
          >
            Check answer
          </button>
        )}
      </div>

      {submitted && examMode && <ExamAnswerFooter onNext={onNext} compact />}

      {submitted && !examMode && (
        <BottomSheet
          correct={submitted.correct}
          title={submitted.correct ? 'Correct' : 'Not quite'}
          body={
            <>
              <strong className="font-semibold">{correctAnswer}.</strong> {question.explanation}
            </>
          }
          onFullCard={onFullCard}
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
