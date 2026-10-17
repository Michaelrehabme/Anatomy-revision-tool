import type { CSSProperties, ReactNode } from 'react';

/**
 * A card back as short bullet points with the key words in bold (owner,
 * 17 Oct 2026: the descriptions were "quite a mouthful"). The text is plain
 * with two marks, written by lib/facts.ts cardBullets: a line that starts
 * "• " is a bullet, and **words** are bold. Anything else renders as it
 * always did, a paragraph per line, so older cards are unchanged.
 */
export function RichText({ text, className, style }: { text: string; className?: string; style?: CSSProperties }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (!bullets.length) return;
    const items = bullets;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="flex list-disc flex-col gap-1.5 pl-5">
        {items.map((line, i) => (
          <li key={i}>{inline(line)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };
  for (const line of text.split('\n')) {
    if (line.startsWith('• ')) {
      bullets.push(line.slice(2));
      continue;
    }
    flush();
    if (line.trim()) blocks.push(<p key={`p-${blocks.length}`}>{inline(line)}</p>);
  }
  flush();
  return (
    <div className={`flex flex-col gap-3 ${className ?? ''}`} style={style}>
      {blocks}
    </div>
  );
}

function inline(line: string): ReactNode[] {
  return line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}
