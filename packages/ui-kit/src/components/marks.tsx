import type { ReactNode } from 'react';
import { DOC_STATUS, TOLERANCE, type DocStatus, type ToleranceState } from '@bestech/tokens';

export interface SectionEyebrowProps {
  /** Текст после ромба: «ЛИСТ 02 / ПРОДУКТ». */
  children: ReactNode;
  aside?: ReactNode;
  rule?: boolean;
}

export function SectionEyebrow({ children, aside, rule = true }: SectionEyebrowProps) {
  return (
    <div className="bst-eyebrow-row">
      <span className="bst-eyebrow">◭ {children}</span>
      {rule ? <span className="bst-eyebrow-row__rule" /> : null}
      {aside ? <span className="bst-eyebrow-row__aside">{aside}</span> : null}
    </div>
  );
}

export interface StampProps {
  status: DocStatus;
  size?: 'sm' | 'lg';
}

/** Штамп статуса документации: контур + глиф + подпись, никогда только цвет. */
export function StatusStamp({ status, size = 'sm' }: StampProps) {
  const s = DOC_STATUS[status];
  return (
    <span className={size === 'lg' ? 'bst-stamp bst-stamp--lg' : 'bst-stamp'} style={{ color: s.cssVar }}>
      <span aria-hidden="true">{s.glyph}</span>
      {s.label}
    </span>
  );
}

export interface ToleranceStampProps {
  status: ToleranceState;
  /** Короткая подпись вместо длинной («Вне допуска» → «Вне допуска»). */
  label?: string;
  size?: 'sm' | 'lg';
}

/** Штамп состояния параметра относительно допуска. */
export function ToleranceStamp({ status, label, size = 'sm' }: ToleranceStampProps) {
  const t = TOLERANCE[status];
  return (
    <span className={size === 'lg' ? 'bst-stamp bst-stamp--lg' : 'bst-stamp'} style={{ color: t.cssVar }}>
      <span aria-hidden="true">{t.glyph}</span>
      {label ?? t.label}
    </span>
  );
}

export function DisciplineBadge({ code }: { code: string }) {
  return <span className="bst-badge">{code}</span>;
}

export interface TitleBlockRow {
  k: string;
  v: ReactNode;
}

/** Штамп листа: пары «ключ — значение» в рамке. */
export function TitleBlock({ rows, minWidth = 320 }: { rows: TitleBlockRow[]; minWidth?: number }) {
  return (
    <div className="bst-titleblock" style={{ minWidth }}>
      {rows.map((r) => (
        <div key={r.k} style={{ display: 'contents' }}>
          <div className="bst-titleblock__k">{r.k}</div>
          <div className="bst-titleblock__v">{r.v}</div>
        </div>
      ))}
    </div>
  );
}

export interface SheetStripCell {
  k: string;
  v: ReactNode;
}

/** Горизонтальная полоса штампа — используется как заголовок и подвал экрана. */
export function SheetStrip({ cells, padding = '10px 16px' }: { cells: SheetStripCell[]; padding?: string }) {
  return (
    <div style={{ display: 'grid', gridAutoFlow: 'column', justifyContent: 'start', fontFamily: 'var(--bst-font-mono)', fontSize: 11 }}>
      {cells.map((c, i) => (
        <div key={c.k} style={{ padding, borderRight: i === cells.length - 1 ? undefined : '1px solid var(--bst-line)' }}>
          <div style={{ color: 'var(--bst-text-mute)', fontSize: 10 }}>{c.k}</div>
          <div>{c.v}</div>
        </div>
      ))}
    </div>
  );
}
