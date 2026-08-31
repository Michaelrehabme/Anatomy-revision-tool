import { useEffect, useMemo, useState } from 'react';
import type { TypedIdentifyQuestion } from '../../types/question';
import type { AnatomyImageAsset } from '../../types/image';
import type { Confidence } from '../../types/attempt';
import { REGION_LABELS } from '../../types/region';
import { AttributionBadge } from '../shared/AttributionBadge';
import { HotspotOverlay } from '../LocateStructureSession/HotspotOverlay';
import { ConfidenceButtons } from '../shared/ConfidenceButtons';
import { Button } from '../shared/Button';
import { ExamAnswerFooter } from '../shared/ExamAnswerFooter';
import { isAnswerMatch } from '../../lib/answerMatching';

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
  const hints = useMemo(
    () => [`${canonical.length} letters`, `starts with ${canonical[0]?.toUpperCase()}`],
    [canonical],
  );

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
    <div className="flex flex-col">
      <div className="flex flex-1 flex-col justify-center px-24 py-10">
        <div className="mx-auto w-full max-w-[820px]">
          <div
            className="text-center"
            style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--acc)' }}
          >
            {question.promptKind[0].toUpperCase() + question.promptKind.slice(1)} · {REGION_LABELS[question.region]}
          </div>
          <h2
            className="mx-auto mt-6 text-center"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 52, lineHeight: 1.1, letterSpacing: '-.022em' }}
          >
            {question.prompt}
          </h2>

          {promptImage && (
            <figure className="mt-8">
              <div
                className="relative mx-auto max-w-md overflow-hidden rounded-[3px]"
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
            placeholder="Type the structure's name…"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="mt-12 w-full rounded-[3px] px-6 py-5 text-center disabled:opacity-70"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 30,
              border: '1.4px solid var(--acc)',
              background: 'var(--sf)',
              color: submitted && !examMode ? (submitted.correct ? 'var(--accd)' : 'var(--acc2d)') : 'var(--ink)',
              boxSizing: 'border-box',
            }}
          />

          {!submitted && (
            <div className="mt-5 flex justify-center gap-2.5">
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

          {!submitted && (
            <div className="mt-11 flex justify-center">
              <Button onClick={handleSubmit} disabled={!attempt.trim()} className="min-w-[220px] min-h-[58px]">
                Submit
              </Button>
            </div>
          )}
          {!submitted && (
            <p className="mt-6 text-center text-sm" style={{ color: 'var(--ink3)' }}>
              Common aliases and near-misses are accepted; the canonical name is always shown.
            </p>
          )}
        </div>
      </div>

      {submitted && examMode && <ExamAnswerFooter onNext={onNext} />}

      {submitted && !examMode && (
        <div className="flex-none px-24 py-10" style={{ background: submitted.correct ? 'var(--accs)' : 'var(--acc2s)' }}>
          <div className="mx-auto flex max-w-[1000px] items-start gap-[72px]">
            <div className="flex-1">
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  fontSize: 32,
                  color: submitted.correct ? 'var(--accd)' : 'var(--acc2d)',
                }}
              >
                {submitted.correct ? 'Correct' : 'Not quite'}
              </span>
              <p className="mt-3.5 max-w-[56ch] text-lg leading-relaxed" style={{ color: 'var(--ink)' }}>
                <strong className="font-semibold">{canonical}.</strong> {question.explanation}
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
