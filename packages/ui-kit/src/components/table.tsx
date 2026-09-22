import type { ReactNode } from 'react';

export interface Column<Row> {
  id: string;
  header: ReactNode;
  width?: number | string;
  align?: 'left' | 'right';
  cell: (row: Row, index: number) => ReactNode;
}

export interface ScheduleTableProps<Row> {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row, index: number) => string;
  /** Подсветка выбранной строки (ведомость и таблица отклонений). */
  selectedKey?: string | null;
  onRowClick?: (row: Row, index: number) => void;
  /** Липкая шапка для длинных ведомостей. */
  sticky?: boolean;
  /** Нумерация позиций как в спецификации: 01, 02, 03… */
  numbered?: boolean;
  caption?: string;
}

/** Таблица в стиле чертёжной спецификации: волосяные линии, моноцифры, номера позиций. */
export function ScheduleTable<Row>({
  columns,
  rows,
  rowKey,
  selectedKey,
  onRowClick,
  sticky = false,
  numbered = true,
  caption,
}: ScheduleTableProps<Row>) {
  return (
    <table className={sticky ? 'bst-table bst-table--sticky' : 'bst-table'}>
      {caption ? <caption style={{ captionSide: 'top', textAlign: 'left', paddingBottom: 8, fontFamily: 'var(--bst-font-mono)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--bst-text-mute)' }}>{caption}</caption> : null}
      <thead>
        <tr>
          {numbered ? <th style={{ width: 38 }}>№</th> : null}
          {columns.map((c) => (
            <th key={c.id} style={{ width: c.width, textAlign: c.align === 'right' ? 'right' : 'left' }}>
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const key = rowKey(row, i);
          return (
            <tr
              key={key}
              data-selected={selectedKey === key ? 'true' : undefined}
              onClick={onRowClick ? () => onRowClick(row, i) : undefined}
              style={onRowClick ? { cursor: 'pointer' } : undefined}
            >
              {numbered ? <td className="bst-mono" style={{ fontSize: 12, color: 'var(--bst-text-mute)' }}>{String(i + 1).padStart(2, '0')}</td> : null}
              {columns.map((c) => (
                <td key={c.id} className={c.align === 'right' ? 'bst-num' : undefined}>
                  {c.cell(row, i)}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
