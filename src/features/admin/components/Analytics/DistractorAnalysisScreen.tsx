import { useDistractorAnalysis } from '../../hooks/useDistractorAnalysis';
import { ConfusionPairsList } from './ConfusionPairsList';
import { QuestionDistractorList } from './QuestionDistractorList';

const sectionHeading = {
  fontFamily: 'var(--font-display)',
  fontWeight: 500,
  fontSize: 22,
  letterSpacing: '-.01em',
  margin: 0,
} as const;

export function DistractorAnalysisScreen() {
  const { summaries, pairs, loading, error } = useDistractorAnalysis();

  if (loading) {
    return (
      <div className="mt-10 text-sm" style={{ color: 'var(--ink3)' }}>
        Loading attempt data…
      </div>
    );
  }
  if (error) {
    return (
      <div className="mt-10 text-sm" style={{ color: 'var(--acc2d)' }}>
        {error}
      </div>
    );
  }

  return (
    <div>
      <section>
        <h2 style={sectionHeading}>Confusion pairs</h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink2)', maxWidth: 640 }}>
          Ranked (correct answer → what students picked instead) across every wrong attempt. Each frequent pair is a
          distinction students consistently aren't making — a content roadmap, most impactful first.
        </p>
        <ConfusionPairsList pairs={pairs} />
      </section>

      <section className="mt-12">
        <h2 style={sectionHeading}>Per-question distractors</h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink2)', maxWidth: 640 }}>
          Every question with wrong answers, most wrong attempts first.
        </p>
        <QuestionDistractorList summaries={summaries} />
      </section>
    </div>
  );
}
