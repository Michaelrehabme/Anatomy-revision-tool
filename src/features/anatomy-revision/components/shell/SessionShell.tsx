import type { ReactNode } from 'react';
import { useMotionRoot } from '../shared/motion';
import { EndSessionControl } from '../shared/EndSessionControl';
import { ReportQuestionControl, type ReportContext } from '../../../feedback/ReportQuestionControl';
import type { RevisionQuestion } from '../../types/question';

export interface SessionBarProps {
  current: number;
  total: number;
  correctCount: number;
  wrongCount: number;
  /** Learn cards revealed, and how many the session holds — see SessionSidebar for why they are counted apart. */
  cardsSeen?: number;
  cardsTotal?: number;
  onEnd: () => void;
  answered?: number;
  assignment?: boolean;
  exam?: boolean;
  hint?: ReactNode;
  question?: RevisionQuestion;
  reportContext?: ReportContext;
}

const SMALL = { font: '400 12.5px/1 var(--font-mono)' } as const;

/*
 * The two controls that open in place (End session's "are you sure", and the
 * report form) would stretch a 52px bar. Here each sits in a slot the size of
 * its trigger and, once open, drops down over the page as a card.
 */
const POPOVER =
  'absolute top-1/2 z-30 w-max -translate-y-1/2 rounded-[3px] ' +
  'has-[form]:top-[-4px] has-[form]:w-[360px] has-[form]:translate-y-0 has-[form]:p-4 has-[form]:bg-[var(--sf)] has-[form]:shadow-[var(--shadow-card)] ' +
  'has-[[role=group]]:top-[-4px] has-[[role=group]]:w-[340px] has-[[role=group]]:translate-y-0 has-[[role=group]]:p-4 has-[[role=group]]:bg-[var(--sf)] has-[[role=group]]:shadow-[var(--shadow-card)]';

/** The in-session top bar on desktop: what the session sidebar held, in one line. */
function SessionBar({ current, total, correctCount, wrongCount, cardsSeen = 0, cardsTotal = 0, onEnd, answered = 0, assignment = false, exam = false, hint, question, reportContext }: SessionBarProps) {
  const pct = total > 0 ? (current / total) * 100 : 0;
  return (
    <header className="flex h-[52px] flex-none items-center gap-7 px-7" style={{ borderBottom: '1px solid var(--line)', background: 'var(--pg)' }}>
      <div className="relative h-full w-[112px] flex-none">
        <div className={`${POPOVER} left-0`}>
          <EndSessionControl variant="sidebar" answered={answered} assignment={assignment} exam={exam} onEnd={onEnd} />
        </div>
      </div>

      <div className="flex min-w-0 max-w-[560px] flex-1 items-center gap-3.5">
        <span className="flex-none" style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 20, letterSpacing: '-.02em' }}>
          {current}
          <span style={{ fontSize: 14, color: 'var(--ink3)' }}> / {total}</span>
        </span>
        <div
          className="h-1 min-w-0 flex-1 overflow-hidden rounded-full"
          style={{ background: 'var(--line)' }}
          role="progressbar"
          aria-label="Session progress"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={current}
        >
          <div className="h-full transition-all duration-300" style={{ width: `${pct}%`, background: 'var(--acc)' }} />
        </div>
      </div>

      {cardsTotal > 0 && (
        <span className="flex-none" style={{ ...SMALL, color: 'var(--ink3)' }}>
          Learn cards {cardsSeen} / {cardsTotal} · not scored
        </span>
      )}
      {(correctCount > 0 || wrongCount > 0) && (
        <span className="flex flex-none gap-4" style={SMALL}>
          <span style={{ color: 'var(--accd)' }}>{correctCount} correct</span>
          <span style={{ color: 'var(--acc2d)' }}>{wrongCount} wrong</span>
        </span>
      )}
      {hint && (
        <span className="flex-none" style={{ ...SMALL, color: 'var(--ink3)' }}>
          {hint}
        </span>
      )}

      <div className="flex-1" />
      {question && (
        <div className="relative h-full w-[130px] flex-none">
          <div className={`${POPOVER} right-0 text-right has-[form]:text-left`}>
            <ReportQuestionControl variant="sidebar" question={question} context={reportContext} />
          </div>
        </div>
      )}
    </header>
  );
}

/**
 * The desktop shell while a question is on screen: a one-line bar on top and
 * the question below it, filling exactly the rest of the window so the
 * picture can be sized to the screen. Replaces AppShell's 260px sidebar for
 * sessions (15 Nov 2026), which left the question a narrow centre column.
 */
export function SessionShell({ bar, children }: { bar: SessionBarProps; children: ReactNode }) {
  const motionRoot = useMotionRoot<HTMLDivElement>();
  return (
    <div ref={motionRoot} className="flex h-screen flex-col overflow-hidden" style={{ background: 'var(--pg)' }}>
      <SessionBar {...bar} />
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
