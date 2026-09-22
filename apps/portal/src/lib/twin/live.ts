/**
 * Живое состояние цифрового двойника из БД: датчики с текущим состоянием,
 * графики по окну времени, очередь аварий и журнал входящих пакетов.
 *
 * «Нет связи» определяется здесь, при чтении: датчик, который молчит дольше
 * четырёх периодов опроса, переводится в offline и получает аварию. Отдельный
 * фоновый процесс для этого не нужен — экраны двойника опрашивают портал
 * каждые две секунды.
 */

import twin from '@/api/fixtures/twin.json';
import { all, one, run } from '@/db/client';
import type { Sensor, TelemetryChart, ToleranceState, TwinSummary } from '@/api/types';
import { alarmCode, syncAlarm, type AlarmLevel } from './alarms';
import type { EmulatorStatus } from './emulator';
import { alarmLimitValue, evaluate, formatValue, hhmm, hhmmss, limitText, num, ruDateTime, staleAfterMs, type SensorRow } from './model';
import { LIVE_PERIODS, type LivePeriod } from './shared';

export type { LivePeriod };

export interface LivePacket {
  id: number;
  time: string;
  device: string;
  remote: string;
  accepted: number;
  rejected: number;
  status: number;
  note: string;
}

export interface LiveAlarm {
  id: string;
  code: string;
  level: AlarmLevel;
  sensorId: string;
  sensorCode: string;
  sensorName: string;
  discipline: string;
  axis: string;
  value: string;
  threshold: string;
  title: string;
  message: string;
  openedLabel: string;
  closedLabel: string | null;
  closeNote: string | null;
  ackBy: string | null;
  ackLabel: string | null;
  series: number[];
  limitValue: number | null;
  unit: string;
}

export interface LiveStats {
  packetsPerMin: number;
  readingsTotal: number;
  lastPacketAgoS: number | null;
  lastPacketLabel: string;
  range: string;
  devices: string[];
  sensorsWithData: number;
}

export interface LiveTwin {
  code: string;
  hasData: boolean;
  summary: TwinSummary;
  sensors: Sensor[];
  charts: TelemetryChart[];
  alarms: LiveAlarm[];
  packets: LivePacket[];
  stats: LiveStats;
  generatedAt: string;
  /** Состояние эмулятора — только для ролей, которые им управляют. */
  emulator?: EmulatorStatus;
}

const FIXTURE_SUMMARY = twin.summary as unknown as Record<string, TwinSummary | undefined>;
const BUCKETS = 12;

export function hasLiveSensors(code: string): boolean {
  return Number(one<{ n: number }>('SELECT COUNT(*) AS n FROM sensors WHERE asset_code = ?', code)?.n ?? 0) > 0;
}

interface Computed {
  row: SensorRow;
  state: ToleranceState;
}

/** Текущее состояние датчиков; молчащие переводятся в «нет связи» с аварией. */
function computeStates(rows: SensorRow[], nowMs: number): Computed[] {
  return rows.map((row) => {
    const lastMs = row.last_ts ? Date.parse(row.last_ts) : null;
    const stale = lastMs === null || nowMs - lastMs > staleAfterMs(row);

    if (stale && lastMs !== null && row.last_state !== 'offline') {
      run("UPDATE sensors SET last_state = 'offline' WHERE id = ?", row.id);
      syncAlarm(row, 'offline', null, new Date(nowMs).toISOString());
      row.last_state = 'offline';
    }

    const state: ToleranceState = stale ? 'offline' : evaluate(row, Number(row.last_value));
    return { row, state };
  });
}

function recentValues(sensorId: string, limit = 24): number[] {
  return all<{ value: number }>(
    'SELECT value FROM (SELECT value, ts FROM sensor_readings WHERE sensor_id = ? ORDER BY ts DESC LIMIT ?) ORDER BY ts',
    sensorId,
    limit,
  ).map((r) => Number(r.value));
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const maxOf = (values: number[], fallback = 0) => (values.length ? Math.max(...values) : fallback);

/** Средние по корзинам окна; пустые корзины заполняются соседним значением. */
function bucketValues(sensorId: string, fromMs: number, toMs: number): number[] {
  const rows = all<{ ts: string; value: number }>(
    'SELECT ts, value FROM sensor_readings WHERE sensor_id = ? AND ts >= ? AND ts <= ? ORDER BY ts',
    sensorId,
    new Date(fromMs).toISOString(),
    new Date(toMs).toISOString(),
  );
  const sums = new Array<number>(BUCKETS).fill(0);
  const counts = new Array<number>(BUCKETS).fill(0);
  const span = Math.max(1, toMs - fromMs);

  for (const r of rows) {
    const i = Math.min(BUCKETS - 1, Math.max(0, Math.floor(((Date.parse(r.ts) - fromMs) / span) * BUCKETS)));
    sums[i]! += Number(r.value);
    counts[i]! += 1;
  }

  const out: (number | null)[] = sums.map((s, i) => (counts[i] ? s / counts[i]! : null));
  let prev: number | null = null;
  for (let i = 0; i < out.length; i += 1) {
    if (out[i] === null) out[i] = prev;
    else prev = out[i]!;
  }
  const first = out.find((v) => v !== null) ?? 0;
  return out.map((v) => round2(v ?? first));
}

/** Прогноз по линейному тренду окна — продолжение наблюдаемой динамики. */
function linearTrend(values: number[]): number[] {
  const n = values.length;
  if (n < 2) return values;
  const xs = values.map((_, i) => i);
  const mx = (n - 1) / 2;
  const my = values.reduce((a, b) => a + b, 0) / n;
  const sxy = xs.reduce((acc, x, i) => acc + (x - mx) * (values[i]! - my), 0);
  const sxx = xs.reduce((acc, x) => acc + (x - mx) ** 2, 0) || 1;
  const k = sxy / sxx;
  return xs.map((x) => round2(my + k * (x - mx)));
}

function worst(states: ToleranceState[]): ToleranceState {
  if (states.includes('alarm')) return 'alarm';
  if (states.includes('warning')) return 'warning';
  if (states.includes('offline')) return 'offline';
  return 'ok';
}

function windowOf(code: string, period: LivePeriod, nowMs: number): { from: number; to: number } {
  const def = LIVE_PERIODS.find((p) => p.value === period) ?? LIVE_PERIODS[0]!;
  if (def.ms) return { from: nowMs - def.ms, to: nowMs };
  const first = one<{ ts: string | null }>(
    'SELECT MIN(r.ts) AS ts FROM sensor_readings r WHERE r.sensor_id IN (SELECT id FROM sensors WHERE asset_code = ?)',
    code,
  )?.ts;
  const from = first ? Date.parse(first) : nowMs - 5 * 60_000;
  return { from: Math.min(from, nowMs - 60_000), to: nowMs };
}

function timeLabels(fromMs: number, toMs: number): string[] {
  const span = toMs - fromMs;
  const withSeconds = span <= 20 * 60_000;
  return Array.from({ length: BUCKETS }, (_, i) => {
    // Подпись у каждой второй точки — двенадцать меток на ширине графика не помещаются.
    if (i % 2 === 1 && i !== BUCKETS - 1) return '';
    const d = new Date(fromMs + ((i + 1) / BUCKETS) * span);
    return withSeconds ? hhmmss(d) : hhmm(d);
  });
}

function buildCharts(code: string, computed: Computed[], fromMs: number, toMs: number, windowLabel: string): TelemetryChart[] {
  const byCode = new Map(computed.map((c) => [c.row.code, c]));
  const xLabels = timeLabels(fromMs, toMs);
  const charts: TelemetryChart[] = [];
  const current = (c: Computed | undefined) =>
    !c ? '—' : c.state === 'offline' ? 'нет связи' : formatValue(c.row, Number(c.row.last_value));

  // 01 · Бетон: температура твердения, набор прочности, прогноз по тренду
  const temp = byCode.get('КЖ-3') ?? computed.find((c) => c.row.kind === 'temperature');
  if (temp) {
    const strength = computed.find((c) => c.row.kind === 'strength');
    const second = computed.find((c) => c.row.kind === 'temperature' && c.row.id !== temp.row.id);
    const fact = bucketValues(temp.row.id, fromMs, toMs);
    const members = [temp, strength, second].filter((c): c is Computed => Boolean(c));

    charts.push({
      id: 't-concrete',
      title: `Температура и набор прочности бетона · ${temp.row.code}, ${temp.row.axis.split(' · ')[0]}`,
      subtitle: `Пакеты шлюза · окно ${windowLabel.toLowerCase()} · ${members.length} датчика`,
      state: worst(members.map((c) => c.state)),
      current: [current(temp), strength ? current(strength) : null].filter(Boolean).join(' · '),
      unit: '°C · % R28',
      kind: 'line',
      xLabels,
      yTicks: [0, 15, 25, 35],
      max: Math.max(40, Math.ceil(maxOf(fact) + 3)),
      thresholds: [
        ...(temp.row.alarm_high !== null ? [{ value: Number(temp.row.alarm_high), label: `ПОРОГ ${num(Number(temp.row.alarm_high), 0)} °C`, color: 'var(--bst-alarm)' }] : []),
        ...(temp.row.alarm_low !== null ? [{ value: Number(temp.row.alarm_low), label: `МИН ${num(Number(temp.row.alarm_low), 0)} °C`, color: 'var(--bst-warn)' }] : []),
      ],
      series: [
        { id: 'fact', label: `температура ${temp.row.code}, факт`, values: fact, color: 'var(--bst-accent)', marker: true },
        ...(strength
          ? [{ id: 'strength', label: `прочность ${strength.row.code}, % R28 (масштаб 1:2)`, values: bucketValues(strength.row.id, fromMs, toMs).map((v) => round2(v / 2)), color: 'var(--bst-ok)', marker: true }]
          : []),
        ...(second ? [{ id: 'second', label: `температура ${second.row.code}`, values: bucketValues(second.row.id, fromMs, toMs), color: 'var(--bst-text-mute)' }] : []),
        { id: 'forecast', label: 'прогноз по тренду', values: linearTrend(fact), color: 'var(--bst-accent-400)', dashed: true },
      ],
      summary: [
        { k: 'ТЕКУЩАЯ', v: current(temp) },
        { k: 'МАКСИМУМ', v: `${num(maxOf(fact), 1)} °C` },
        { k: 'ПРОЧНОСТЬ', v: strength ? current(strength) : '—' },
        { k: 'ДАТЧИКОВ', v: String(computed.filter((c) => c.row.kind === 'temperature' || c.row.kind === 'strength').length) },
      ],
    });
  }

  // 02 · Осадки деформационных марок
  const marks = computed.filter((c) => c.row.kind === 'settlement').sort((a, b) => Number(b.row.last_value ?? 0) - Number(a.row.last_value ?? 0));
  if (marks.length) {
    const lead = marks[0]!;
    const series = marks.slice(0, 3).map((c, i) => ({
      id: c.row.code,
      label: c.row.code,
      values: bucketValues(c.row.id, fromMs, toMs),
      color: ['var(--bst-accent)', 'var(--bst-accent-400)', 'var(--bst-text-mute)'][i]!,
      marker: i === 0,
    }));
    const peak = maxOf(series.flatMap((s) => s.values));
    charts.push({
      id: 't-settlement',
      title: 'Осадки деформационных марок',
      subtitle: `Нивелир-датчики · окно ${windowLabel.toLowerCase()} · ${marks.length} марки`,
      state: worst(marks.map((c) => c.state)),
      current: `${lead.row.code} · ${current(lead)}`,
      unit: 'мм',
      kind: 'line',
      xLabels,
      yTicks: [0, 5, 10, 15],
      max: Math.max(17, Math.ceil(peak + 2)),
      thresholds: [
        ...(lead.row.alarm_high !== null ? [{ value: Number(lead.row.alarm_high), label: `ДОПУСК ${num(Number(lead.row.alarm_high), 0)} мм`, color: 'var(--bst-alarm)' }] : []),
        ...(lead.row.warn_high !== null ? [{ value: Number(lead.row.warn_high), label: `ПРЕДУПР. ${num(Number(lead.row.warn_high), 0)} мм`, color: 'var(--bst-warn)' }] : []),
      ],
      series,
      summary: [
        { k: 'МАКСИМУМ', v: `${lead.row.code} · ${current(lead)}` },
        { k: 'ДОПУСК', v: limitText(lead.row) },
        { k: 'МАРОК', v: String(marks.length) },
        { k: 'ВНЕ ДОПУСКА', v: String(marks.filter((c) => c.state === 'alarm').length) },
      ],
    });
  }

  // 03 · Нагрузки на фермы — текущие значения столбиками
  const loads = computed.filter((c) => c.row.kind === 'load');
  if (loads.length) {
    const limit = loads[0]!.row.alarm_high;
    const top = [...loads].sort((a, b) => Number(b.row.last_value ?? 0) - Number(a.row.last_value ?? 0))[0]!;
    charts.push({
      id: 't-loads',
      title: 'Нагрузки на фермы покрытия, % от проектной',
      subtitle: `Тензометрия · текущие значения · ${loads.length} фермы`,
      state: worst(loads.map((c) => c.state)),
      current: `${top.row.code} · ${current(top)}`,
      unit: '%',
      kind: 'bar',
      xLabels: [],
      yTicks: [],
      max: 100,
      thresholds: limit !== null ? [{ value: Number(limit), label: `ПОРОГ ${num(Number(limit), 0)} %`, color: 'var(--bst-alarm)' }] : [],
      series: [],
      bars: loads.map((c) => ({ label: c.row.code, value: Math.round(Number(c.row.last_value ?? 0)), highlight: c.state === 'alarm' || c.state === 'warning' })),
      summary: [
        { k: 'МАКСИМУМ', v: `${top.row.code} · ${current(top)}` },
        { k: 'ПОРОГ', v: limitText(top.row) },
        { k: 'ФЕРМ', v: String(loads.length) },
        { k: 'ВНЕ ДОПУСКА', v: String(loads.filter((c) => c.state === 'alarm').length) },
      ],
    });
  }

  return charts;
}

interface AlarmRow {
  id: string;
  number: number;
  sensor_id: string;
  level: AlarmLevel;
  value: number | null;
  threshold: string;
  title: string;
  message: string;
  opened_at: string;
  closed_at: string | null;
  close_note: string | null;
  ack_by: string | null;
  ack_at: string | null;
}

export function buildLive(code: string, period: LivePeriod = '24h'): LiveTwin {
  const nowMs = Date.now();
  const rows = all<SensorRow>('SELECT * FROM sensors WHERE asset_code = ? ORDER BY sort', code);
  const computed = computeStates(rows, nowMs);
  const rowById = new Map(rows.map((r) => [r.id, r]));

  const sensors: Sensor[] = computed.map(({ row, state }) => {
    const last = row.last_value === null ? null : Number(row.last_value);
    const seen = row.last_ts ? hhmmss(new Date(row.last_ts)) : '—';
    return {
      id: row.id,
      code: row.code,
      discipline: row.discipline,
      name: row.name,
      value: state === 'offline' ? (last === null ? 'нет данных' : 'нет связи') : formatValue(row, last ?? 0),
      limit: limitText(row),
      state,
      axis: row.axis,
      meta: [
        `Раздел ${row.discipline}`,
        `допуск ${limitText(row)}`,
        row.last_ts ? `последний пакет ${seen}` : 'пакетов ещё не было',
        state === 'offline' && last !== null ? `последнее значение ${formatValue(row, last)}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
      x: Number(row.x),
      y: Number(row.y),
      series: recentValues(row.id),
      seen,
    };
  });

  const lastPacket = one<{ received_at: string }>('SELECT received_at FROM ingest_packets WHERE asset_code = ? ORDER BY id DESC LIMIT 1', code);
  const fixture = FIXTURE_SUMMARY[code];
  const count = (s: ToleranceState) => computed.filter((c) => c.state === s).length;

  const summary: TwinSummary = {
    progress: fixture?.progress ?? 0,
    plannedProgress: fixture?.plannedProgress ?? 0,
    sensorsOnline: computed.length - count('offline'),
    sensorsTotal: computed.length,
    withinTolerance: count('ok'),
    nearTolerance: count('warning'),
    outOfTolerance: count('alarm'),
    offline: count('offline'),
    updated: lastPacket ? ruDateTime(new Date(lastPacket.received_at)) : '—',
    scale: fixture?.scale ?? 'М 1:200 · IFC 4',
  };

  const { from, to } = windowOf(code, period, nowMs);
  const windowLabel = LIVE_PERIODS.find((p) => p.value === period)?.label ?? '5 МИН';
  const charts = buildCharts(code, computed, from, to, windowLabel);

  const alarmRows = all<AlarmRow>(
    `SELECT id, number, sensor_id, level, value, threshold, title, message, opened_at, closed_at, close_note, ack_by, ack_at
       FROM alarms
      WHERE asset_code = ? AND (closed_at IS NULL OR opened_at >= ?)
      ORDER BY (closed_at IS NULL) DESC, CASE level WHEN 'alarm' THEN 0 WHEN 'offline' THEN 1 ELSE 2 END, opened_at DESC
      LIMIT 40`,
    code,
    new Date(nowMs - 24 * 60 * 60 * 1000).toISOString(),
  );

  const alarms: LiveAlarm[] = alarmRows.flatMap((a) => {
    const sensor = rowById.get(a.sensor_id);
    if (!sensor) return [];
    return [
      {
        id: a.id,
        code: alarmCode(Number(a.number), a.opened_at),
        level: a.level,
        sensorId: sensor.id,
        sensorCode: sensor.code,
        sensorName: sensor.name,
        discipline: sensor.discipline,
        axis: sensor.axis,
        value: a.value === null ? '—' : formatValue(sensor, Number(a.value)),
        threshold: a.threshold,
        title: a.title,
        message: a.message,
        openedLabel: ruDateTime(new Date(a.opened_at)),
        closedLabel: a.closed_at ? ruDateTime(new Date(a.closed_at)) : null,
        closeNote: a.close_note,
        ackBy: a.ack_by,
        ackLabel: a.ack_at ? ruDateTime(new Date(a.ack_at)) : null,
        series: recentValues(sensor.id, 30),
        limitValue: alarmLimitValue(sensor),
        unit: sensor.unit,
      },
    ];
  });

  const packets = all<{ id: number; received_at: string; device: string; remote: string; accepted: number; rejected: number; status: number; note: string }>(
    'SELECT id, received_at, device, remote, accepted, rejected, status, note FROM ingest_packets WHERE asset_code = ? ORDER BY id DESC LIMIT 25',
    code,
  ).map<LivePacket>((p) => ({
    id: Number(p.id),
    time: hhmmss(new Date(p.received_at)),
    device: p.device,
    // Устройство на той же машине, что и портал (эмулятор, проверка из консоли).
    remote: /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(p.remote) ? 'localhost' : p.remote,
    accepted: Number(p.accepted),
    rejected: Number(p.rejected),
    status: Number(p.status),
    note: p.note,
  }));

  const sinceMinute = new Date(nowMs - 60_000).toISOString();
  const stats: LiveStats = {
    packetsPerMin: Number(one<{ n: number }>('SELECT COUNT(*) AS n FROM ingest_packets WHERE asset_code = ? AND received_at >= ?', code, sinceMinute)?.n ?? 0),
    readingsTotal: Number(
      one<{ n: number }>('SELECT COUNT(*) AS n FROM sensor_readings WHERE sensor_id IN (SELECT id FROM sensors WHERE asset_code = ?)', code)?.n ?? 0,
    ),
    lastPacketAgoS: lastPacket ? Math.max(0, Math.round((nowMs - Date.parse(lastPacket.received_at)) / 1000)) : null,
    lastPacketLabel: lastPacket ? hhmmss(new Date(lastPacket.received_at)) : '—',
    range: `${hhmm(new Date(from))} — ${hhmm(new Date(to))}`,
    devices: all<{ device: string }>(
      'SELECT DISTINCT device FROM ingest_packets WHERE asset_code = ? AND received_at >= ?',
      code,
      new Date(nowMs - 10 * 60_000).toISOString(),
    ).map((d) => d.device),
    sensorsWithData: rows.filter((r) => r.last_ts).length,
  };

  return {
    code,
    hasData: stats.sensorsWithData > 0,
    summary,
    sensors,
    charts,
    alarms,
    packets,
    stats,
    generatedAt: new Date(nowMs).toISOString(),
  };
}
