import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { UseEntitlement } from '../../hooks/useEntitlement';
import type { UseStudyProfile } from '../../hooks/useStudyProfile';
import type { FactMastery, StructureMastery } from '../../types/attempt';
import { AREA_LABELS, type Area } from '../../types/region';
import { areasOf, CATEGORIES, CATEGORY_LABELS, type Category } from '../../types/structure';
import { factsIndex } from '../../lib/masteryLevel';
import type { ReviewItem } from '../../lib/reviewQueue';
import {
  currentFocus,
  focusStanding,
  previousFocus,
  suggestFocusArea,
  suggestFocusCategory,
  weekStartOf,
  type FocusStanding,
  type WeeklyFocus,
} from '../../lib/studyProfile';
import { LockPill } from './AreaLock';

const eyebrow = {
  font: '500 10px/1 var(--font-mono)',
  letterSpacing: '.16em',
  textTransform: 'uppercase',
  color: 'var(--ink3)',
} as const;

function chipStyle(on: boolean) {
  return {
    fontFamily: 'var(--font-display)',
    fontSize: 14.5,
    border: on ? '1.2px solid var(--acc)' : '1.2px solid var(--line)',
    background: on ? 'var(--accs)' : 'transparent',
    color: on ? 'var(--accd)' : 'var(--ink2)',
  };
}

/** "Knee", or on the free tier "Shoulder ligaments". */
export function focusLabel(focus: Pick<WeeklyFocus, 'area' | 'category'>, freeArea?: Area): string {
  const area = focus.area ?? freeArea;
  if (focus.category) return `${area ? `${AREA_LABELS[area]} ` : ''}${CATEGORY_LABELS[focus.category].toLowerCase()}`;
  return area ? AREA_LABELS[area] : '';
}

interface WeeklyFocusCardProps {
  access: UseEntitlement;
  content: Pick<AnatomyContent, 'index' | 'structuresById'>;
  studyProfile: UseStudyProfile;
  mastery: readonly StructureMastery[];
  facts: readonly FactMastery[];
  reviewItems: readonly ReviewItem[];
  loading: boolean;
  onStartFocus: (focus: WeeklyFocus) => void;
  /** Mobile: full-width buttons, smaller type. */
  compact?: boolean;
}

/**
 * This week's focus (owner, 19 Oct 2026). One area a week — or, on the free
 * tier, one kind of structure in its one area — gets a session of its own,
 * with more new material than the daily review takes. The daily review goes
 * on beside it for the rest of the body.
 *
 * Each Monday the card asks again rather than carrying last week's choice
 * over: it lights the area where the fewest structures are secure (nudged by
 * the questionnaire), and the student confirms it or picks another.
 */
export function WeeklyFocusCard({ access, content, studyProfile, mastery, facts, reviewItems, loading, onStartFocus, compact = false }: WeeklyFocusCardProps) {
  const now = new Date();
  const { profile, update } = studyProfile;
  const free = access.tier === 'free';
  const freeArea = free ? access.areas[0] : undefined;
  const focus = currentFocus(profile, now, access.areas);
  const lastWeek = previousFocus(profile, now);
  const [picking, setPicking] = useState(false);

  const masteryById = useMemo(() => new Map(mastery.map((m) => [m.structureId, m])), [mastery]);
  const factsByKey = useMemo(() => factsIndex([...facts]), [facts]);
  const standing = (scope: { area?: Area; category?: Category }): FocusStanding =>
    focusStanding(content.index, masteryById, factsByKey, free ? { ...scope, area: freeArea } : scope, now);

  // Every structure's level in every area: worked out once per change of
  // history or answers, not on every render.
  const areasKey = access.areas.join(',');
  const suggestion = useMemo<WeeklyFocus | null>(() => {
    const week = weekStartOf(new Date());
    if (free) {
      const category = suggestFocusCategory((c) => standing({ category: c }), profile, lastWeek?.category);
      return category ? { category, weekStart: week } : null;
    }
    const area = suggestFocusArea(access.areas, (a) => standing({ area: a }), profile, lastWeek?.area);
    return area ? { area, weekStart: week } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `standing` reads only the inputs listed
  }, [free, freeArea, areasKey, masteryById, factsByKey, profile, lastWeek?.area, lastWeek?.category, content.index]);
  const [choice, setChoice] = useState<WeeklyFocus | null>(null);
  const picked = choice ?? suggestion;

  if (loading || access.areas.length === 0) return null;
  // A subscriber with one area has nothing to choose between.
  if (!free && access.areas.length < 2) return null;

  const choose = (next: WeeklyFocus) => {
    update((current) => ({ ...current, weeklyFocus: next }));
    setPicking(false);
    setChoice(null);
  };

  const buttonStyle = (primary: boolean) => ({
    minHeight: compact ? 50 : 52,
    font: `500 ${compact ? 15.5 : 15}px/1 var(--font-ui)`,
    ...(primary
      ? { background: 'var(--acc-fill)', color: 'var(--onacc)', border: 0 }
      : { background: 'transparent', color: 'var(--ink)', border: '1.3px solid var(--line)' }),
  });

  const card = {
    background: 'var(--sf)',
    boxShadow: 'var(--shadow-card)',
    borderRadius: 3,
  };

  if (focus && !picking) {
    const s = standing(focus.category ? { category: focus.category } : { area: focus.area });
    const inFocus = reviewItems.filter((i) => {
      const structure = content.structuresById.get(i.structureId);
      if (!structure || !i.due) return false;
      if (focus.category && structure.category !== focus.category) return false;
      return !focus.area || areasOf(structure).includes(focus.area);
    });
    const due = new Set(inFocus.map((i) => i.structureId)).size;
    const pct = s.total ? Math.round((s.secure / s.total) * 100) : 0;
    return (
      <section data-in aria-labelledby="weekly-focus-title" className={compact ? 'mt-6 p-4.5' : 'mt-9 p-6'} style={card}>
        <div style={eyebrow}>This week’s focus</div>
        <h3 id="weekly-focus-title" className="mt-2.5" style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: compact ? 26 : 30, lineHeight: 1.05, color: 'var(--ink)' }}>
          {focusLabel(focus, freeArea)}
        </h3>
        <p className="mt-2" style={{ font: '400 14px/1.5 var(--font-ui)', color: 'var(--ink2)' }}>
          {s.seen} of {s.total} met · {s.secure} secure{due > 0 ? ` · ${due} due` : ''}
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--line)' }} role="img" aria-label={`${pct}% secure`}>
          <div className="h-full" style={{ width: `${Math.max(2, pct)}%`, background: 'var(--acc)' }} />
        </div>
        <div className={`mt-4.5 flex gap-2.5 ${compact ? 'flex-col' : ''}`}>
          <button type="button" onClick={() => onStartFocus(focus)} className={`rounded-[3px] px-5 ${compact ? 'w-full' : 'flex-1'}`} style={buttonStyle(true)}>
            Start focus session
          </button>
          <button type="button" onClick={() => setPicking(true)} className={`rounded-[3px] px-5 ${compact ? 'w-full' : ''}`} style={buttonStyle(false)}>
            Change focus
          </button>
        </div>
      </section>
    );
  }

  const lastLine = (() => {
    if (!lastWeek || picking) return null;
    const s = standing(lastWeek.category ? { category: lastWeek.category } : { area: lastWeek.area });
    return `Last week: ${focusLabel(lastWeek, freeArea)}, ${s.secure} of ${s.total} now secure.`;
  })();

  const options: WeeklyFocus[] = free
    ? CATEGORIES.filter((c) => standing({ category: c }).total > 0).map((category) => ({ category, weekStart: weekStartOf(now) }))
    : access.areas.map((area) => ({ area, weekStart: weekStartOf(now) }));
  const same = (a: WeeklyFocus | null, b: WeeklyFocus) => !!a && a.area === b.area && a.category === b.category;

  return (
    <section data-in aria-labelledby="weekly-focus-title" className={compact ? 'mt-6 p-4.5' : 'mt-9 p-6'} style={card}>
      <div style={eyebrow}>{focus ? 'Change this week’s focus' : 'Weekly focus'}</div>
      <h3 id="weekly-focus-title" className="mt-2.5" style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: compact ? 22 : 25, lineHeight: 1.1, color: 'var(--ink)' }}>
        {free ? 'Pick a kind of structure to focus on this week' : 'Pick an area to focus on this week'}
      </h3>
      <p className="mt-2" style={{ font: '400 14px/1.5 var(--font-ui)', color: 'var(--ink2)' }}>
        {lastLine ? `${lastLine} ` : ''}
        A focus session brings in more new material from it. Your daily review carries on for everything else.
        {suggestion ? ` We suggest ${focusLabel(suggestion, freeArea)}: it has the fewest structures secure.` : ''}
      </p>
      <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Focus">
        {options.map((option) => {
          const on = same(picked, option);
          return (
            <button
              key={option.area ?? option.category}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setChoice(option)}
              className="inline-flex min-h-[40px] items-center rounded-full px-3.5"
              style={chipStyle(on)}
            >
              {option.category ? CATEGORY_LABELS[option.category] : AREA_LABELS[option.area!]}
              {same(suggestion, option) && <span className="ml-1.5" style={{ font: '500 9.5px/1 var(--font-mono)', letterSpacing: '.08em', textTransform: 'uppercase' }}>· suggested</span>}
            </button>
          );
        })}
      </div>
      <div className={`mt-4.5 flex gap-2.5 ${compact ? 'flex-col' : ''}`}>
        <button
          type="button"
          disabled={!picked}
          onClick={() => picked && choose(picked)}
          className={`rounded-[3px] px-5 disabled:opacity-45 ${compact ? 'w-full' : 'flex-1'}`}
          style={buttonStyle(true)}
        >
          {picked ? `Focus on ${focusLabel(picked, freeArea)}` : 'Choose a focus'}
        </button>
        {picking && (
          <button type="button" onClick={() => { setPicking(false); setChoice(null); }} className={`rounded-[3px] px-5 ${compact ? 'w-full' : ''}`} style={buttonStyle(false)}>
            Keep {focus ? focusLabel(focus, freeArea) : 'it'}
          </button>
        )}
      </div>
      {free && (
        <p className="mt-4 flex flex-wrap items-center gap-2" style={{ font: '400 13px/1.55 var(--font-ui)', color: 'var(--ink3)' }}>
          <LockPill compact /> A whole area each week comes with a subscription.{' '}
          <Link to="/pricing" style={{ color: 'var(--accd)' }}>
            See the plans
          </Link>
        </p>
      )}
    </section>
  );
}
