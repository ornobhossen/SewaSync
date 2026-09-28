'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useRelHref } from '@/lib/routes';
import type { BillState, PayState } from '@/lib/types';

/* ------------------------------------------------------------------ */
/* layout                                                              */
/* ------------------------------------------------------------------ */

export function Stack({
  children,
  gap = 12,
  className = '',
}: {
  children: ReactNode;
  gap?: number;
  className?: string;
}) {
  return (
    <div className={`od-stack ${className}`} style={{ ['--od-gap' as string]: `${gap}px` }}>
      {children}
    </div>
  );
}

export function Card({
  children,
  className = '',
  as: As = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}) {
  return <As className={`ss-card ${className}`}>{children}</As>;
}

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="od-row od-stack" style={{ ['--od-gap' as string]: '8px' }}>
      <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
        <h2 className="od-fill text-label font-semibold uppercase tracking-[0.08em] text-ink-muted">
          {children}
        </h2>
        {action}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* status                                                              */
/* ------------------------------------------------------------------ */

type PillTone = 'paid' | 'partial' | 'overdue' | 'soon' | 'draft' | 'neutral' | 'brand';

const PILL_TONE: Record<PillTone, string> = {
  paid: 'bg-[#E7F6EC] text-[#15803D]',
  partial: 'bg-[#FEF3E2] text-[#B45309]',
  overdue: 'bg-[#FDECEC] text-[#B91C1C]',
  soon: 'bg-[#E6F2F4] text-[#0E5F59]',
  draft: 'bg-[#EEF2F6] text-[#475569]',
  neutral: 'bg-[#EEF2F6] text-[#475569]',
  brand: 'bg-primary-soft text-primary-dark',
};

export function Pill({
  children,
  tone = 'neutral',
  icon,
}: {
  children: ReactNode;
  tone?: PillTone;
  icon?: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-micro font-semibold uppercase tracking-[0.06em] ${PILL_TONE[tone]}`}
    >
      {icon}
      {children}
    </span>
  );
}

export function toneForBill(state: BillState): PillTone {
  if (state === 'paid') return 'paid';
  if (state === 'part_paid') return 'partial';
  if (state === 'overdue') return 'overdue';
  if (state === 'due_soon') return 'soon';
  if (state === 'draft') return 'draft';
  if (state === 'void') return 'draft';
  return 'neutral';
}

export function toneForPay(state: PayState): PillTone {
  if (state === 'paid') return 'paid';
  if (state === 'partial') return 'partial';
  return 'neutral';
}

/* ------------------------------------------------------------------ */
/* controls                                                            */
/* ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'inverse';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-dark',
  secondary: 'bg-white text-ink border border-line hover:bg-[#F1F5F9]',
  ghost: 'bg-transparent text-primary hover:bg-primary-soft/50',
  danger: 'bg-white text-danger border border-[#FBD5D5] hover:bg-[#FEF2F2]',
  inverse: 'bg-white/12 text-[#F0FDFA] border border-white/25 hover:bg-white/20',
};

export function Button({
  children,
  onClick,
  href,
  variant = 'primary',
  icon,
  disabled,
  type = 'button',
  full,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: ButtonVariant;
  icon?: ReactNode;
  disabled?: boolean;
  type?: 'button' | 'submit';
  full?: boolean;
  className?: string;
}) {
  const classes = `od-touch ss-focus-ring inline-flex items-center justify-center gap-2 rounded-btn px-4 py-[10px] text-body font-semibold transition-colors duration-150 ${
    disabled ? 'cursor-not-allowed opacity-45' : BUTTON_VARIANT[variant]
  } ${full ? 'w-full' : ''} ${className}`;
  const rel = useRelHref();
  if (href) {
    return (
      <a href={rel(href)} className={classes}>
        {icon}
        {children}
      </a>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {icon}
      {children}
    </button>
  );
}

export function IconButton({
  children,
  onClick,
  href,
  label,
  badge,
  active,
  invert,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  label: string;
  badge?: number;
  active?: boolean;
  invert?: boolean;
}) {
  const classes = invert
    ? 'od-touch ss-focus-ring relative inline-flex items-center justify-center rounded-btn text-white/85 hover:bg-white/15'
    : `od-touch ss-focus-ring relative inline-flex items-center justify-center rounded-btn ${
        active ? 'bg-primary-soft text-primary-dark' : 'text-ink-muted hover:bg-[#F1F5F9]'
      }`;
  const rel = useRelHref();
  const inner = (
    <>
      {children}
      {badge ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
    </>
  );
  if (href) {
    return (
      <a href={rel(href)} aria-label={label} className={classes}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" aria-label={label} onClick={onClick} className={classes}>
      {inner}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="tablist"
      className="flex gap-1 rounded-btn border border-line bg-white p-1"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(option.value)}
            className={`od-fill od-touch rounded-[8px] px-2 text-body font-semibold transition-colors duration-150 ${
              active ? 'bg-primary text-white' : 'text-ink-muted hover:text-ink'
            }`}
          >
            <span className="od-truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="od-field" style={{ ['--od-gap' as string]: '6px' }}>
      <span className="text-label font-semibold uppercase tracking-[0.06em] text-ink-muted">
        {label}
      </span>
      {children}
      {hint && !error ? <span className="text-body text-ink-muted">{hint}</span> : null}
      {error ? <span className="text-body font-semibold text-danger">{error}</span> : null}
    </label>
  );
}

const INPUT_CLASS =
  'w-full rounded-btn border border-line bg-white px-3 py-[10px] text-body text-ink ss-focus-ring placeholder:text-[#94A3B8]';

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${INPUT_CLASS} ${props.className ?? ''}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${INPUT_CLASS} min-h-[84px] ${props.className ?? ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${INPUT_CLASS} appearance-none ${props.className ?? ''}`} />;
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="od-row od-touch w-full gap-3 text-left"
    >
      <span className="od-fill text-body font-medium text-ink">{label}</span>
      <span
        className={`relative h-[26px] w-[44px] flex-none rounded-full border transition-colors duration-150 ${
          checked ? 'border-primary bg-primary' : 'border-line bg-[#E2E8F0]'
        }`}
      >
        <span
          className={`absolute top-[2px] h-[20px] w-[20px] rounded-full bg-white shadow-sm transition-[left] duration-150 ${
            checked ? 'left-[21px]' : 'left-[2px]'
          }`}
        />
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* people and data                                                     */
/* ------------------------------------------------------------------ */

export function Avatar({ initials, size = 34, src }: { initials: string; size?: number; src?: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt={initials}
        className="inline-flex flex-none rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="inline-flex flex-none items-center justify-center rounded-full bg-primary-soft font-semibold text-primary-dark"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials}
    </span>
  );
}

export function Progress({ ratio, tone = 'brand' }: { ratio: number; tone?: 'brand' | 'amber' | 'red' }) {
  const clamped = Math.max(0, Math.min(1, ratio));
  const colour =
    tone === 'red' ? 'bg-danger' : tone === 'amber' ? 'bg-accent' : 'bg-primary';
  return (
    <span className="block h-[6px] w-full overflow-hidden rounded-full bg-[#E2E8F0]">
      <span
        className={`block h-full rounded-full transition-[width] duration-300 ${colour}`}
        style={{ width: `${clamped * 100}%` }}
      />
    </span>
  );
}

export function Amount({
  value,
  size = 'page',
  tone = 'ink',
  signed,
}: {
  value: string;
  size?: 'hero' | 'page' | 'body';
  tone?: 'ink' | 'muted' | 'inverse' | 'danger';
  signed?: boolean;
}) {
  const sizes = {
    hero: 'text-hero font-bold',
    page: 'text-page font-bold',
    body: 'text-body font-semibold',
  } as const;
  const tones = {
    ink: 'text-ink',
    muted: 'text-ink-muted',
    inverse: 'text-white',
    danger: 'text-danger',
  } as const;
  return (
    <span className={`tnum od-nowrap ${sizes[size]} ${tones[tone]}`}>
      {signed && value.startsWith('-') ? value.slice(1) : value}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* sheet                                                               */
/* ------------------------------------------------------------------ */

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[88dvh] w-full max-w-[420px] animate-sheet-in flex-col rounded-t-sheet bg-surface pb-[18px]"
      >
        <div className="flex items-center gap-2 px-4 pb-2 pt-3">
          <div className="mx-auto absolute left-1/2 top-2 h-[5px] w-9 -translate-x-1/2 rounded-full bg-[#CBD5E1]" />
          <h2 className="od-fill text-page font-bold text-ink">{title}</h2>
          <IconButton onClick={onClose} label="close">
            <X size={20} />
          </IconButton>
        </div>
        <div className="od-scroll px-4" style={{ ['--od-gap' as string]: '12px' }}>
          {children}
        </div>
        {footer ? <div className="px-4 pt-3">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* states                                                              */
/* ------------------------------------------------------------------ */

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Card className="px-4 py-6 text-center">
      <div className="od-stack items-center" style={{ ['--od-gap' as string]: '10px' }}>
        {icon ? (
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary-dark">
            {icon}
          </span>
        ) : null}
        <p className="text-page font-bold text-ink">{title}</p>
        <p className="text-body text-ink-muted">{body}</p>
        {action}
      </div>
    </Card>
  );
}

export function Notice({
  tone = 'brand',
  title,
  body,
  icon,
}: {
  tone?: 'brand' | 'amber' | 'neutral';
  title: string;
  body?: string;
  icon?: ReactNode;
}) {
  const tones = {
    brand: 'border-[#B9E5E0] bg-[#F0FDFA]',
    amber: 'border-[#FBD9A5] bg-[#FFFBEB]',
    neutral: 'border-line bg-white',
  } as const;
  return (
    <div className={`rounded-card border px-3 py-[10px] ${tones[tone]}`}>
      <div className="od-row-top" style={{ ['--od-gap' as string]: '8px' }}>
        {icon ? <span className="mt-[2px] text-primary-dark">{icon}</span> : null}
        <div className="od-stack od-fill" style={{ ['--od-gap' as string]: '2px' }}>
          <p className="text-body font-semibold text-ink">{title}</p>
          {body ? <p className="text-body text-ink-muted">{body}</p> : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* media placeholder                                                   */
/* ------------------------------------------------------------------ */

/**
 * A ticket photo. `getRepairImage` supplies a real photo when we have one
 * that honestly matches the category; otherwise `src` is undefined and this
 * falls back to the labelled reference tile showing the photo the house gave.
 */
export function PhotoStub({ label, ratio = '4 / 3', className = '', src }: { label: string; ratio?: string; className?: string; src?: string }) {
  if (src) {
    return (
      <div
        className={`od-tile ${className || 'w-full'} overflow-hidden rounded-card border border-line`}
        style={{ ['--od-ratio' as string]: ratio }}
      >
        <img src={src} alt={label} className="w-full h-full object-cover" loading="lazy" />
      </div>
    );
  }
  return (
    <div
      className={`od-tile ${className || 'w-full'} overflow-hidden rounded-card border border-line bg-[#F1F5F9]`}
      style={{ ['--od-ratio' as string]: ratio }}
    >
      <div className="flex items-center justify-center bg-[#E2E8F0] py-3 text-micro font-semibold uppercase tracking-[0.1em] text-ink-muted">
        Photo
      </div>
      <div className="flex items-end px-3 pb-2">
        <span className="tnum text-micro text-ink-muted">{label}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* keyboard-visible helper for cards that are links                    */
/* ------------------------------------------------------------------ */

/**
 * A card that navigates.
 *
 * This renders a plain `<a>`, not `next/link`, and that is deliberate. A
 * static export has no server to stream a new route from, so `next/link`
 * would have to fetch the next page's RSC payload and JS chunks over the
 * network. Those fetches are addressed against the site root, so opening the
 * export from disk or from a subpath leaves navigation hanging on a request
 * that can never resolve. A real document load always works, and each page
 * already ships its own complete markup, so nothing is lost but the
 * transition animation.
 *
 * The href arrives as a root-absolute route and is made depth-relative on the
 * way out — see `lib/routes.ts` for why an absolute one leaves the export.
 */
export function Pressable({
  href,
  children,
  className = '',
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const rel = useRelHref();
  return (
    <a href={rel(href)} className={`ss-row-press ss-focus-ring block rounded-card ${className}`}>
      {children}
    </a>
  );
}

export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
