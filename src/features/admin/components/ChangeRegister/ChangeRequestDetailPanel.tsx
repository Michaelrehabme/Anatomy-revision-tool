import { useState } from 'react';
import {
  CHANGE_CATEGORY_LABELS,
  CHANGE_EFFORT_LABELS,
  CHANGE_PRIORITY_LABELS,
  CHANGE_STATUSES,
  CHANGE_STATUS_LABELS,
  type ChangeRequest,
  type ChangeStatus,
} from '../../types/changeRequest';
import { formatDate } from '../../lib/formatDate';
import { StatusBadge } from './StatusBadge';
import { Button } from '../../../anatomy-revision/components/shared/Button';

interface ChangeRequestDetailPanelProps {
  item: ChangeRequest;
  onClose: () => void;
  onSetStatus: (ref: string, status: ChangeStatus) => void;
}

const labelStyle = {
  font: '500 10px/1 var(--font-mono)',
  letterSpacing: '.14em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink3)',
};

export function ChangeRequestDetailPanel({ item, onClose, onSetStatus }: ChangeRequestDetailPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(item.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-label={`${item.ref} details`}>
      <div className="absolute inset-0" style={{ background: 'rgba(32, 30, 29, 0.35)' }} onClick={onClose} />
      <div
        className="relative flex h-full w-[620px] flex-none flex-col overflow-y-auto px-9 py-9"
        style={{ background: 'var(--sf)', boxShadow: 'var(--shadow-card)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div style={labelStyle}>{item.ref}</div>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
                fontSize: 30,
                lineHeight: 1.08,
                letterSpacing: '-.02em',
                margin: '6px 0 0',
              }}
            >
              {item.title}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ font: '400 22px/1 var(--font-ui)', color: 'var(--ink3)' }}>
            ×
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <StatusBadge status={item.status} />
          <span style={{ font: '500 12px/1 var(--font-mono)', color: 'var(--ink2)' }}>
            {CHANGE_CATEGORY_LABELS[item.category]}
          </span>
          <span style={{ font: '500 12px/1 var(--font-mono)', color: 'var(--ink3)' }}>
            {CHANGE_PRIORITY_LABELS[item.priority]} · {CHANGE_EFFORT_LABELS[item.effort]}
          </span>
        </div>

        <div className="mt-7">
          <div style={labelStyle}>Status</div>
          <select
            value={item.status}
            onChange={(e) => onSetStatus(item.ref, e.target.value as ChangeStatus)}
            className="mt-2"
            style={{
              font: '500 13px/1 var(--font-ui)',
              color: 'var(--ink)',
              background: 'var(--pg)',
              border: '1.2px solid var(--line)',
              borderRadius: 3,
              padding: '8px 10px',
            }}
          >
            {CHANGE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {CHANGE_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4">
          <div>
            <div style={labelStyle}>Created</div>
            <div className="mt-1.5" style={{ font: '400 12.5px/1 var(--font-mono)', color: 'var(--ink2)' }}>
              {formatDate(item.createdAt)}
            </div>
          </div>
          <div>
            <div style={labelStyle}>Started</div>
            <div className="mt-1.5" style={{ font: '400 12.5px/1 var(--font-mono)', color: 'var(--ink2)' }}>
              {formatDate(item.startedAt)}
            </div>
          </div>
          <div>
            <div style={labelStyle}>Completed</div>
            <div className="mt-1.5" style={{ font: '400 12.5px/1 var(--font-mono)', color: 'var(--ink2)' }}>
              {formatDate(item.completedAt)}
            </div>
          </div>
        </div>

        {item.dependsOn.length > 0 && (
          <div className="mt-6">
            <div style={labelStyle}>Depends on</div>
            <div className="mt-1.5" style={{ font: '500 12.5px/1 var(--font-mono)', color: 'var(--ink2)' }}>
              {item.dependsOn.join(', ')}
            </div>
          </div>
        )}

        <div className="mt-7">
          <div style={labelStyle}>Description</div>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink2)' }}>
            {item.description}
          </p>
        </div>

        <div className="mt-7 flex-1">
          <div className="flex items-center justify-between">
            <div style={labelStyle}>Prompt</div>
            <Button type="button" onClick={handleCopy} className="px-3 py-1.5 text-xs">
              {copied ? 'Copied' : 'Copy prompt'}
            </Button>
          </div>
          <pre
            className="mt-2 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-[3px] p-4"
            style={{
              font: '400 12.5px/1.6 var(--font-mono)',
              background: 'var(--pg)',
              border: '1px solid var(--line)',
              color: 'var(--ink)',
            }}
          >
            {item.prompt}
          </pre>
        </div>

        {item.notes && (
          <div className="mt-7">
            <div style={labelStyle}>Notes</div>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink2)' }}>
              {item.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
