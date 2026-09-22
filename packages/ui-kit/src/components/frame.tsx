import type { CSSProperties, ReactNode } from 'react';

export interface FrameProps {
  children?: ReactNode;
  /** Внутренние отступы по токену --bst-card-pad. */
  padded?: boolean;
  /** Подложка: прозрачная (по умолчанию), акцентная заливка или surface. */
  fill?: 'none' | 'tint' | 'surface';
  className?: string;
  style?: CSSProperties;
  as?: 'div' | 'article' | 'section' | 'figure' | 'aside';
}

/**
 * Рамка чертёжного листа: тонкая линия + четыре угловые засечки.
 * Засечки — обязательная часть объекта, их нельзя опускать.
 */
export function Frame({ children, padded = false, fill = 'none', className, style, as = 'div' }: FrameProps) {
  const Tag = as;
  const cls = [
    'bst-frame',
    padded ? 'bst-frame--padded' : '',
    fill === 'tint' ? 'bst-frame--tint' : '',
    fill === 'surface' ? 'bst-frame--surface' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag className={cls} style={style}>
      <i className="bst-corner bst-corner--tl" aria-hidden="true" />
      <i className="bst-corner bst-corner--tr" aria-hidden="true" />
      <i className="bst-corner bst-corner--bl" aria-hidden="true" />
      <i className="bst-corner bst-corner--br" aria-hidden="true" />
      {children}
    </Tag>
  );
}

export interface DimensionLineProps {
  /** Доля 0…1 — заполненная часть. */
  value: number;
  /** Необязательная плановая отметка 0…1. */
  plan?: number;
  height?: number;
  color?: string;
  /** Показать стрелку на конце размерной линии. */
  arrow?: boolean;
}

/** Размерная линия со стрелками — используется как индикатор прогресса. */
export function DimensionLine({ value, plan, height = 14, color = 'var(--bst-accent)', arrow = true }: DimensionLineProps) {
  const w = 240;
  const clamped = Math.max(0, Math.min(1, value));
  const x = 2 + (w - 4) * clamped;
  const px = plan === undefined ? null : 2 + (w - 4) * Math.max(0, Math.min(1, plan));
  const mid = height / 2;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none" style={{ display: 'block' }} aria-hidden="true">
      <path d={`M2 ${mid}H${w - 2}`} stroke="var(--bst-line)" strokeWidth="1" />
      <path d={`M2 ${mid}H${x}`} stroke={color} strokeWidth="2" />
      <path d={`M2 0V${height}M${x} 0V${height}`} stroke={color} strokeWidth="0.9" />
      {px !== null ? <path d={`M${px} 0V${height}`} stroke={color} strokeWidth="0.9" strokeDasharray="3 2" /> : null}
      {arrow ? <path d={`M${x} ${mid} ${x - 10} ${mid - 3}v6z`} fill={color} /> : null}
    </svg>
  );
}
