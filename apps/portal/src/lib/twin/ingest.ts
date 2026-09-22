/**
 * Приём показаний с устройств. Контракт v1 — то, во что шлюз (LoRaWAN, MQTT,
 * Modbus → HTTP) превращает поток датчиков:
 *
 *   POST /api/ingest/v1/readings
 *   Authorization: Bearer <ключ устройства>
 *   X-Device-Id: gw-01                         (необязательно)
 *   { "device": "gw-01", "readings": [ { "sensor": "Ф-2", "value": 72.4, "ts": "2026-09-14T10:00:00Z" } ] }
 *
 * Допускается и одиночное показание `{ "sensor": "Ф-2", "value": 72.4 }`.
 * Ответ 202 — принято (хотя бы одно показание), 422 — ни одного годного.
 * Каждый пакет, в том числе отклонённый, пишется в журнал ingest_packets.
 */

import { createHash } from 'node:crypto';
import { all, getDb, one, run, transaction } from '@/db/client';
import { syncAlarm } from './alarms';
import { evaluate, type SensorRow } from './model';

export interface IngestKey {
  id: string;
  asset_code: string;
}

const MAX_READINGS = 1000;
const MANUAL_HOLD_MS = 2 * 60 * 1000;

/** Датчик → до какого момента действует приоритет ручного ввода. */
const manualHold = ((globalThis as { __bestechManualHold?: Map<string, number> }).__bestechManualHold ??= new Map());
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_MS = 5 * 60 * 1000;

export function hashKey(raw: string): string {
  return createHash('sha256').update(raw.trim()).digest('hex');
}

export function authenticateKey(raw: string | null | undefined): IngestKey | null {
  if (!raw || !raw.trim()) return null;
  return one<IngestKey>('SELECT id, asset_code FROM ingest_keys WHERE key_hash = ?', hashKey(raw)) ?? null;
}

interface RawReading {
  sensor?: unknown;
  code?: unknown;
  value?: unknown;
  ts?: unknown;
}

function normalize(body: unknown): { readings: RawReading[]; device: string | null } | string {
  if (Array.isArray(body)) return { readings: body as RawReading[], device: null };
  if (body && typeof body === 'object') {
    const obj = body as { readings?: unknown; device?: unknown };
    const device = typeof obj.device === 'string' ? obj.device : null;
    if (Array.isArray(obj.readings)) return { readings: obj.readings as RawReading[], device };
    if ('value' in obj) return { readings: [obj as RawReading], device };
  }
  return 'ожидается { readings: [...] } или одиночное показание { sensor, value }';
}

function logPacket(key: IngestKey, device: string, remote: string, bytes: number, status: number, note: string): number {
  const result = getDb()
    .prepare(
      `INSERT INTO ingest_packets (asset_code, key_id, device, remote, received_at, accepted, rejected, bytes, status, note)
       VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`,
    )
    .run(key.asset_code, key.id, device, remote, new Date().toISOString(), bytes, status, note);
  return Number(result.lastInsertRowid);
}

/** Пакет, отбитый до разбора показаний (битый JSON, превышение размера). */
export function logRejectedPacket(key: IngestKey, device: string, remote: string, bytes: number, status: number, note: string): void {
  logPacket(key, device, remote, bytes, status, note);
}

export interface IngestInput {
  key: IngestKey;
  body: unknown;
  device: string;
  remote: string;
  bytes: number;
}

export interface IngestResult {
  status: number;
  body: Record<string, unknown>;
}

const pruneState = ((globalThis as { __bestechIngestPrune?: { count: number } }).__bestechIngestPrune ??= { count: 0 });

/** Хранилище демо-стенда не растёт бесконечно: показания за 3 суток, журнал — 5000 пакетов. */
function prune(): void {
  pruneState.count += 1;
  if (pruneState.count % 200 !== 0) return;
  run('DELETE FROM sensor_readings WHERE ts < ?', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString());
  run('DELETE FROM ingest_packets WHERE id < (SELECT MAX(id) - 5000 FROM ingest_packets)');
}

export function ingestPacket(input: IngestInput): IngestResult {
  const { key, remote, bytes } = input;
  const nowMs = Date.now();
  const normalized = normalize(input.body);

  if (typeof normalized === 'string') {
    logPacket(key, input.device, remote, bytes, 400, normalized);
    return { status: 400, body: { error: normalized } };
  }

  const device = (normalized.device ?? input.device).slice(0, 64) || 'unknown';
  if (normalized.readings.length > MAX_READINGS) {
    logPacket(key, device, remote, bytes, 413, `больше ${MAX_READINGS} показаний в пакете`);
    return { status: 413, body: { error: `не больше ${MAX_READINGS} показаний в одном пакете` } };
  }

  const sensors = new Map(
    all<SensorRow>('SELECT * FROM sensors WHERE asset_code = ?', key.asset_code).map((s) => [s.code.toUpperCase(), s]),
  );
  const rejected: { sensor: string; reason: string }[] = [];
  let accepted = 0;
  // Ручной ввод (пульт, реальный шлюз) важнее эмулятора: пока действует удержание,
  // показания эмулятора по этому датчику не принимаются.
  const fromEmulator = /^emulator/i.test(device);

  transaction(() => {
    const packetId = logPacket(key, device, remote, bytes, 202, '');
    const insert = getDb().prepare('INSERT INTO sensor_readings (sensor_id, ts, value, packet_id) VALUES (?, ?, ?, ?)');

    for (const r of normalized.readings) {
      const code = String(r?.sensor ?? r?.code ?? '').trim().toUpperCase();
      const sensor = sensors.get(code);
      if (!sensor) {
        rejected.push({ sensor: code || '—', reason: 'датчик не зарегистрирован на объекте' });
        continue;
      }

      const value = typeof r.value === 'number' ? r.value : typeof r.value === 'string' ? Number(r.value.replace(',', '.')) : Number.NaN;
      if (!Number.isFinite(value) || Math.abs(value) > 1e6) {
        rejected.push({ sensor: code, reason: 'значение не число' });
        continue;
      }

      let tsMs = nowMs;
      if (r.ts !== undefined && r.ts !== null && r.ts !== '') {
        tsMs = typeof r.ts === 'number' ? (r.ts < 1e12 ? r.ts * 1000 : r.ts) : Date.parse(String(r.ts));
        if (!Number.isFinite(tsMs) || tsMs > nowMs + MAX_FUTURE_MS || tsMs < nowMs - MAX_AGE_MS) {
          rejected.push({ sensor: code, reason: 'метка времени вне допустимого окна' });
          continue;
        }
      }
      const ts = new Date(tsMs).toISOString();

      if (fromEmulator && (manualHold.get(sensor.id) ?? 0) > nowMs) {
        rejected.push({ sensor: code, reason: 'ручной ввод с пульта — приоритет 2 мин' });
        continue;
      }
      if (!fromEmulator) manualHold.set(sensor.id, nowMs + MANUAL_HOLD_MS);

      insert.run(sensor.id, ts, value, packetId);
      accepted += 1;

      // Состояние и аварии двигает только самое свежее показание: запоздавший пакет истории не должен «закрыть» аварию.
      if (!sensor.last_ts || ts >= sensor.last_ts) {
        const state = evaluate(sensor, value);
        run('UPDATE sensors SET last_value = ?, last_ts = ?, last_state = ? WHERE id = ?', value, ts, state, sensor.id);
        sensor.last_value = value;
        sensor.last_ts = ts;
        sensor.last_state = state;
        syncAlarm(sensor, state, value, ts);
      }
    }

    const note = rejected.length ? `отклонено ${rejected.length}: ${rejected[0]!.reason}` : '';
    run('UPDATE ingest_packets SET accepted = ?, rejected = ?, status = ?, note = ? WHERE id = ?',
      accepted, rejected.length, accepted ? 202 : 422, note, packetId);
    run('UPDATE ingest_keys SET last_used_at = ? WHERE id = ?', new Date(nowMs).toISOString(), key.id);
  });

  prune();

  const openAlarms = all<{ code: string; level: string }>(
    `SELECT s.code, a.level FROM alarms a JOIN sensors s ON s.id = a.sensor_id
      WHERE a.asset_code = ? AND a.closed_at IS NULL ORDER BY a.opened_at`,
    key.asset_code,
  );

  return {
    status: accepted ? 202 : 422,
    body: {
      received_at: new Date(nowMs).toISOString(),
      accepted,
      rejected,
      open_alarms: openAlarms.map((a) => `${a.code}:${a.level}`),
    },
  };
}
