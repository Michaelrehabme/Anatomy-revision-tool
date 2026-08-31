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
import type { StructureMastery } from '../../types/attempt';
import { Button } from '../shared/Button';
import { AppShell } from '../shell/AppShell';
import { NavSidebar, type NavSection } from '../shell/NavSidebar';

const QUESTION_TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: 'mcq', label: 'Multiple choice' },
  { value: 'locate', label: 'Locate' },
  { value: 'identify-typed', label: 'Type answer' },
  { value: 'flashcard', label: 'Flashcard' },
];

const CATEGORY_OPTIONS: { value: Category | 'all'; label: string }[] = [
  { value: 'all', label: 'All categories' },
  { value: 'muscle', label: 'Muscles' },
  { value: 'bone', label: 'Bones' },
  { value: 'landmark', label: 'Landmarks' },
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

export function RevisionSetup({ content, repository, userId, regions, onStart, onBack, onNavigate }: RevisionSetupProps) {
  const [types, setTypes] = useState<QuestionType[]>(['mcq', 'locate']);
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [mode, setMode] = useState<'practice' | 'assessment'>('practice');
  const [count, setCount] = useState(20);
  const [useSrs, setUseSrs] = useState(true);
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
    let dueStructureIds: string[] | undefined;
    let mastery: StructureMastery[] = [];
    // Gated on the toggle: its copy promises "prioritise what's due over random
    // picks", so switching it off has to mean genuinely unweighted picks.
    if (useSrs && repository && userId) {
      const [due, allMastery] = await Promise.all([
        repository.listDueMastery(userId, new Date().toISOString()),
        repository.listMastery(userId),
      ]);
      mastery = allMastery;
      const pool = new Set(
        content.structures
          .filter((s) => (regions.size === 0 || regions.has(s.region)) && (category === 'all' || s.category === category))
          .map((s) => s.id),
      );
      const dueInPool = due.map((m) => m.structureId).filter((id) => pool.has(id));
      if (dueInPool.length > 0) dueStructureIds = dueInPool;
    }

    const params: RevisionSetupParams = {
      types,
      regions: regionsArray.length ? regionsArray : undefined,
      category: category === 'all' ? undefined : category,
      mode,
    };
    const questions = generateRevisionSet(content.structures, content.images, {
      types,
      regions: regionsArray,
      category: params.category,
      mode,
      count,
      // A priority, not a restriction: without the cap, answering a due structure
      // reschedules it, the queue refills itself and new material never gets in.
      priorityStructureIds: dueStructureIds,
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
                  onClick={() => setCount(n)}
                  aria-pressed={count === n}
                  className="inline-flex min-h-[56px] flex-1 items-center justify-center whitespace-nowrap rounded-[3px]"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 20,
                    border: count === n ? '1.4px solid var(--acc)' : '1.2px solid var(--line)',
                    background: count === n ? 'var(--accs)' : 'transparent',
                    color: count === n ? 'var(--accd)' : 'var(--ink2)',
                  }}
                >
                  {n}
                </button>
              ))}
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

            <label className="mt-7 flex cursor-pointer items-start gap-4">
              <span
                className="relative h-[31px] w-[52px] flex-none rounded-full transition-colors"
                style={{ background: mode === 'assessment' ? 'var(--acc)' : 'var(--line)' }}
              >
                <span
                  className="absolute top-[3px] h-[25px] w-[25px] rounded-full transition-all"
                  style={{ left: mode === 'assessment' ? 24 : 3, background: 'var(--sf)', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }}
                />
              </span>
              <span className="flex-1">
                <span className="block" style={{ fontFamily: 'var(--font-display)', fontSize: 19, lineHeight: 1.25 }}>
                  Assessment mode
                </span>
                <span className="mt-1 block text-sm" style={{ color: 'var(--ink3)' }}>
                  No feedback until the end.
                </span>
              </span>
              <input
                type="checkbox"
                checked={mode === 'assessment'}
                onChange={(e) => setMode(e.target.checked ? 'assessment' : 'practice')}
                className="sr-only"
              />
            </label>

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
