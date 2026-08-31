import { useState } from 'react';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { QuestionType } from '../../types/question';
import type { Category } from '../../types/structure';
import type { Region } from '../../types/region';
import { REGION_LABELS } from '../../types/region';
import { generateRevisionSet } from '../../lib/questionGenerators/generateSet';
import type { RevisionSetupParams } from '../../hooks/useRevisionSession';
import type { RevisionQuestion } from '../../types/question';
import type { AnatomyRepository } from '../../data/repository';
import { Button } from '../shared/Button';
import { AppShell } from '../shell/AppShell';
import { NavSidebar, type NavSection } from '../shell/NavSidebar';

// 'locate' is intentionally not offered here — see images.seed.ts's panel-crop comment
// (CR-016): no image in the current dataset is suited to a locate question, since every
// single-muscle panel already highlights its target muscle rather than staying neutral.
const QUESTION_TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: 'mcq', label: 'Multiple choice' },
  { value: 'identify-typed', label: 'Type answer' },
  { value: 'flashcard', label: 'Flashcard' },
  { value: 'multi-select', label: 'Select all' },
];

const CATEGORY_OPTIONS: { value: Category | 'all'; label: string }[] = [
  { value: 'all', label: 'All categories' },
  { value: 'muscle', label: 'Muscles' },
  { value: 'bone', label: 'Bones' },
  { value: 'landmark', label: 'Landmarks' },
  { value: 'joint', label: 'Joints' },
];

const LENGTHS = [10, 20, 40];

interface RevisionSetupProps {
  content: AnatomyContent;
  repository: AnatomyRepository | null;
  userId: string | null;
  regions: Set<Region>;
  onStart: (questions: RevisionQuestion[], params: RevisionSetupParams) => void;
  onBack: () => void;
  onNavigate: (section: NavSection) => void;
}

function chipStyle(selected: boolean) {
  return selected
    ? { border: '1.2px solid var(--acc)', background: 'var(--accs)', color: 'var(--accd)' }
    : { border: '1.2px solid var(--line)', background: 'transparent', color: 'var(--ink2)' };
}

const SESSION_TYPE_OPTIONS: { value: 'practice' | 'adaptive' | 'assessment'; label: string; blurb: string }[] = [
  { value: 'practice', label: 'Study', blurb: 'Immediate feedback, self-paced, no timer.' },
  { value: 'adaptive', label: 'Adaptive', blurb: 'Weighted toward what’s due and weak, still with feedback.' },
  { value: 'assessment', label: 'Exam', blurb: 'No feedback until the end. Scored report, optional timer.' },
];

const TIMER_OPTIONS = [0, 10, 20, 30];

export function RevisionSetup({ content, repository, userId, regions, onStart, onBack, onNavigate }: RevisionSetupProps) {
  const [types, setTypes] = useState<QuestionType[]>(['mcq']);
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [mode, setMode] = useState<'practice' | 'assessment' | 'adaptive'>('practice');
  const [count, setCount] = useState(20);
  const [customLength, setCustomLength] = useState('');
  const [customActive, setCustomActive] = useState(false);
  const [useSrs, setUseSrs] = useState(true);
  const [timerMinutes, setTimerMinutes] = useState(0);
  const [starting, setStarting] = useState(false);

  const toggleType = (type: QuestionType) => {
    setTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  };

  const regionsArray = [...regions];
  const poolSize = content.structures.filter(
    (s) => (regions.size === 0 || regions.has(s.region)) && (category === 'all' || s.category === category),
  ).length;
  const canStart = types.length > 0 && !content.loading && poolSize > 0;

  const handleStart = async () => {
    setStarting(true);
    let structureIds: string[] | undefined;
    // Adaptive mode does its own due/weak/known weighting over the full pool — a due-only
    // pre-filter would fight it, so the SRS toggle only applies to practice/exam.
    if (useSrs && mode !== 'adaptive' && repository && userId) {
      const due = await repository.listDueMastery(userId, new Date().toISOString());
      const pool = new Set(
        content.structures
          .filter((s) => (regions.size === 0 || regions.has(s.region)) && (category === 'all' || s.category === category))
          .map((s) => s.id),
      );
      const dueInPool = due.map((m) => m.structureId).filter((id) => pool.has(id));
      if (dueInPool.length > 0) structureIds = dueInPool;
    }

    const mastery = mode === 'adaptive' && repository && userId ? await repository.listMastery(userId) : undefined;

    const params: RevisionSetupParams = {
      types,
      regions: regionsArray.length ? regionsArray : undefined,
      category: category === 'all' ? undefined : category,
      mode,
      timerMinutes: mode === 'assessment' && timerMinutes > 0 ? timerMinutes : undefined,
    };
    const questions = generateRevisionSet(content.structures, content.images, {
      types,
      regions: regionsArray,
      category: params.category,
      mode,
      count,
      structureIds,
      mastery,
    });
    onStart(questions, params);
  };

  const regionSummary = regionsArray.length ? regionsArray.map((r) => REGION_LABELS[r]).join(', ') : 'All regions';

  return (
    <AppShell
      sidebar={
        <NavSidebar
          active="study"
          onNavigate={onNavigate}
          footer={
            <div style={{ font: '400 11.5px/1.6 var(--font-mono)', color: 'var(--ink3)' }}>
              Step 2 of 2
              <br />
              Session
            </div>
          }
        />
      }
    >
      <div className="flex flex-col px-16 pt-16 pb-14">
        <button type="button" onClick={onBack} className="mb-3 text-left text-[15px]" style={{ color: 'var(--ink3)' }}>
          &larr; Regions
        </button>
        <h2
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 52, lineHeight: 1.02, letterSpacing: '-.026em', margin: '0 0 10px' }}
        >
          Session
        </h2>
        <p className="text-base" style={{ color: 'var(--ink2)' }}>
          {regionSummary} · {poolSize} {category === 'all' ? 'structures' : category === 'muscle' ? 'muscles' : `${category}s`} in the pool
        </p>

        <div className="mt-14 flex gap-[88px]">
          <div className="flex flex-1 flex-col">
            <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
              Question formats
            </div>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {QUESTION_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleType(opt.value)}
                  aria-pressed={types.includes(opt.value)}
                  className="inline-flex min-h-[46px] items-center justify-center whitespace-nowrap rounded-full px-5"
                  style={{ fontFamily: 'var(--font-display)', fontSize: 17, ...chipStyle(types.includes(opt.value)) }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-3.5 max-w-[44ch] text-sm" style={{ color: 'var(--ink3)' }}>
              Mixed formats interleave within one session.
            </p>

            <div
              className="mt-12"
              style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
            >
              Category
            </div>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {CATEGORY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCategory(opt.value)}
                  aria-pressed={category === opt.value}
                  className="inline-flex min-h-[40px] items-center justify-center whitespace-nowrap rounded-full px-4 text-sm"
                  style={chipStyle(category === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="w-[380px] flex-none">
            <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
              Length
            </div>
            <div className="mt-4 flex gap-2.5">
              {LENGTHS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setCount(n);
                    setCustomActive(false);
                  }}
                  aria-pressed={!customActive && count === n}
                  className="inline-flex min-h-[56px] flex-1 items-center justify-center whitespace-nowrap rounded-[3px]"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 20,
                    border: !customActive && count === n ? '1.4px solid var(--acc)' : '1.2px solid var(--line)',
                    background: !customActive && count === n ? 'var(--accs)' : 'transparent',
                    color: !customActive && count === n ? 'var(--accd)' : 'var(--ink2)',
                  }}
                >
                  {n}
                </button>
              ))}
              <input
                type="number"
                min={1}
                inputMode="numeric"
                placeholder="Custom"
                value={customLength}
                onFocus={() => setCustomActive(true)}
                onChange={(e) => {
                  const raw = e.target.value;
                  setCustomLength(raw);
                  setCustomActive(true);
                  const n = parseInt(raw, 10);
                  if (!Number.isNaN(n) && n > 0) setCount(n);
                }}
                aria-pressed={customActive}
                aria-label="Custom session length"
                className="inline-flex min-h-[56px] w-0 flex-1 items-center justify-center whitespace-nowrap rounded-[3px] text-center"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 20,
                  border: customActive ? '1.4px solid var(--acc)' : '1.2px solid var(--line)',
                  background: customActive ? 'var(--accs)' : 'transparent',
                  color: customActive ? 'var(--accd)' : 'var(--ink2)',
                }}
              />
            </div>

            <label className="mt-12 flex cursor-pointer items-start gap-4">
              <span
                className="relative h-[31px] w-[52px] flex-none rounded-full transition-colors"
                style={{ background: useSrs ? 'var(--acc)' : 'var(--line)' }}
              >
                <span
                  className="absolute top-[3px] h-[25px] w-[25px] rounded-full transition-all"
                  style={{ left: useSrs ? 24 : 3, background: 'var(--sf)', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }}
                />
              </span>
              <span className="flex-1">
                <span className="block" style={{ fontFamily: 'var(--font-display)', fontSize: 19, lineHeight: 1.25 }}>
                  Spaced repetition
                </span>
                <span className="mt-1 block text-sm" style={{ color: 'var(--ink3)' }}>
                  Prioritise what&rsquo;s due over random picks.
                </span>
              </span>
              <input type="checkbox" checked={useSrs} onChange={(e) => setUseSrs(e.target.checked)} className="sr-only" />
            </label>

            <div
              className="mt-10"
              style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
            >
              Session type
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {SESSION_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMode(opt.value)}
                  aria-pressed={mode === opt.value}
                  className="flex flex-col items-start rounded-[3px] px-4 py-3 text-left"
                  style={{
                    border: mode === opt.value ? '1.4px solid var(--acc)' : '1.2px solid var(--line)',
                    background: mode === opt.value ? 'var(--accs)' : 'transparent',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: mode === opt.value ? 'var(--accd)' : 'var(--ink)' }}>
                    {opt.label}
                  </span>
                  <span className="mt-0.5 text-sm" style={{ color: 'var(--ink3)' }}>
                    {opt.blurb}
                  </span>
                </button>
              ))}
            </div>

            {mode === 'assessment' && (
              <div className="mt-4">
                <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
                  Timer
                </div>
                <div className="mt-3 flex gap-2">
                  {TIMER_OPTIONS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setTimerMinutes(n)}
                      aria-pressed={timerMinutes === n}
                      className="flex-1 rounded-[3px] py-2.5 text-sm"
                      style={{
                        border: timerMinutes === n ? '1.4px solid var(--acc)' : '1.2px solid var(--line)',
                        background: timerMinutes === n ? 'var(--accs)' : 'transparent',
                        color: timerMinutes === n ? 'var(--accd)' : 'var(--ink2)',
                      }}
                    >
                      {n === 0 ? 'No timer' : `${n} min`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={handleStart}
              disabled={!canStart || starting}
              className="mt-10 min-h-[58px] w-full"
            >
              {content.loading ? 'Loading content…' : starting ? 'Starting…' : 'Begin session'}
            </Button>
            <p className="mt-3.5 text-center" style={{ font: '400 12.5px/1.6 var(--font-mono)', color: 'var(--ink3)' }}>
              {count} questions · about {Math.max(1, Math.round(count * 0.45))} minutes
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
