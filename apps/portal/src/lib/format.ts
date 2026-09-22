/** Форматирование под RU-интерфейс: ДД.ММ.ГГГГ, пробел как разделитель тысяч, ₸. */

export function formatNumber(value: number, fractionDigits = 0): string {
  return value
    .toLocaleString('ru-KZ', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })
    .replace(/\u00A0/g, ' ');
}

export function formatCurrency(value: number): string {
  return `${formatNumber(value)} ₸`;
}

export function formatPercent(value: number): string {
  return `${formatNumber(value)} %`;
}

/** ISO → 11.09.2026 */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function positionLabel(index: number): string {
  return String(index + 1).padStart(2, '0');
}

export function toleranceTint(state: 'ok' | 'warning' | 'alarm' | 'offline'): string {
  return {
    ok: 'var(--bst-ok-tint)',
    warning: 'var(--bst-warn-tint)',
    alarm: 'var(--bst-alarm-tint)',
    offline: 'var(--bst-offline-tint)',
  }[state];
}

export function toleranceColor(state: 'ok' | 'warning' | 'alarm' | 'offline'): string {
  return {
    ok: 'var(--bst-ok)',
    warning: 'var(--bst-warn)',
    alarm: 'var(--bst-alarm)',
    offline: 'var(--bst-offline)',
  }[state];
}
