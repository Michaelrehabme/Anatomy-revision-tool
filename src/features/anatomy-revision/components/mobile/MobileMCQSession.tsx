import { useEffect, useState } from 'react';
import type { MCQQuestion } from '../../types/question';
import type { AnatomyImageAsset } from '../../types/image';
import type { Confidence } from '../../types/attempt';
import { REGION_LABELS } from '../../types/region';
import { AttributionBadge } from '../shared/AttributionBadge';
import { HotspotOverlay } from '../LocateStructureSession/HotspotOverlay';
import { ConfidenceButtons } from '../shared/ConfidenceButtons';
import { BottomSheet } from '../shared/BottomSheet';

interface MobileMCQSessionProps {
  question: MCQQuestion;
  imagesById: Map<string, AnatomyImageAsset>;
  onAnswer: (params: {
    structureId: string;
    correct: boolean;
    confidence: Confidence;
    selectedAnswer: string;
    correctAnswer: string;
  }) => void;
  onNext: () => void;
  onFullCard: () => void;
}

const LETTERS = ['A', 'B', 'C', 'D'];

export function MobileMCQSession({ question, imagesById, onAnswer, onNext, onFullCard }: MobileMCQSessionProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [rated, setRated] = useState(false);

  useEffect(() => {
    setSelectedIndex(null);
    setChecked(false);
    setRated(false);
  }, [question.id]);

  const promptImage = question.promptImageId ? imagesById.get(question.promptImageId) : undefined;
  const highlightHotspots = promptImage?.mode === 'atlas-slide' ? (promptImage.hotspots ?? []) : [];
  const isCorrect = selectedIndex === question.correctIndex;

  const handleSelect = (index: number) => {
    if (checked) return;
    setSelectedIndex(index);
    setChecked(true);
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

        <div className="mt-6 flex flex-col gap-2.5">
          {question.choices.map((choice, index) => {
            const isSelected = index === selectedIndex;
            const isAnswerCorrect = index === question.correctIndex;
            let border = '1.4px solid var(--line)';
            let background = 'transparent';
            let color = 'var(--ink)';
            if (checked && isAnswerCorrect) {
              border = '1.4px solid var(--acc)';
              background = 'var(--accs)';
            } else if (checked && isSelected && !isAnswerCorrect) {
              border = '1.4px solid var(--acc2)';
              background = 'var(--acc2s)';
            } else if (checked) {
              color = 'var(--ink3)';
            }
            return (
              <button
                key={choice}
                type="button"
                disabled={checked}
                onClick={() => handleSelect(index)}
                className="flex min-h-[60px] items-center gap-3.5 rounded-[3px] px-4.5 text-left text-[16.5px] leading-tight disabled:cursor-default"
                style={{ border, background, color }}
              >
                <span className="w-3.5 flex-none" style={{ font: '400 11.5px/1 var(--font-mono)', color: 'var(--ink3)' }}>
                  {LETTERS[index]}
                </span>
                <span className="flex-1">{choice}</span>
              </button>
            );
          })}
        </div>
      </div>

      {checked && (
        <BottomSheet
          correct={isCorrect}
          title={isCorrect ? 'Correct' : 'Not quite'}
          body={
            <>
              <strong className="font-semibold">{question.choices[question.correctIndex]}.</strong> {question.explanation}
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
