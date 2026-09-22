import type { ButtonHTMLAttributes, AnchorHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'subtle';

function btnClass(variant: Variant, opts: { size?: 'md' | 'sm'; block?: boolean; icon?: boolean; className?: string }) {
  return [
    'bst-btn',
    variant === 'primary' ? 'bst-btn--primary' : '',
    variant === 'ghost' ? 'bst-btn--ghost' : '',
    variant === 'subtle' ? 'bst-btn--subtle' : '',
    opts.size === 'sm' ? 'bst-btn--sm' : '',
    opts.block ? 'bst-btn--block' : '',
    opts.icon ? 'bst-btn--icon' : '',
    opts.className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'md' | 'sm';
  block?: boolean;
  iconOnly?: boolean;
  /** Угловые засечки — по гайду только у главной кнопки. */
  ticks?: boolean;
}

export function Button({ variant = 'secondary', size, block, iconOnly, ticks, className, children, ...rest }: ButtonProps) {
  const cls = btnClass(variant, { size, block, icon: iconOnly, className });
  if (ticks) {
    return (
      <button type="button" className={cls} style={{ position: 'relative' }} {...rest}>
        <i className="bst-corner bst-corner--tl" aria-hidden="true" />
        <i className="bst-corner bst-corner--tr" aria-hidden="true" />
        <i className="bst-corner bst-corner--bl" aria-hidden="true" />
        <i className="bst-corner bst-corner--br" aria-hidden="true" />
        {children}
      </button>
    );
  }
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}

export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
  size?: 'md' | 'sm';
  block?: boolean;
  ticks?: boolean;
}

/** Ссылка в облике кнопки. В приложении оборачивается в next/link через `asChild`-паттерн. */
export function ButtonLink({ variant = 'secondary', size, block, ticks, className, children, ...rest }: ButtonLinkProps) {
  return (
    <a className={btnClass(variant, { size, block, className })} style={ticks ? { position: 'relative' } : undefined} {...rest}>
      {ticks ? (
        <>
          <i className="bst-corner bst-corner--tl" aria-hidden="true" />
          <i className="bst-corner bst-corner--tr" aria-hidden="true" />
          <i className="bst-corner bst-corner--bl" aria-hidden="true" />
          <i className="bst-corner bst-corner--br" aria-hidden="true" />
        </>
      ) : null}
      {children}
    </a>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

export function Segmented<T extends string>({ options, value, onChange, ariaLabel }: SegmentedProps<T>) {
  return (
    <div className="bst-seg" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="bst-seg__opt"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export interface FieldProps {
  label: string;
  htmlFor: string;
  children: ReactNode;
  hint?: string;
}

export function Field({ label, htmlFor, children, hint }: FieldProps) {
  return (
    <div className="bst-field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint ? <span style={{ fontFamily: 'var(--bst-font-mono)', fontSize: 10, color: 'var(--bst-text-mute)' }}>{hint}</span> : null}
    </div>
  );
}

export function Input({ mono, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  return <input className={['bst-input', mono ? 'bst-input--mono' : '', className ?? ''].filter(Boolean).join(' ')} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={['bst-input', className ?? ''].filter(Boolean).join(' ')} {...rest}>
      {children}
    </select>
  );
}

export interface ParameterChipProps {
  label: string;
  value: string;
  onRemove?: () => void;
}

/** Параметр, распознанный ИИ: пунктирная рамка, значение можно снять. */
export function ParameterChip({ label, value, onRemove }: ParameterChipProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        border: '1px dashed var(--bst-accent-500)',
        borderRadius: 'var(--bst-radius-1)',
        color: 'var(--bst-accent-ink)',
        fontFamily: 'var(--bst-font-mono)',
        fontSize: 11,
      }}
    >
      {label}: {value}
      {onRemove ? (
        <button type="button" onClick={onRemove} aria-label={`Убрать ${label}`} style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', color: 'inherit', lineHeight: 1 }}>
          ×
        </button>
      ) : null}
    </span>
  );
}
