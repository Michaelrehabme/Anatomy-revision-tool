import { useState } from 'react';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { QuestionType } from '../../types/question';
import type { Category } from '../../types/structure';
import type { Region } from '../../types/region';
import { REGIONS, REGION_LABELS } from '../../types/region';
import { generateRevisionSet } from '../../lib/questionGenerators/generateSet';
import type { RevisionSetupParams } from '../../hooks/useRevisionSession';
import type { RevisionQuestion } from '../../types/question';

const QUESTION_TYPE_OPTIONS: { value: QuestionType; label: string; description: string }[] = [
  { value: 'flashcard', label: 'Flashcards', description: 'Flip cards, self-rate your recall.' },
  { value: 'mcq', label: 'Multiple choice', description: 'Pick the correct answer from 4 options.' },
  { value: 'locate', label: 'Locate the structure', description: 'Tap the structure on an image.' },
];

const CATEGORY_OPTIONS: { value: Category | 'all'; label: string }[] = [
  { value: 'all', label: 'All categories' },
  { value: 'muscle', label: 'Muscles' },
  { value: 'bone', label: 'Bones' },
  { value: 'landmark', label: 'Landmarks' },
];

interface RevisionSetupProps {
  content: AnatomyContent;
  onStart: (questions: RevisionQuestion[], params: RevisionSetupParams) => void;
}

export function RevisionSetup({ content, onStart }: RevisionSetupProps) {
  const [types, setTypes] = useState<QuestionType[]>(['flashcard', 'mcq']);
  const [region, setRegion] = useState<Region | 'all'>('all');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [mode, setMode] = useState<'practice' | 'assessment'>('practice');
  const [count, setCount] = useState(10);

  const toggleType = (type: QuestionType) => {
    setTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  };

  const canStart = types.length > 0 && !content.loading;

  const handleStart = () => {
    const params: RevisionSetupParams = {
      types,
      region: region === 'all' ? undefined : region,
      category: category === 'all' ? undefined : category,
      mode,
    };
    const questions = generateRevisionSet(content.structures, content.images, {
      types,
      region: params.region,
      category: params.category,
      mode,
      count: mode === 'assessment' ? count : undefined,
    });
    onStart(questions, params);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Anatomy Revision</h1>
        <p className="mt-1 text-sm text-slate-600">
          Set up a session across muscles, bones, and landmarks.
        </p>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Question types</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {QUESTION_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleType(opt.value)}
              className={`rounded-lg border p-3 text-left transition ${
                types.includes(opt.value)
                  ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
              aria-pressed={types.includes(opt.value)}
            >
              <div className="text-sm font-medium text-slate-900">{opt.label}</div>
              <div className="mt-0.5 text-xs text-slate-500">{opt.description}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Region</span>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value as Region | 'all')}
            className="w-full rounded-md border border-slate-300 p-2 text-sm"
          >
            <option value="all">All regions</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {REGION_LABELS[r]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category | 'all')}
            className="w-full rounded-md border border-slate-300 p-2 text-sm"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Mode</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('practice')}
            className={`flex-1 rounded-lg border p-3 text-sm ${mode === 'practice' ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600' : 'border-slate-200 bg-white'}`}
          >
            Practice — every matching question, once
          </button>
          <button
            type="button"
            onClick={() => setMode('assessment')}
            className={`flex-1 rounded-lg border p-3 text-sm ${mode === 'assessment' ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600' : 'border-slate-200 bg-white'}`}
          >
            Assessment — fixed-size random sample
          </button>
        </div>
        {mode === 'assessment' && (
          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Number of questions: {count}</span>
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full"
            />
          </label>
        )}
      </section>

      <button
        type="button"
        disabled={!canStart}
        onClick={handleStart}
        className="w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition enabled:hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {content.loading ? 'Loading content…' : 'Start revision'}
      </button>
    </div>
  );
}
