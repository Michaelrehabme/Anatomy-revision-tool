import { useEffect, useState } from 'react';
import type { MCQQuestion } from '../../types/question';
import type { AnatomyImageAsset } from '../../types/image';
import type { Confidence } from '../../types/attempt';
import { questionLocationLabel } from '../../types/region';
import { AttributionBadge } from '../shared/AttributionBadge';
import { HotspotOverlay } from '../LocateStructureSession/HotspotOverlay';
import { ConfidenceButtons } from '../shared/ConfidenceButtons';
import { Button } from '../shared/Button';
import { ExamAnswerFooter } from '../shared/ExamAnswerFooter';

interface MCQSessionProps {
  question: MCQQuestion;
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

const LETTERS = ['A', 'B', 'C', 'D'];

export function MCQSession({ question, imagesById, onAnswer, onNext, examMode }: MCQSessionProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [rated, setRated] = useState(false);
  const [examSubmitted, setExamSubmitted] = useState(false);

  useEffect(() => {
    setSelectedIndex(null);
    setChecked(false);
    setRated(false);
    setExamSubmitted(false);
  }, [question.id]);

  const promptImage = question.promptImageId ? imagesById.get(question.promptImageId) : undefined;
  const highlightHotspots = promptImage?.mode === 'atlas-slide' ? (promptImage.hotspots ?? []) : [];
  const isCorrect = selectedIndex === question.correctIndex;

  const handleSelect = (index: number) => {
    if (examMode) {
      if (examSubmitted) return;
      setSelectedIndex(index);
      setExamSubmitted(true);
      onAnswer({
        structureId: question.structureId,
        correct: index === question.correctIndex,
        selectedAnswer: question.choices[index],
        correctAnswer: question.choices[question.correctIndex],
      });
      return;
    }
    setSelectedIndex(index);
  };

  const handleRate = (confidence: Confidence) => {
    if (selectedIndex === null) return;
    setRated(true);
    onAnswer({
      structureId: question.structureId,
      correct: isCorrect,
      confidence,
      selectedAnswer: question.choices[selectedIndex],
      correctAnswer: question.choices[question.correctIndex],
    });
  };

  return (
    <div className="flex flex-col">
      <div className="flex flex-1 flex-col justify-center px-24 py-10">
        <div className="mx-auto w-full max-w-[920px]">
          <div
            className="text-center"
            style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--acc)' }}
          >
            {question.promptKind[0].toUpperCase() + question.promptKind.slice(1)} · {questionLocationLabel(question)}
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

          <div className="mt-14 grid grid-cols-2 gap-4">
            {question.choices.map((choice, index) => {
              const isSelected = index === selectedIndex;
              const isAnswerCorrect = index === question.correctIndex;
              const revealing = checked && !examMode;
              let border = '1.2px solid var(--line)';
              let background = 'var(--sf)';
              let color = 'var(--ink)';
              if (revealing && isAnswerCorrect) {
                border = '1.4px solid var(--acc)';
                background = 'var(--accs)';
                color = 'var(--accd)';
              } else if (revealing && isSelected && !isAnswerCorrect) {
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
                  disabled={examMode ? examSubmitted : checked}
                  onClick={() => handleSelect(index)}
                  className="flex min-h-[82px] items-center gap-4 rounded-[3px] px-6 text-left text-xl disabled:cursor-default"
                  style={{ border, background, color }}
                >
                  <span className="w-4 flex-none" style={{ font: '400 12.5px/1 var(--font-mono)', color: checked || isSelected ? color : 'var(--ink3)' }}>
                    {LETTERS[index]}
                  </span>
                  <span className="flex-1">{choice}</span>
                </button>
              );
            })}
          </div>

          {!examMode && !checked && (
            <div className="mt-12 flex justify-center">
              <Button
                onClick={() => setChecked(true)}
                disabled={selectedIndex === null}
                className="min-w-[260px] min-h-[58px]"
              >
                Check answer
              </Button>
            </div>
          )}
        </div>
      </div>

      {examMode && examSubmitted && <ExamAnswerFooter onNext={onNext} />}

      {!examMode && checked && (
        <div className="flex-none px-24 py-10" style={{ background: isCorrect ? 'var(--accs)' : 'var(--acc2s)' }}>
          <div className="mx-auto flex max-w-[1000px] items-start gap-[72px]">
            <div className="flex-1">
              <div className="flex items-baseline gap-3.5">
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 32, color: isCorrect ? 'var(--accd)' : 'var(--acc2d)' }}>
                  {isCorrect ? 'Correct' : 'Not quite'}
                </span>
              </div>
              <p className="mt-3.5 max-w-[56ch] text-lg leading-relaxed" style={{ color: 'var(--ink)' }}>
                <strong className="font-semibold">{question.choices[question.correctIndex]}.</strong>{' '}
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
