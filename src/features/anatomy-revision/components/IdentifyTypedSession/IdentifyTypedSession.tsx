import { useEffect, useMemo, useState } from 'react';
import { DesktopQuestionLayout, RailFeedback, RailHeader, StagePicture, StageWords } from '../shared/DesktopQuestionLayout';
import type { TypedIdentifyQuestion } from '../../types/question';
import type { AnatomyImageAsset } from '../../types/image';
import type { Confidence } from '../../types/attempt';
import { PromptHighlightOverlay } from '../shared/PromptHighlightOverlay';
import { ImageViewer } from '../shared/ImageViewer';
import { rotationFramesFor } from '../../lib/rotationFrames';
import { promptHighlightFrames } from '../../lib/promptHighlight';
import { Button } from '../shared/Button';
import { ExamAnswerFooter } from '../shared/ExamAnswerFooter';
import { isAnswerMatch } from '../../lib/answerMatching';
import { gradeTypedSlots } from '../../lib/oinaAnswer';
import { notePendingAnswer } from '../../../feedback/data/pendingAnswer';
import { questionHeaderLabel } from '../../lib/questionFormats';

interface IdentifyTypedSessionProps {
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
  /** No color reveal, no explanation, no self-rating — answer submits and advances silently. See CR-009. */
  examMode?: boolean;
}

export function IdentifyTypedSession({ question, imagesById, onAnswer, onNext, examMode }: IdentifyTypedSessionProps) {
  const [attempt, setAttempt] = useState('');
  // One box per attachment, for ligaments; empty for everything else.
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

  const promptImage = (question.promptImageId ? imagesById.get(question.promptImageId) : undefined);
  // Every angle of the same picture, so the student can turn it. A plate
  // that is not part of a rotation set gives back nothing and the viewer
  // simply shows no turn controls.
  const promptFrames = rotationFramesFor(promptImage, imagesById.values());

  const canonical = question.acceptedAnswers[0];
  const hints = useMemo(
    () => [`${canonical.length} letters`, `starts with ${canonical[0]?.toUpperCase()}`],
    [canonical],
  );

  const correctAnswer = slots.length
    ? `${canonical} — attaches to ${slots.map((sl) => sl.accepted[0]).join(', ')}`
    : canonical;
  // The name is the question. Where it attaches is a bonus: a student who
  // names the ligament has identified it, and is not wrong for missing a
  // site (the owner's rule, 10 Oct 2026). The boxes are still marked, so the
  // student sees which sites they had.
  const bonus = submitted && slots.length ? `Bonus: ${submitted.slotCorrect.filter(Boolean).length} of ${slots.length} attachment${slots.length === 1 ? '' : 's'}.` : '';
  const selectedAnswer = () => (slots.length ? [attempt, ...slotInputs].join(' / ') : attempt);

  const handleSubmit = () => {
    if (submitted || !attempt.trim()) return;
    const nameCorrect = isAnswerMatch(attempt, question.acceptedAnswers);
    // Attachments are graded in any order, and do not decide the question.
    const graded = gradeTypedSlots(slotInputs, slots);
    const correct = nameCorrect;
    setSubmitted({ correct, slotCorrect: graded.slotCorrect });
    notePendingAnswer(question.id, selectedAnswer());
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

  const header = { label: questionHeaderLabel(question), prompt: question.prompt, promptLines: question.promptLines };

  return (
    <DesktopQuestionLayout
      stage={
        promptImage ? (
          <StagePicture>
            <ImageViewer
              className="w-full"
              image={promptImage}
              frames={promptHighlightFrames(promptFrames, question.structureId)}
              resetKey={question.id}
              overlay={(current) => <PromptHighlightOverlay image={current} structureId={question.structureId} />}
              // The name is the answer until it has been submitted — and stays so in an exam.
              subjectId={question.structureId}
              conceal={submitted && !examMode ? undefined : 'name'}
            />
          </StagePicture>
        ) : (
          <StageWords {...header} />
        )
      }
    >
      {promptImage && <RailHeader {...header} />}

      <input
        type="text"
        value={attempt}
        onChange={(e) => setAttempt(e.target.value)}
        disabled={!!submitted}
        placeholder="Type the structure's name…"
        autoFocus
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        className={`${promptImage ? 'mt-8' : ''} w-full rounded-[3px] px-6 py-5 text-center disabled:opacity-70`}
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 30,
          border: '1.4px solid var(--acc)',
          background: 'var(--sf)',
          color: submitted && !examMode ? (submitted.correct ? 'var(--accd)' : 'var(--acc2d)') : 'var(--ink)',
          boxSizing: 'border-box',
        }}
      />

      {slots.length > 0 && (
        <div className="mt-4 grid w-full gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(slots.length, 2)}, minmax(0, 1fr))` }}>
          {slots.map((slot, i) => (
            <input
              key={i}
              type="text"
              value={slotInputs[i] ?? ''}
              onChange={(e) => setSlotInputs((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
              disabled={!!submitted}
              placeholder={`Bonus: ${slot.label.toLowerCase()} (${i + 1} of ${slots.length})`}
              aria-label={`${slot.label} ${i + 1}`}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="w-full rounded-[3px] px-4 py-3 text-center disabled:opacity-70"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                border: `1.4px solid ${submitted && !examMode ? (submitted.slotCorrect[i] ? 'var(--acc)' : 'var(--acc2)') : 'var(--line)'}`,
                background: 'var(--sf)',
                color: submitted && !examMode ? (submitted.slotCorrect[i] ? 'var(--accd)' : 'var(--acc2d)') : 'var(--ink)',
                boxSizing: 'border-box',
              }}
            />
          ))}
        </div>
      )}

      {!submitted && question.hints !== 'none' && (
        <div className="mt-4 flex justify-center gap-2.5">
          {hints.map((hint) => (
            <span
              key={hint}
              className="inline-flex min-h-[40px] items-center justify-center whitespace-nowrap rounded-full px-4"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, border: '1.2px solid var(--line)', color: 'var(--ink3)' }}
            >
              {hint}
            </span>
          ))}
        </div>
      )}
      {!submitted && question.hints === 'none' && (
        <div className="mt-4 flex justify-center">
          <span
            className="inline-flex min-h-[40px] items-center justify-center whitespace-nowrap rounded-full px-4"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, background: 'var(--accs)', color: 'var(--accd)' }}
          >
            No hints · extra XP
          </span>
        </div>
      )}

      {!submitted && (
        <Button onClick={handleSubmit} disabled={!attempt.trim()} className="mt-6 min-h-[58px] w-full">
          Submit
        </Button>
      )}
      {!submitted && (
        <p className="mt-4 text-center text-sm" style={{ color: 'var(--ink3)' }}>
          Common aliases and near-misses are accepted; the canonical name is always shown.
        </p>
      )}

      {submitted && examMode && <ExamAnswerFooter onNext={onNext} compact />}

      {submitted && !examMode && (
        <RailFeedback
          correct={submitted.correct}
          title={submitted.correct ? 'Correct' : 'Not quite'}
          label={submitted.correct ? 'Correct' : `Not quite. The answer is ${correctAnswer}.`}
          rated={rated}
          onRate={handleRate}
          onNext={onNext}
          structureId={question.structureId}
          explanation={question.explanation}
        >
          <strong className="font-semibold">{correctAnswer}.</strong> {bonus} {question.explanation}
        </RailFeedback>
      )}
    </DesktopQuestionLayout>
  );
}
