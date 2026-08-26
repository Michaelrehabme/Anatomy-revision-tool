export function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[140px] flex-1 rounded-[4px] px-4 py-3.5" style={{ background: 'var(--sf)', border: '1px solid var(--line)' }}>
      <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
        {label}
      </div>
      <div className="mt-2" style={{ font: '600 26px/1 var(--font-ui)', color: 'var(--ink)' }}>
        {value}
      </div>
    </div>
  );
}
