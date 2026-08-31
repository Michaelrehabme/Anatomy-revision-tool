import { useEffect, useMemo, useState } from 'react';
import type { TypedIdentifyQuestion } from '../../types/question';
import type { AnatomyImageAsset } from '../../types/image';
import type { Confidence } from '../../types/attempt';
import { REGION_LABELS } from '../../types/region';
import { AttributionBadge } from '../shared/AttributionBadge';
import { HotspotOverlay } from '../LocateStructureSession/HotspotOverlay';
import { ConfidenceButtons } from '../shared/ConfidenceButtons';
import { BottomSheet } from '../shared/BottomSheet';
import { ExamAnswerFooter } from '../shared/ExamAnswerFooter';
import { isAnswerMatch } from '../../lib/answerMatching';

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
  const [submitted, setSubmitted] = useState<{ correct: boolean } | null>(null);
  const [rated, setRated] = useState(false);

  useEffect(() => {
    setAttempt('');
    setSubmitted(null);
    setRated(false);
  }, [question.id]);

  const promptImage = imagesById.get(question.promptImageId);
  const highlightHotspots = promptImage?.mode === 'atlas-slide' ? (promptImage.hotspots ?? []) : [];
  const canonical = question.acceptedAnswers[0];
  const hints = useMemo(() => [`${canonical.length} letters`, `starts with ${canonical[0]?.toUpperCase()}`], [canonical]);

  const handleSubmit = () => {
    if (submitted || !attempt.trim()) return;
    const correct = isAnswerMatch(attempt, question.acceptedAnswers);
    setSubmitted({ correct });
    if (examMode) {
      onAnswer({ structureId: question.structureId, correct, selectedAnswer: attempt, correctAnswer: canonical });
    }
  };
  const handleRate = (confidence: Confidence) => {
    if (!submitted) return;
    setRated(true);
    onAnswer({
      structureId: question.structureId,
      correct: submitted.correct,
      confidence,
      selectedAnswer: attempt,
      correctAnswer: canonical,
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
            {REGION_LABELS[question.region]}
          </span>
        </div>
        <h2
          className="mt-3"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: question.prompt.length > 62 ? 26 : 30, lineHeight: 1.14, letterSpacing: '-.012em' }}
        >
          {question.prompt}
        </h2>

        {promptImage && (
          <figure className="mt-4">
            <div
              className="relative overflow-hidden rounded-[3px]"
              style={{
                background: 'var(--sf)',
                aspectRatio: promptImage.width && promptImage.height ? `${promptImage.width} / ${promptImage.height}` : undefined,
              }}
            >
              <img src={promptImage.filePath} alt={question.prompt} className="h-full w-full object-cover" />
              {highlightHotspots.length > 0 && (
                <HotspotOverlay hotspots={highlightHotspots} highlightStructureId={question.structureId} />
              )}
            </div>
            <AttributionBadge image={promptImage} />
          </figure>
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

        {!submitted && (
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
              <strong className="font-semibold">{canonical}.</strong> {question.explanation}
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
