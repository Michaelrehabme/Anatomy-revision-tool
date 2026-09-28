import type { LevelChange } from '../../hooks/useRevisionSession';
import type { AnatomyStructure } from '../../types/structure';
import { MASTERY_LEVEL_LABELS, masteryLevelRank } from '../../lib/masteryLevel';

/**
 * The structures whose mastery level (lib/masteryLevel.ts) moved this
 * session, climbs first. Renders nothing when none did — a session that only
 * held its ground has nothing to report here.
 */
export function LevelChangesList({
  changes,
  structuresById,
  onOpen,
}: {
  changes: readonly LevelChange[];
  structuresById: Map<string, AnatomyStructure>;
  onOpen?: (structureId: string) => void;
}) {
  const rows = changes
    .map((c) => ({ ...c, structure: structuresById.get(c.structureId), up: masteryLevelRank(c.to) > masteryLevelRank(c.from) }))
    .filter((c): c is typeof c & { structure: AnatomyStructure } => !!c.structure)
    .sort((a, b) => Number(b.up) - Number(a.up) || a.structure.name.localeCompare(b.structure.name, 'en'));
  if (rows.length === 0) return null;

  const ups = rows.filter((r) => r.up).length;
  return (
    <section>
      <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
        Mastery moved · {ups} up{rows.length > ups ? `, ${rows.length - ups} down` : ''}
      </div>
      <ul className="mt-3 flex flex-col">
        {rows.map((r) => (
          <li key={r.structureId} style={{ borderTop: '1px solid var(--line)' }}>
            <button
              type="button"
              disabled={!onOpen}
              onClick={() => onOpen?.(r.structureId)}
              className="flex w-full items-baseline gap-3 border-0 bg-transparent px-0 py-2.5 text-left"
            >
              <span className="flex-1" style={{ fontSize: 15, color: 'var(--ink)' }}>
                {r.structure.name}
              </span>
              <span style={{ font: '500 12px/1 var(--font-mono)', color: r.up ? 'var(--accd)' : 'var(--acc2d)' }}>
                {MASTERY_LEVEL_LABELS[r.from]} {r.up ? '↑' : '↓'} {MASTERY_LEVEL_LABELS[r.to]}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
