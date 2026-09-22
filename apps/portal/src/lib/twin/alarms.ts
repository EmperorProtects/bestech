/**
 * Жизненный цикл аварий по телеметрии: открытие при выходе за порог, смена
 * уровня, закрытие при возврате в допуск или восстановлении связи. Каждое
 * открытие попадает в ленту событий объекта — заказчик видит его в кабинете.
 */

import { randomUUID } from 'node:crypto';
import { all, one, run } from '@/db/client';
import { crossedThreshold, formatValue, ruDateTime, staleAfterMs, type SensorRow, type ValueState } from './model';

export type AlarmLevel = 'warning' | 'alarm' | 'offline';

const TITLE: Record<AlarmLevel, string> = {
  alarm: 'Вне допуска',
  warning: 'У границы допуска',
  offline: 'Нет связи',
};

export function alarmCode(number: number, openedAt: string): string {
  return `INC-${new Date(openedAt).getFullYear()}-${String(number).padStart(4, '0')}`;
}

/**
 * Приводит открытую аварию датчика в соответствие с его состоянием.
 * Возвращает id новой аварии, если она открыта этим вызовом.
 */
export function syncAlarm(sensor: SensorRow, state: ValueState | 'offline', value: number | null, atIso: string): string | null {
  const open = one<{ id: string; level: AlarmLevel }>(
    'SELECT id, level FROM alarms WHERE sensor_id = ? AND closed_at IS NULL ORDER BY opened_at DESC LIMIT 1',
    sensor.id,
  );

  if (state === 'ok') {
    if (open) {
      run('UPDATE alarms SET closed_at = ?, close_note = ? WHERE id = ?',
        atIso, open.level === 'offline' ? 'связь восстановлена' : 'значение вернулось в допуск', open.id);
    }
    return null;
  }

  if (open && open.level === state) {
    if (value !== null) run('UPDATE alarms SET value = ? WHERE id = ?', value, open.id);
    return null;
  }

  if (open) {
    const note = state === 'alarm' ? 'уровень повышен до аварии' : state === 'offline' ? 'датчик перестал отвечать' : 'уровень снижен до предупреждения';
    run('UPDATE alarms SET closed_at = ?, close_note = ? WHERE id = ?', atIso, note, open.id);
  }

  const number = Number(one<{ n: number }>('SELECT COALESCE(MAX(number), 142) + 1 AS n FROM alarms')?.n ?? 143);
  const id = randomUUID();
  const silenceS = Math.round(staleAfterMs(sensor) / 1000);
  const threshold = state === 'offline' ? `${silenceS} с без пакетов` : crossedThreshold(sensor, value ?? 0, state);
  const message =
    state === 'offline'
      ? `Нет пакетов дольше ${silenceS} с, последнее значение ${sensor.last_value !== null ? formatValue(sensor, Number(sensor.last_value)) : '—'}`
      : `${formatValue(sensor, value ?? 0)} при пороге ${threshold}`;
  const title = `${TITLE[state]} · ${sensor.name} ${sensor.code}`;

  run(
    'INSERT INTO alarms (id, number, asset_code, sensor_id, level, value, threshold, title, message, opened_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    id, number, sensor.asset_code, sensor.id, state, value, threshold, title, message, atIso,
  );

  // Лента объекта сортируется по возрастанию sort: отрицательная метка времени ставит свежие события наверх.
  run(
    'INSERT INTO asset_events (id, asset_code, date, severity, title, meta, action, href, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    randomUUID(), sensor.asset_code, ruDateTime(new Date(atIso)), state, title,
    `${message} · ${alarmCode(number, atIso)} · создано автоматически по телеметрии`, 'Аварии',
    `/twin/${sensor.asset_code}/alarms?alarm=${id}`, -Math.floor(Date.now() / 1000),
  );

  return id;
}

export function openAlarmCounts(assetCode: string): Record<AlarmLevel, number> {
  const counts: Record<AlarmLevel, number> = { alarm: 0, warning: 0, offline: 0 };
  for (const r of all<{ level: AlarmLevel; n: number }>(
    'SELECT level, COUNT(*) AS n FROM alarms WHERE asset_code = ? AND closed_at IS NULL GROUP BY level',
    assetCode,
  )) {
    counts[r.level] = Number(r.n);
  }
  return counts;
}

/** Квитирование (оператор увидел) или ручное закрытие аварии. */
export function actOnAlarm(assetCode: string, id: string, action: 'ack' | 'close', userName: string): boolean {
  const alarm = one<{ id: string; closed_at: string | null; ack_at: string | null }>(
    'SELECT id, closed_at, ack_at FROM alarms WHERE id = ? AND asset_code = ?',
    id,
    assetCode,
  );
  if (!alarm || alarm.closed_at) return false;

  const now = new Date().toISOString();
  if (action === 'ack') {
    if (alarm.ack_at) return true;
    run('UPDATE alarms SET ack_by = ?, ack_at = ? WHERE id = ?', userName, now, id);
  } else {
    run('UPDATE alarms SET closed_at = ?, close_note = ?, ack_by = COALESCE(ack_by, ?), ack_at = COALESCE(ack_at, ?) WHERE id = ?',
      now, `закрыто вручную: ${userName}`, userName, now, id);
  }
  return true;
}
