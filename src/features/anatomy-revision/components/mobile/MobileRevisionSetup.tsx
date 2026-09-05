import { useState } from 'react';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { AnatomyRepository } from '../../data/repository';
import type { OinaPromptKind, QuestionType, RevisionQuestion } from '../../types/question';
import { OINA_PROMPT_KINDS } from '../../types/question';
import type { Area } from '../../types/region';
import { AREA_LABELS } from '../../types/region';
import type { Category } from '../../types/structure';
import { areaOf, isMuscle, MUSCLE_GROUP_LABELS } from '../../types/structure';
import { generateRevisionSet } from '../../lib/questionGenerators/generateSet';
import {
  LEARN_CARD_ATTEMPT_LABELS,
  LEARN_CARD_ATTEMPT_OPTIONS,
  getLearnCardAttempts,
  setLearnCardAttempts,
} from '../../lib/preferences';
import type { RevisionSetupParams } from '../../hooks/useRevisionSession';
import { MobileShell } from './MobileShell';

const FORMAT_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: 'flashcard', label: 'flashcard' },
  { value: 'mcq', label: 'multiple-choice' },
  { value: 'identify-typed', label: 'type-answer' },
  { value: 'multi-select', label: 'select-all' },
  { value: 'locate', label: 'locate' },
  { value: 'oina', label: 'OINA cards' },
];

const OINA_FACT_LABELS: Record<OinaPromptKind, string> = {
  origin: 'origin',
  insertion: 'insertion',
  nerve: 'nerve supply',
  action: 'action',
};

// Mirrors the desktop picker. Mobile was hardcoded to muscles before CR-017, which put
// 187 of the 309 structures — every bone, bony landmark and joint — out of reach on a
// phone, and left the area picker promising counts the session would not honour.
const CATEGORY_OPTIONS: { value: Category | 'all'; label: string }[] = [
  { value: 'all', label: 'all' },
  { value: 'muscle', label: 'muscles' },
  { value: 'bone', label: 'bones' },
  { value: 'landmark', label: 'landmarks' },
  { value: 'joint', label: 'joints' },
];

const LENGTHS = [8, 15, 30];

const SESSION_TYPE_OPTIONS: { value: 'practice' | 'adaptive' | 'assessment'; label: string }[] = [
  { value: 'practice', label: 'Study' },
  { value: 'adaptive', label: 'Adaptive' },
  { value: 'assessment', label: 'Exam' },
];

const TIMER_OPTIONS = [0, 10, 20, 30];

interface MobileRevisionSetupProps {
  content: AnatomyContent;
  repository: AnatomyRepository | null;
  userId: string | null;
  areas: Set<Area>;
  onStart: (questions: RevisionQuestion[], params: RevisionSetupParams) => void;
  onBack: () => void;
}

function chipStyle(selected: boolean) {
  return selected
    ? { border: '1.2px solid var(--acc)', background: 'var(--accs)', color: 'var(--accd)' }
    : { border: '1.2px solid var(--line)', background: 'transparent', color: 'var(--ink3)' };
}

/** Screen 04 (mobile). No tab bar (not in the mockup's showTabs list) — a step within the Study flow. */
export function MobileRevisionSetup({ content, repository, userId, areas, onStart, onBack }: MobileRevisionSetupProps) {
  const [types, setTypes] = useState<QuestionType[]>(['mcq', 'identify-typed']);
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [count, setCount] = useState(15);
  const [customLength, setCustomLength] = useState('');
  const [customActive, setCustomActive] = useState(false);
  const [useSrs, setUseSrs] = useState(true);
  const [mode, setMode] = useState<'practice' | 'adaptive' | 'assessment'>('practice');
  const [timerMinutes, setTimerMinutes] = useState(0);
  const [starting, setStarting] = useState(false);
  const [oinaFacts, setOinaFacts] = useState<OinaPromptKind[]>([...OINA_PROMPT_KINDS]);
  const [groups, setGroups] = useState<string[]>([]);
  const [learnCards, setLearnCards] = useState(getLearnCardAttempts);

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
  // See RevisionSetup: an OINA session covers every fact in scope, not a fixed count.
  const oinaMuscleCount = content.structures.filter((s) => isMuscle(s) && inPool(s)).length;
  const oinaQuestionCount = oinaMuscleCount * oinaFacts.length;
  const canStart = types.length > 0 && poolSize > 0 && (!oinaSelected || oinaFacts.length > 0);

  const handleStart = async () => {
    setStarting(true);
    let dueStructureIds: string[] | undefined;
    if (useSrs && mode !== 'adaptive' && repository && userId) {
      const due = await repository.listDueMastery(userId, new Date().toISOString());
      const pool = new Set(content.structures.filter(inPool).map((s) => s.id));
      const dueInPool = due.map((m) => m.structureId).filter((id) => pool.has(id));
      if (dueInPool.length > 0) dueStructureIds = dueInPool;
    }

    const mastery = mode === 'adaptive' && repository && userId ? await repository.listMastery(userId) : undefined;
    const factMastery = oinaSelected && repository && userId ? await repository.listFactMastery(userId) : undefined;

    const params: RevisionSetupParams = {
      types,
      areas: areasArray,
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
      category: category === 'all' ? undefined : category,
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

  const noun = category === 'all' ? 'structures' : category === 'muscle' ? 'muscles' : `${category}s`;
  const summary = `${areasArray.length ? areasArray.map((a) => AREA_LABELS[a]).join(', ') : 'All areas'} · ${poolSize} ${noun} in the pool.`;

  return (
    <MobileShell>
      <div className="px-6.5 pt-4 pb-7.5">
        <button type="button" onClick={onBack} className="border-0 bg-transparent p-0 pb-2.5" style={{ fontSize: 14.5, color: 'var(--ink3)' }}>
          &larr; Areas
        </button>
        <h2
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 33, lineHeight: 1.05, letterSpacing: '-.02em', margin: '2px 0 4px' }}
        >
          Session
        </h2>
        <p className="mb-6.5" style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--ink3)' }}>
          {summary}
        </p>

        <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
          Question formats
        </div>
        <div className="mt-3.5 flex flex-wrap gap-2.5">
          {FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleType(opt.value)}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full px-4.5"
              style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, ...chipStyle(types.includes(opt.value)) }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {oinaSelected && (
          <>
            <div
              className="mt-7.5"
              style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
            >
              OINA facts
            </div>
            <div className="mt-3.5 flex flex-wrap gap-2.5">
              {OINA_PROMPT_KINDS.map((fact) => (
                <button
                  key={fact}
                  type="button"
                  onClick={() => toggleFact(fact)}
                  aria-pressed={oinaFacts.includes(fact)}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-full px-4.5"
                  style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, ...chipStyle(oinaFacts.includes(fact)) }}
                >
                  {OINA_FACT_LABELS[fact]}
                </button>
              ))}
            </div>

            <div
              className="mt-7.5"
              style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
            >
              Show the answer first
            </div>
            <div className="mt-3.5 flex flex-wrap gap-2.5">
              {LEARN_CARD_ATTEMPT_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => chooseLearnCards(n)}
                  aria-pressed={learnCards === n}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-full px-4.5"
                  style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, ...chipStyle(learnCards === n) }}
                >
                  {LEARN_CARD_ATTEMPT_LABELS[n]}
                </button>
              ))}
            </div>

            <div
              className="mt-7.5"
              style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
            >
              Muscle group
            </div>
            <div className="mt-3.5 flex flex-wrap gap-2.5">
              {availableGroups.map((group) => (
                <button
                  key={group}
                  type="button"
                  onClick={() => toggleGroup(group)}
                  aria-pressed={groups.includes(group)}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-full px-4.5"
                  style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, ...chipStyle(groups.includes(group)) }}
                >
                  {MUSCLE_GROUP_LABELS[group]}
                </button>
              ))}
            </div>
          </>
        )}

        <div
          className="mt-7.5"
          style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
        >
          Category
        </div>
        <div className="mt-3.5 flex flex-wrap gap-2.5">
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setCategory(opt.value)}
              aria-pressed={category === opt.value}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full px-4.5"
              style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, ...chipStyle(category === opt.value) }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div
          className="mt-7.5"
          style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
        >
          Length
        </div>
        {oinaSelected ? (
          <div className="mt-3.5 rounded-[3px] px-4 py-3.5" style={{ border: '1.2px solid var(--line)', background: 'var(--sf)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink)' }}>Every card in scope</div>
            <p className="mt-1 text-[13px] leading-relaxed" style={{ color: 'var(--ink3)' }}>
              {oinaQuestionCount} questions — {oinaFacts.length} fact{oinaFacts.length === 1 ? '' : 's'} for each of{' '}
              {oinaMuscleCount} muscle{oinaMuscleCount === 1 ? '' : 's'}.
            </p>
          </div>
        ) : (
          <div className="mt-3.5 flex gap-2.5">
            {LENGTHS.map((n) => {
              const on = !customActive && count === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setCount(n);
                    setCustomActive(false);
                  }}
                  className="flex-1 rounded-[3px]"
                  style={{ fontFamily: 'var(--font-display)', fontSize: 18, minHeight: 52, ...chipStyle(on) }}
                >
                  {n}
                </button>
              );
            })}
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
              aria-label="Custom session length"
              className="w-0 flex-1 rounded-[3px] text-center"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                minHeight: 52,
                ...chipStyle(customActive),
              }}
            />
          </div>
        )}

        <div
          className="mt-7.5"
          style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
        >
          Session type
        </div>
        <div className="mt-3.5 flex gap-2.5">
          {SESSION_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMode(opt.value)}
              className="flex-1 rounded-[3px]"
              style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, minHeight: 46, ...chipStyle(mode === opt.value) }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="mt-2.5 text-[13px] leading-relaxed" style={{ color: 'var(--ink3)' }}>
          {mode === 'practice' && 'Immediate feedback, self-paced, no timer.'}
          {mode === 'adaptive' && 'Weighted toward what’s due and weak, still with feedback.'}
          {mode === 'assessment' && 'No feedback until the end. Scored report, optional timer.'}
        </p>

        {mode === 'assessment' && (
          <>
            <div
              className="mt-6"
              style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
            >
              Timer
            </div>
            <div className="mt-3.5 flex gap-2">
              {TIMER_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setTimerMinutes(n)}
                  className="flex-1 rounded-[3px] text-sm"
                  style={{ minHeight: 42, ...chipStyle(timerMinutes === n) }}
                >
                  {n === 0 ? 'None' : `${n}m`}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="mt-7.5 flex items-start gap-3.5">
          <button
            type="button"
            onClick={() => setUseSrs((v) => !v)}
            className="relative h-[31px] w-[52px] flex-none rounded-full border-0 p-0"
            style={{ background: useSrs ? 'var(--acc)' : 'var(--fig-line)' }}
          >
            <span
              className="absolute top-[3px] h-[25px] w-[25px] rounded-full transition-all"
              style={{ left: useSrs ? 24 : 3, background: 'var(--sf)', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }}
            />
          </button>
          <span style={{ fontSize: 15, lineHeight: 1.45, color: 'var(--ink2)' }}>
            Weight toward structures that are due
            <br />
            <span style={{ fontSize: 13, color: 'var(--ink3)' }}>
              {useSrs ? 'Overdue structures come up first, then new ones.' : 'Uniform random across the whole pool.'}
            </span>
          </span>
        </div>

        <button
          type="button"
          onClick={handleStart}
          disabled={!canStart || starting}
          className="mt-8 w-full rounded-[3px] border-0 disabled:opacity-45"
          style={{ minHeight: 54, background: 'var(--acc)', color: 'var(--onacc)', font: '500 17px/1 var(--font-ui)' }}
        >
          {starting ? 'Starting…' : `Begin — ${count} questions`}
        </button>
      </div>
    </MobileShell>
  );
}
