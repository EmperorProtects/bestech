/**
 * Модель датчика: пороги, состояние и форматирование значения. Общая для приёма
 * пакетов и выдачи в интерфейс, чтобы «вне допуска» в журнале и на экране
 * считалось одинаково.
 */

import type { ToleranceState } from '@/api/types';

export interface SensorRow {
  id: string;
  asset_code: string;
  code: string;
  discipline: string;
  name: string;
  kind: string;
  unit: string;
  decimals: number;
  axis: string;
  x: number;
  y: number;
  warn_low: number | null;
  warn_high: number | null;
  alarm_low: number | null;
  alarm_high: number | null;
  interval_s: number;
  sort: number;
  last_value: number | null;
  last_ts: string | null;
  last_state: string;
}

/** Состояние по значению; «нет связи» определяется не значением, а тишиной в эфире. */
export type ValueState = Exclude<ToleranceState, 'offline'>;

const below = (value: number, limit: number | null) => limit !== null && value < Number(limit);
const above = (value: number, limit: number | null) => limit !== null && value > Number(limit);

export function evaluate(row: SensorRow, value: number): ValueState {
  if (below(value, row.alarm_low) || above(value, row.alarm_high)) return 'alarm';
  if (below(value, row.warn_low) || above(value, row.warn_high)) return 'warning';
  return 'ok';
}

/** Число в русской записи: запятая, заданное число знаков. */
export function num(value: number, decimals: number): string {
  return value.toFixed(Math.max(0, Number(decimals))).replace('.', ',');
}

export function formatValue(row: SensorRow, value: number): string {
  return `${num(value, row.decimals)} ${row.unit}`;
}

/** Допуск датчика для подписи: «5,0…35,0 °C», «≤ 15,0 мм» или «—». */
export function limitText(row: SensorRow): string {
  const lo = row.alarm_low;
  const hi = row.alarm_high;
  if (lo !== null && hi !== null) return `${num(Number(lo), row.decimals)}…${num(Number(hi), row.decimals)} ${row.unit}`;
  if (hi !== null) return `≤ ${num(Number(hi), row.decimals)} ${row.unit}`;
  if (lo !== null) return `≥ ${num(Number(lo), row.decimals)} ${row.unit}`;
  return '—';
}

/** Какой именно порог пересечён — для текста аварии. */
export function crossedThreshold(row: SensorRow, value: number, level: Exclude<ValueState, 'ok'>): string {
  const lo = level === 'alarm' ? row.alarm_low : row.warn_low;
  const hi = level === 'alarm' ? row.alarm_high : row.warn_high;
  if (hi !== null && value > Number(hi)) return `${num(Number(hi), row.decimals)} ${row.unit}`;
  if (lo !== null && value < Number(lo)) return `${num(Number(lo), row.decimals)} ${row.unit}`;
  return limitText(row);
}

/** Значение порога аварии для линии на графике. */
export function alarmLimitValue(row: SensorRow): number | null {
  if (row.alarm_high !== null) return Number(row.alarm_high);
  if (row.alarm_low !== null) return Number(row.alarm_low);
  return null;
}

/** Датчик без пакетов дольше четырёх периодов опроса (но не меньше 20 с) — без связи. */
export function staleAfterMs(row: SensorRow): number {
  return Math.max(20_000, Number(row.interval_s) * 4000);
}

const p2 = (n: number) => String(n).padStart(2, '0');

export function hhmmss(d: Date): string {
  return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}

export function hhmm(d: Date): string {
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

export function ruDateTime(d: Date): string {
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()} ${hhmmss(d)}`;
}
