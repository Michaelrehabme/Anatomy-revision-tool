import { useEffect, useState } from 'react';
import { moveFocusWithArrows } from '../shared/arrowFocus';
import { DesktopQuestionLayout, RailFeedback, RailHeader, StagePicture, StageWords } from '../shared/DesktopQuestionLayout';
import type { MCQQuestion } from '../../types/question';
import type { AnatomyImageAsset } from '../../types/image';
import type { Confidence } from '../../types/attempt';
import { PromptHighlightOverlay } from '../shared/PromptHighlightOverlay';
import { ImageViewer } from '../shared/ImageViewer';
import { rotationFramesFor } from '../../lib/rotationFrames';
import { promptHighlightFrames } from '../../lib/promptHighlight';
import { Button } from '../shared/Button';
import { ExamAnswerFooter } from '../shared/ExamAnswerFooter';
import { questionHeaderLabel } from '../../lib/questionFormats';

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
  // Every angle of the same picture, so the student can turn it. A plate
  // that is not part of a rotation set gives back nothing and the viewer
  // simply shows no turn controls.
  const promptFrames = rotationFramesFor(promptImage, imagesById.values());
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

  const header = { label: questionHeaderLabel(question), prompt: question.prompt, promptLines: question.promptLines };
  const revealing = checked && !examMode;

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
              // The name is the answer until it has been checked — and stays so in an exam.
              subjectId={question.structureId}
              conceal={revealing ? undefined : 'name'}
            />
          </StagePicture>
        ) : (
          <StageWords {...header} />
        )
      }
    >
      {promptImage && <RailHeader {...header} />}

      <div
        className={`${promptImage ? 'mt-8' : ''} grid grid-cols-2 gap-3.5`}
        role="group"
        aria-label="Answers"
        onKeyDown={moveFocusWithArrows}
        data-fx={revealing && !isCorrect ? 'shake' : undefined}
      >
        {question.choices.map((choice, index) => {
          const isSelected = index === selectedIndex;
          const isAnswerCorrect = index === question.correctIndex;
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
              aria-pressed={isSelected}
              onClick={() => handleSelect(index)}
              data-fx={revealing && isAnswerCorrect && isCorrect ? 'pulse' : undefined}
              className="flex min-h-[76px] items-center gap-4 rounded-[3px] px-5 text-left text-xl transition-colors duration-200 disabled:cursor-default"
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
        <Button onClick={() => setChecked(true)} disabled={selectedIndex === null} className="mt-6 min-h-[58px] w-full">
          Check answer
        </Button>
      )}

      {examMode && examSubmitted && <ExamAnswerFooter onNext={onNext} compact />}

      {revealing && (
        <RailFeedback
          correct={isCorrect}
          title={isCorrect ? 'Correct' : 'Not quite'}
          label={isCorrect ? 'Correct' : `Not quite. The answer is ${question.choices[question.correctIndex]}.`}
          rated={rated}
          onRate={handleRate}
          onNext={onNext}
          structureId={question.structureId}
          explanation={question.explanation}
        >
          <strong className="font-semibold">{question.choices[question.correctIndex].replace(/\.$/, '')}.</strong> {question.explanation}
        </RailFeedback>
      )}
    </DesktopQuestionLayout>
  );
}
