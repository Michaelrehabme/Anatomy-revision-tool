import type { OinaQuestion } from '../../types/question';
import { OinaSelectSession, type OinaAnswerParams } from './OinaSelectSession';
import { OinaTypedSession } from './OinaTypedSession';

interface OinaSessionProps {
  question: OinaQuestion;
  onAnswer: (params: OinaAnswerParams) => void;
  onNext: () => void;
  examMode?: boolean;
}

/**
 * Routes one OINA question to the phase it is in. The format is never a user
 * choice — it escalates per (muscle, fact) with the student's own accuracy,
 * decided once in the generator (see lib/factMastery.ts), so the only thing
 * the UI has to do is render the shape it was handed.
 */
export function OinaSession({ question, onAnswer, onNext, examMode }: OinaSessionProps) {
  return question.format === 'typed' ? (
    <OinaTypedSession question={question} onAnswer={onAnswer} onNext={onNext} examMode={examMode} />
  ) : (
    <OinaSelectSession question={question} onAnswer={onAnswer} onNext={onNext} examMode={examMode} />
  );
}
