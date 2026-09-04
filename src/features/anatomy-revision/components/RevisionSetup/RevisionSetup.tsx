import { useState } from 'react';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { OinaPromptKind, QuestionType } from '../../types/question';
import { OINA_PROMPT_KINDS } from '../../types/question';
import type { Category } from '../../types/structure';
import type { Area } from '../../types/region';
import { AREA_LABELS } from '../../types/region';
import { areaOf, isMuscle, MUSCLE_GROUP_LABELS } from '../../types/structure';
import { generateRevisionSet } from '../../lib/questionGenerators/generateSet';
import {
  LEARN_CARD_ATTEMPT_LABELS,
  LEARN_CARD_ATTEMPT_OPTIONS,
  getLearnCardAttempts,
  setLearnCardAttempts,
} from '../../lib/preferences';
import type { RevisionSetupParams } from '../../hooks/useRevisionSession';
import type { RevisionQuestion } from '../../types/question';
import type { AnatomyRepository } from '../../data/repository';
import { Button } from '../shared/Button';
import { AppShell } from '../shell/AppShell';
import { NavSidebar, type NavSection } from '../shell/NavSidebar';

const QUESTION_TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: 'mcq', label: 'Multiple choice' },
  { value: 'identify-typed', label: 'Type answer' },
  { value: 'flashcard', label: 'Flashcard' },
  { value: 'multi-select', label: 'Select all' },
  { value: 'locate', label: 'Locate' },
  { value: 'oina', label: 'OINA Cards' },
];

const OINA_FACT_LABELS: Record<OinaPromptKind, string> = {
  origin: 'Origin',
  insertion: 'Insertion',
  nerve: 'Nerve supply',
  action: 'Action',
};

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
  areas: Set<Area>;
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

export function RevisionSetup({ content, repository, userId, areas, onStart, onBack, onNavigate }: RevisionSetupProps) {
  const [types, setTypes] = useState<QuestionType[]>(['mcq']);
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [mode, setMode] = useState<'practice' | 'assessment' | 'adaptive'>('practice');
  const [count, setCount] = useState(20);
  const [customLength, setCustomLength] = useState('');
  const [customActive, setCustomActive] = useState(false);
  const [useSrs, setUseSrs] = useState(true);
  const [oinaFacts, setOinaFacts] = useState<OinaPromptKind[]>([...OINA_PROMPT_KINDS]);
  const [groups, setGroups] = useState<string[]>([]);
  // Sticky across sessions — how many repeats help is a property of the
  // student, not of one session (see lib/preferences.ts).
  const [learnCards, setLearnCards] = useState(getLearnCardAttempts);
  const [timerMinutes, setTimerMinutes] = useState(0);
  const [starting, setStarting] = useState(false);

  const chooseLearnCards = (value: number) => {
    setLearnCards(value);
    setLearnCardAttempts(value);
  };

  const toggleType = (type: QuestionType) => {
    setTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  };

  const oinaSelected = types.includes('oina');
  const toggleFact = (fact: OinaPromptKind) => {
    setOinaFacts((prev) => (prev.includes(fact) ? prev.filter((f) => f !== fact) : [...prev, fact]));
  };
  const toggleGroup = (group: string) => {
    setGroups((prev) => (prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]));
  };

  // Only groups that actually have muscles in the chosen areas — offering an
  // empty one is the same dead end CR-017 removed from the area picker.
  const availableGroups = Object.keys(MUSCLE_GROUP_LABELS).filter((group) =>
    content.structures.some(
      (s) => isMuscle(s) && (s.groups ?? []).includes(group) && (areas.size === 0 || (!!areaOf(s) && areas.has(areaOf(s)!))),
    ),
  );

  const areasArray = [...areas];
  const inPool = (s: (typeof content.structures)[number]) => {
    const area = areaOf(s);
    return (
      (areas.size === 0 || (!!area && areas.has(area))) &&
      (category === 'all' || s.category === category) &&
      (groups.length === 0 || (s.groups ?? []).some((g) => groups.includes(g)))
    );
  };
  const poolSize = content.structures.filter(inPool).length;
  // An OINA session covers every fact of every muscle in scope rather than a
  // fixed number of questions — "do the hamstrings" is the unit a student
  // thinks in, and a 20-question cap would leave a group half-learned with no
  // indication of which half. Exact, not an estimate: validateContent asserts
  // every muscle yields a question for all four facts.
  const oinaMuscleCount = content.structures.filter((s) => isMuscle(s) && inPool(s)).length;
  const oinaQuestionCount = oinaMuscleCount * oinaFacts.length;
  const effectiveCount = oinaSelected ? oinaQuestionCount : count;
  const canStart = types.length > 0 && !content.loading && poolSize > 0 && (!oinaSelected || oinaFacts.length > 0);

  const handleStart = async () => {
    setStarting(true);
    let dueStructureIds: string[] | undefined;
    // Adaptive mode does its own due/weak/known weighting over the full pool — a due-only
    // pre-filter would fight it, so the SRS toggle only applies to practice/exam.
    if (useSrs && mode !== 'adaptive' && repository && userId) {
      const due = await repository.listDueMastery(userId, new Date().toISOString());
      const pool = new Set(content.structures.filter(inPool).map((s) => s.id));
      const dueInPool = due.map((m) => m.structureId).filter((id) => pool.has(id));
      if (dueInPool.length > 0) dueStructureIds = dueInPool;
    }

    const mastery = mode === 'adaptive' && repository && userId ? await repository.listMastery(userId) : undefined;
    // generateSet stays repository-free (CR-009), so fact mastery is fetched here and
    // passed in — it decides both the select/typed format per fact and whether a
    // question is preceded by its teaching flashcard.
    const factMastery = oinaSelected && repository && userId ? await repository.listFactMastery(userId) : undefined;

    const params: RevisionSetupParams = {
      types,
      areas: areasArray.length ? areasArray : undefined,
      groups: groups.length ? groups : undefined,
      oinaPromptKinds: oinaSelected ? oinaFacts : undefined,
      learnCardAttempts: oinaSelected ? learnCards : undefined,
      category: category === 'all' ? undefined : category,
      mode,
      timerMinutes: mode === 'assessment' && timerMinutes > 0 ? timerMinutes : undefined,
    };
    const questions = generateRevisionSet(content.structures, content.images, {
      types,
      areas: areasArray,
      groups: params.groups,
      oinaPromptKinds: params.oinaPromptKinds,
      learnCardAttempts: params.learnCardAttempts,
      category: params.category,
      mode,
      // Undefined caps nothing: practice mode then emits every eligible question,
      // which is what an OINA session is for (CR-018).
      count: oinaSelected ? undefined : count,
      // Prioritised, not restricted — see the toggle's own copy. A hard due-only
      // filter refills its own queue, since answering a due structure reschedules it.
      priorityStructureIds: dueStructureIds,
      mastery,
      factMastery,
    });
    onStart(questions, params);
  };

  const areaSummary = areasArray.length ? areasArray.map((a) => AREA_LABELS[a]).join(', ') : 'All areas';

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
          &larr; Areas
        </button>
        <h2
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 52, lineHeight: 1.02, letterSpacing: '-.026em', margin: '0 0 10px' }}
        >
          Session
        </h2>
        <p className="text-base" style={{ color: 'var(--ink2)' }}>
          {areaSummary} · {poolSize} {category === 'all' ? 'structures' : category === 'muscle' ? 'muscles' : `${category}s`} in the pool
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

            {oinaSelected && (
              <>
                <div
                  className="mt-12"
                  style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
                >
                  OINA facts
                </div>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  {OINA_PROMPT_KINDS.map((fact) => (
                    <button
                      key={fact}
                      type="button"
                      onClick={() => toggleFact(fact)}
                      aria-pressed={oinaFacts.includes(fact)}
                      className="inline-flex min-h-[40px] items-center justify-center whitespace-nowrap rounded-full px-4 text-sm"
                      style={chipStyle(oinaFacts.includes(fact))}
                    >
                      {OINA_FACT_LABELS[fact]}
                    </button>
                  ))}
                </div>
                <p className="mt-3.5 max-w-[44ch] text-sm" style={{ color: 'var(--ink3)' }}>
                  Multiple choice to begin with; each fact switches to typed recall once
                  you have it consistently right.
                </p>

                <div
                  className="mt-12"
                  style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
                >
                  Show the answer first
                </div>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  {LEARN_CARD_ATTEMPT_OPTIONS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => chooseLearnCards(n)}
                      aria-pressed={learnCards === n}
                      className="inline-flex min-h-[40px] items-center justify-center whitespace-nowrap rounded-full px-4 text-sm"
                      style={chipStyle(learnCards === n)}
                    >
                      {LEARN_CARD_ATTEMPT_LABELS[n]}
                    </button>
                  ))}
                </div>
                <p className="mt-3.5 max-w-[44ch] text-sm" style={{ color: 'var(--ink3)' }}>
                  {learnCards === 0
                    ? 'Straight to the question, every time.'
                    : `A flashcard comes first for your first ${learnCards === 1 ? 'attempt' : `${learnCards} attempts`} at each fact, and again whenever you get one wrong. Learn cards are never scored.`}
                </p>

                <div
                  className="mt-12"
                  style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
                >
                  Muscle group <span style={{ textTransform: 'none', letterSpacing: 0 }}>· optional</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  {availableGroups.map((group) => (
                    <button
                      key={group}
                      type="button"
                      onClick={() => toggleGroup(group)}
                      aria-pressed={groups.includes(group)}
                      className="inline-flex min-h-[40px] items-center justify-center whitespace-nowrap rounded-full px-4 text-sm"
                      style={chipStyle(groups.includes(group))}
                    >
                      {MUSCLE_GROUP_LABELS[group]}
                    </button>
                  ))}
                </div>
              </>
            )}

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
            {oinaSelected ? (
              <div className="mt-4 rounded-[3px] px-5 py-4" style={{ border: '1.2px solid var(--line)', background: 'var(--sf)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink)' }}>
                  Every card in scope
                </div>
                <p className="mt-1.5 text-sm" style={{ color: 'var(--ink3)' }}>
                  {oinaQuestionCount} questions — {oinaFacts.length} fact{oinaFacts.length === 1 ? '' : 's'} for each of{' '}
                  {oinaMuscleCount} muscle{oinaMuscleCount === 1 ? '' : 's'}.
                  {groups.length === 0 && ' Narrow it with a muscle group below.'}
                </p>
              </div>
            ) : (
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
            )}

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
              {effectiveCount} questions · about {Math.max(1, Math.round(effectiveCount * 0.45))} minutes
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
