import { COHORT_DRAWN_VERSION, MIN_PAIRED, summariseDiagnosticsByPaper, type DiagnosticResult, type PaperFigures } from './diagnostic';
import { paperLabel, type PaperId } from './diagnosticPapers';

/**
 * A class's diagnostic sittings as the lines of a report
 * (scripts/cohortReport.ts prints them).
 *
 * Here rather than in the script so it can be tested without a database: the
 * one thing this report must never do is put two papers into one figure, and
 * that is a property of these lines.
 *
 * WHAT IT SAYS, IN ORDER. Who sat which paper, in a sentence — "3 students
 * sat the whole-body paper, 2 sat the knee paper" — and then each paper on
 * its own: how many sat the baseline, their mean, how many sat both, the
 * before and after of THOSE students, and whether the figure may be quoted.
 * A paper under MIN_PAIRED is not quotable however many sat other papers.
 * There is no line for the class as a whole.
 */

/** "the whole-body paper", "the knee paper", "the class's own paper (version 1)". */
export function paperName(figures: Pick<PaperFigures, 'version' | 'paperId'>): string {
  if (figures.version === COHORT_DRAWN_VERSION) return "the class's own paper (version 1)";
  if (!figures.paperId) return `an unnamed paper (version ${figures.version})`;
  return paperLabel(figures.paperId as PaperId);
}

const students = (n: number) => `${n} student${n === 1 ? '' : 's'}`;
const pct = (value: number | null) => (value === null ? '—' : `${Math.round(value)}%`);

/** "3 students sat the whole-body paper, 2 sat the knee paper." */
export function whoSatWhat(papers: readonly PaperFigures[]): string {
  return `${papers.map((p, i) => `${i === 0 ? students(p.baselines) : p.baselines} sat ${paperName(p)}`).join(', ')}.`;
}

export function diagnosticReportLines(sittings: DiagnosticResult[]): string[] {
  const papers = summariseDiagnosticsByPaper(sittings);
  if (papers.length === 0) return ['Nobody has sat one yet.'];

  const lines: string[] = [whoSatWhat(papers)];
  if (papers.length > 1) {
    lines.push('These are different tests. Each is reported on its own below; no figure covers the class as a whole.');
  }

  for (const paper of papers) {
    const name = paperName(paper);
    lines.push('');
    lines.push(`${name.charAt(0).toUpperCase()}${name.slice(1)}`);
    lines.push(`  Sat the baseline          ${paper.baselines}`);
    lines.push(`  Mean baseline score       ${pct(paper.meanBaselinePct)}`);
    if (paper.unpairable > 0) {
      lines.push(`  Sat both, NOT COUNTED     ${paper.unpairable} — the follow-up was a different paper from the baseline`);
    }
    if (paper.paired === 0) {
      lines.push('  Follow-ups                none yet — the before-and-after needs both sittings');
      continue;
    }
    const before = Math.round(paper.meanPairedBaselinePct ?? 0);
    const after = Math.round(paper.meanFollowUpPct ?? 0);
    lines.push(`  Sat both                  ${paper.paired}`);
    lines.push(`  Mean before / after       ${before}% → ${after}%  (${after - before >= 0 ? '+' : ''}${after - before} points)`);
    lines.push(`  Improved                  ${paper.improved} of ${paper.paired}`);
    // MIN_PAIRED in lib/diagnostic.ts, asked of this paper alone. Printed
    // rather than hidden, for whoever runs the report. It goes no further:
    // /privacy tells students no class figure is given, to their course
    // leader or anyone, below that many (11 Oct 2026; this used to say the
    // course lead may see a small group's own figure).
    lines.push(
      paper.reportable
        ? '  Before quoting any of this, read docs/CLAIMS.md: what a pilot needs.'
        : `  NOT QUOTABLE: under ${MIN_PAIRED} students sat this paper twice. Not for the course lead either: /privacy promises no figure below ${MIN_PAIRED}. See docs/CLAIMS.md.`,
    );
  }
  return lines;
}
