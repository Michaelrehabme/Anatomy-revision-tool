import { useMemo, useState } from 'react';
import { useChangeRequests } from '../../hooks/useChangeRequests';
import { findIncompleteDependencies } from '../../lib/statusTransition';
import type { ChangeStatus } from '../../types/changeRequest';
import { ChangeRequestFilters, type ChangeRequestFilterState } from './ChangeRequestFilters';
import { ChangeRequestTable } from './ChangeRequestTable';
import { ChangeRequestDetailPanel } from './ChangeRequestDetailPanel';
import { NewChangeRequestForm } from './NewChangeRequestForm';
import { Button } from '../../../anatomy-revision/components/shared/Button';

const DEFAULT_FILTERS: ChangeRequestFilterState = { status: 'all', category: 'all', priority: 'all' };

export function ChangeRegisterPage() {
  const { items, loading, error, stateUnavailable, create, setStatus, toggleChecklistItem } = useChangeRequests();
  const [filters, setFilters] = useState<ChangeRequestFilterState>(DEFAULT_FILTERS);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const statusByRef = useMemo(() => new Map(items.map((i) => [i.ref, i.status] as const)), [items]);

  const filtered = useMemo(() => {
    return items
      .filter((i) => filters.status === 'all' || i.status === filters.status)
      .filter((i) => filters.category === 'all' || i.category === filters.category)
      .filter((i) => filters.priority === 'all' || i.priority === filters.priority)
      .sort((a, b) => a.ref.localeCompare(b.ref));
  }, [items, filters]);

  const selected = selectedRef ? items.find((i) => i.ref === selectedRef) ?? null : null;

  const handleSetStatus = async (ref: string, nextStatus: ChangeStatus) => {
    const target = items.find((i) => i.ref === ref);
    await setStatus(ref, nextStatus);
    if (nextStatus === 'inProgress' && target) {
      const incomplete = findIncompleteDependencies(target.dependsOn, statusByRef);
      setWarning(
        incomplete.length > 0
          ? `${ref} was moved to In progress, but it depends on ${incomplete.join(', ')}, which ${incomplete.length === 1 ? "isn't" : "aren't"} completed yet.`
          : null,
      );
    } else {
      setWarning(null);
    }
  };

  return (
    <div className="px-16 pt-16 pb-16">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 40,
              lineHeight: 1.05,
              letterSpacing: '-.02em',
              margin: 0,
            }}
          >
            Change Register
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--ink2)' }}>
            {items.length} change request{items.length === 1 ? '' : 's'} · click a row to copy its prompt
          </p>
        </div>
        <Button onClick={() => setShowNewForm(true)} className="min-h-[44px] px-5">
          New change request
        </Button>
      </div>

      {warning && (
        <div
          className="mt-6 rounded-[3px] px-4 py-3 text-sm"
          style={{ background: 'var(--acc2s)', color: 'var(--acc2d)' }}
        >
          {warning}
        </div>
      )}

      <div className="mt-8">
        <ChangeRequestFilters filters={filters} onChange={setFilters} />
      </div>

      {loading && (
        <div className="mt-10 text-sm" style={{ color: 'var(--ink3)' }}>
          Loading change requests…
        </div>
      )}
      {error && (
        <div className="mt-10 text-sm" style={{ color: 'var(--acc2d)' }}>
          {error}
        </div>
      )}
      {stateUnavailable && (
        <div
          className="mt-8 rounded px-4 py-3 text-sm"
          style={{ background: 'var(--acc2s)', color: 'var(--ink2)', borderLeft: '2px solid var(--acc2)' }}
        >
          <strong style={{ color: 'var(--ink)' }}>Showing the backlog from git only.</strong> The saved
          status, notes and ticks could not be read, so nothing here can be changed — a tick would
          overwrite whatever Firestore actually holds. Check you are signed in as an admin and that the
          Firebase config is set.
          <div className="mt-1.5" style={{ color: 'var(--ink3)' }}>{stateUnavailable}</div>
        </div>
      )}
      {!loading && !error && (
        <ChangeRequestTable
          items={filtered}
          statusByRef={statusByRef}
          onOpen={setSelectedRef}
          onSetStatus={handleSetStatus}
        />
      )}

      {selected && (
        <ChangeRequestDetailPanel
          item={selected}
          onClose={() => setSelectedRef(null)}
          onSetStatus={handleSetStatus}
          onToggleChecklistItem={toggleChecklistItem}
        />
      )}

      {showNewForm && (
        <NewChangeRequestForm
          onCancel={() => setShowNewForm(false)}
          onSubmit={async (input) => {
            await create(input);
            setShowNewForm(false);
          }}
        />
      )}
    </div>
  );
}
