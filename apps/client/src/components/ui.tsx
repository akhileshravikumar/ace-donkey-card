/** Small presentational building blocks for the temporary UI. */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:brightness-110 font-semibold',
  secondary: 'bg-surface-2 text-fg border border-line hover:bg-line',
  danger: 'bg-danger/15 text-danger border border-danger/40 hover:bg-danger/25',
  ghost: 'text-muted hover:text-fg hover:bg-surface-2',
};

export function Button({
  variant = 'secondary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm transition',
        'disabled:cursor-not-allowed disabled:opacity-40',
        VARIANTS[variant],
        className,
      )}
    />
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-2xl border border-line bg-surface p-5 shadow-lg', className)}>
      {children}
    </div>
  );
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'accent' | 'joker' | 'danger' | 'ok';
  children: ReactNode;
}) {
  const tones = {
    neutral: 'bg-surface-2 text-muted border-line',
    accent: 'bg-accent/15 text-accent border-accent/40',
    joker: 'bg-joker/15 text-joker border-joker/40',
    danger: 'bg-danger/15 text-danger border-danger/40',
    ok: 'bg-ok/15 text-ok border-ok/40',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Avatar({ name, active = false }: { name: string; active?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold uppercase',
        active ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg',
      )}
    >
      {name.trim()[0] ?? '?'}
    </span>
  );
}

/** Face-down card, used for opponents' card counts. */
export function CardBack({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block h-5 w-3.5 rounded-[3px] border border-white/30 bg-[repeating-linear-gradient(45deg,#7c2d12_0_3px,#9a3412_3px_6px)]',
        className,
      )}
    />
  );
}

export const inputClass =
  'w-full rounded-lg border border-line bg-bg px-3 py-2 text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none';
