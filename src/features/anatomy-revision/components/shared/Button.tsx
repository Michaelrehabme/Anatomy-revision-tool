import type { ButtonHTMLAttributes, CSSProperties } from 'react';

type Variant = 'primary' | 'secondary';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

/** The mockup's two button treatments: solid accent primary, outlined secondary. */
export function Button({ variant = 'primary', className = '', style, ...props }: ButtonProps) {
  const base: CSSProperties =
    variant === 'primary'
      ? { background: 'var(--acc)', color: 'var(--onacc)' }
      : { background: 'transparent', color: 'var(--ink2)', border: '1.2px solid var(--line)' };
  return (
    <button
      {...props}
      className={`rounded-[3px] font-medium transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
      style={{ fontFamily: 'var(--font-ui)', boxSizing: 'border-box', ...base, ...style }}
    />
  );
}
