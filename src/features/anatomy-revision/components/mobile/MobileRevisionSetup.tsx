import { useState } from 'react';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { AnatomyRepository } from '../../data/repository';
import type { StructureMastery } from '../../types/attempt';
import type { QuestionType, RevisionQuestion } from '../../types/question';
import type { Region } from '../../types/region';
import { REGION_LABELS } from '../../types/region';
import { isMuscle } from '../../types/structure';
import { generateRevisionSet } from '../../lib/questionGenerators/generateSet';
import type { RevisionSetupParams } from '../../hooks/useRevisionSession';
import { MobileShell } from './MobileShell';

const FORMAT_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: 'flashcard', label: 'flashcard' },
  { value: 'mcq', label: 'multiple-choice' },
  { value: 'locate', label: 'locate' },
  { value: 'identify-typed', label: 'type-answer' },
];

const LENGTHS = [8, 15, 30];

interface MobileRevisionSetupProps {
  content: AnatomyContent;
  repository: AnatomyRepository | null;
  userId: string | null;
  regions: Set<Region>;
  onStart: (questions: RevisionQuestion[], params: RevisionSetupParams) => void;
  onBack: () => void;
}

function chipStyle(selected: boolean) {
  return selected
    ? { border: '1.2px solid var(--acc)', background: 'var(--accs)', color: 'var(--accd)' }
    : { border: '1.2px solid var(--line)', background: 'transparent', color: 'var(--ink3)' };
}

/** Screen 04 (mobile). No tab bar (not in the mockup's showTabs list) — a step within the Study flow. */
export function MobileRevisionSetup({ content, repository, userId, regions, onStart, onBack }: MobileRevisionSetupProps) {
  const [types, setTypes] = useState<QuestionType[]>(['mcq', 'locate', 'identify-typed']);
  const [count, setCount] = useState(15);
  const [useSrs, setUseSrs] = useState(true);
  const [starting, setStarting] = useState(false);

  const toggleType = (type: QuestionType) => {
    setTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  };

  const regionsArray = [...regions];
  const poolSize = content.structures.filter(isMuscle).filter((s) => regions.size === 0 || regions.has(s.region)).length;
  const canStart = types.length > 0 && poolSize > 0;

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
        content.structures.filter(isMuscle).filter((s) => regions.size === 0 || regions.has(s.region)).map((s) => s.id),
      );
      const dueInPool = due.map((m) => m.structureId).filter((id) => pool.has(id));
      if (dueInPool.length > 0) dueStructureIds = dueInPool;
    }

    const params: RevisionSetupParams = { types, regions: regionsArray, category: 'muscle', mode: 'practice' };
    const questions = generateRevisionSet(content.structures, content.images, {
      types,
      regions: regionsArray,
      category: 'muscle',
      mode: 'practice',
      count,
      // A priority, not a restriction: without the cap, answering a due structure
      // reschedules it, the queue refills itself and new material never gets in.
      priorityStructureIds: dueStructureIds,
      mastery,
    });
    onStart(questions, params);
  };

  const summary = `${regionsArray.length ? regionsArray.map((r) => REGION_LABELS[r]).join(', ') : 'No regions selected'} · ${poolSize} muscles in the pool.`;

  return (
    <MobileShell>
      <div className="px-6.5 pt-4 pb-7.5">
        <button type="button" onClick={onBack} className="border-0 bg-transparent p-0 pb-2.5" style={{ fontSize: 14.5, color: 'var(--ink3)' }}>
          &larr; Regions
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
        <p className="mt-3 text-[13px] leading-relaxed" style={{ color: 'var(--ink3)' }}>
          {types.includes('locate')
            ? 'Locate questions need hotspot data; regions without it fall back to multiple choice.'
            : 'Image questions are off — this session is text only.'}
        </p>

        <div
          className="mt-7.5"
          style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}
        >
          Length
        </div>
        <div className="mt-3.5 flex gap-2.5">
          {LENGTHS.map((n) => {
            const on = count === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setCount(n)}
                className="flex-1 rounded-[3px]"
                style={{ fontFamily: 'var(--font-display)', fontSize: 18, minHeight: 52, ...chipStyle(on) }}
              >
                {n}
              </button>
            );
          })}
        </div>

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
