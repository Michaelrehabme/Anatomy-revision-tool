import { useEffect, useRef, useState } from 'react';
import { RichText } from '../shared/RichText';
import type { FlashcardQuestion } from '../../types/question';
import type { AnatomyImageAsset } from '../../types/image';
import { AnatomyImageFigure } from '../shared/AnatomyImageFigure';
import { rotationFramesFor } from '../../lib/rotationFrames';
import { Button } from '../shared/Button';
import { DesktopQuestionLayout, StagePicture, StageWords } from '../shared/DesktopQuestionLayout';

interface FlashcardSessionProps {
  question: FlashcardQuestion;
  imagesById: Map<string, AnatomyImageAsset>;
  onAnswer: (params: { structureId: string; correct: boolean; graded: false }) => void;
  onNext: () => void;
}

/**
 * A flashcard is purely for learning (CR-018): reveal the answer, move on.
 *
 * It used to collect a typed attempt and a self-rated confidence, and record
 * `correct: true` for whoever rated themselves at all — which meant a card
 * both inflated session accuracy and drove SM-2 scheduling off a self-report.
 * Neither survives: the card is the teaching step that precedes an OINA
 * question, and the question is where the judgement happens. The exposure is
 * still recorded, and still earns XP, but it is `graded: false` throughout.
 */
export function FlashcardSession({ question, imagesById, onAnswer, onNext }: FlashcardSessionProps) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setRevealed(false);
  }, [question.id]);

  // Revealing removes the button that was pressed. Focus goes to the answer,
  // so a screen reader reads it and a keyboard carries on to Next from there —
  // it used to fall back to the question's wrapper and say nothing (WCAG 2.4.3).
  const answerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (revealed) answerRef.current?.focus();
  }, [revealed]);

  const frontImage = question.front.imageId ? imagesById.get(question.front.imageId) : undefined;
  const backImage = question.back.imageId ? imagesById.get(question.back.imageId) : undefined;
  // Every angle of each picture, so a flashcard can be turned as well as read.
  const frontFrames = rotationFramesFor(frontImage, imagesById.values());
  const backFrames = rotationFramesFor(backImage, imagesById.values());

  const handleReveal = () => {
    setRevealed(true);
    onAnswer({ structureId: question.structureId, correct: true, graded: false });
  };

  // The picture on show: the front's until it is revealed, then the back's
  // (which names the structure), or the front's again if the back has none.
  const shownImage = revealed ? (backImage ?? frontImage) : frontImage;
  const shownFrames = shownImage === backImage ? backFrames : frontFrames;
  const front = question.front.text ? (
    <p className="whitespace-pre-line" style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: shownImage ? 30 : 46, lineHeight: 1.15, letterSpacing: '-.02em' }}>
      {question.front.text}
    </p>
  ) : null;

  return (
    <DesktopQuestionLayout
      stage={
        shownImage ? (
          <StagePicture>
            <AnatomyImageFigure
              key={revealed ? 'back' : 'front'}
              image={shownImage}
              frames={shownFrames}
              alt={revealed && shownImage === backImage ? question.structureId : 'Identify this structure'}
              subjectId={question.structureId}
              conceal={revealed && shownImage === backImage ? undefined : 'name'}
            />
          </StagePicture>
        ) : (
          <StageWords label="Learn · not scored">
            <div className="mt-6">{front}</div>
          </StageWords>
        )
      }
    >
      {shownImage && (
        <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>Learn · not scored</div>
      )}
      {shownImage && front && <div className="mt-4">{front}</div>}

      {!revealed ? (
        <Button onClick={handleReveal} className={`${shownImage ? 'mt-8' : ''} min-h-[58px] w-full`}>
          Reveal answer
        </Button>
      ) : (
        <>
          <div ref={answerRef} tabIndex={-1} className="mt-6 text-xl leading-snug outline-none" style={{ color: 'var(--ink)' }}>
            <RichText text={question.back.text} />
          </div>
          <Button onClick={onNext} className="mt-8 min-h-[58px] w-full">
            Next
          </Button>
        </>
      )}
    </DesktopQuestionLayout>
  );
}
