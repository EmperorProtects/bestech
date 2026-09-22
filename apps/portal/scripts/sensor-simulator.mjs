#!/usr/bin/env node
/**
 * Эмулятор датчиков стройплощадки для демо-стенда BESTECH.
 *
 * Играет роль шлюза: забирает у портала список датчиков объекта и шлёт показания
 * тем же HTTP API, что и настоящий шлюз (LoRaWAN / MQTT / Modbus → HTTP):
 *
 *   GET  /api/ingest/v1/sensors    конфигурация датчиков объекта
 *   POST /api/ingest/v1/readings   Authorization: Bearer <ключ устройства>
 *
 * Запуск из терминала:
 *   pnpm demo:sensors                                   (портал на http://localhost:3000)
 *   node scripts/sensor-simulator.mjs --url http://192.168.1.10:3000 --interval 2
 *
 * Клавиши: 1 перегруз фермы Ф-2 · 2 осадка ГМ-07 · 3 перегрев бетона КЖ-3 ·
 *          4 обрыв связи ТП-1 · 0 всё в норме · q выход
 *
 * С флагом --control команды читаются построчно из stdin (так его запускает портал).
 */

import readline from 'node:readline';

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};

const BASE = opt('url', 'http://localhost:3000').replace(/\/$/, '');
const KEY = opt('key', process.env.BESTECH_DEMO_INGEST_KEY ?? 'bst_demo_2026-014_gateway');
const DEVICE = opt('device', 'emulator-cli');
const INTERVAL_S = Math.max(1, Number(opt('interval', '3')));
const BACKFILL_MIN = Math.max(0, Number(opt('backfill', '10')));
const CONTROL = argv.includes('--control');

const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}`, 'X-Device-Id': DEVICE };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clock = () => new Date().toLocaleTimeString('ru-RU');
const say = (s) => process.stdout.write(`${s}\n`);

/* ── Модель показаний ───────────────────────────────────────────────────── */

/** Рабочие значения датчиков демо-объекта; для незнакомых кодов — по типу. */
const BASES = {
  'КЖ-1': 21.4, 'КЖ-3': 19.2, 'ПР-3': 42, 'ГМ-01': 3.9, 'ГМ-03': 7.2, 'ГМ-07': 11.1,
  'Ф-1': 61, 'Ф-2': 68, 'Ф-3': 54, 'ТР-1': 0.12, 'ВК-У2': 0.45, 'ЭОМ-ТП': 58,
};
const DEFAULT_BASE = { temperature: 20, strength: 40, settlement: 5, load: 60, crack: 0.1, pressure: 0.45, power: 55 };
const NOISE = { temperature: 0.2, strength: 0, settlement: 0.03, load: 0.9, crack: 0.004, pressure: 0.007, power: 2.2 };

const SCENARIOS = {
  normal: { label: 'все значения возвращаются к рабочим' },
  load: { label: 'перегруз фермы Ф-2', code: 'Ф-2', target: 88, rate: 1.6 },
  settle: { label: 'осадка марки ГМ-07 сверх допуска', code: 'ГМ-07', target: 16.3, rate: 0.35 },
  heat: { label: 'перегрев бетона КЖ-3', code: 'КЖ-3', target: 37.8, rate: 1.4 },
  offline: { label: 'обрыв связи с датчиком ЭОМ-ТП', offline: 'ЭОМ-ТП' },
};
const KEYS = { 1: 'load', 2: 'settle', 3: 'heat', 4: 'offline', 0: 'normal' };

let sensors = [];
const offline = new Set();
let tickNo = 0;

function init(config) {
  sensors = config.sensors.map((s) => {
    const base = BASES[s.code] ?? DEFAULT_BASE[s.kind] ?? 10;
    return { ...s, base, value: base, target: base, rate: Math.max(Math.abs(base) * 0.05, 0.01), reading: base };
  });
}

function applyScenario(id) {
  const scenario = SCENARIOS[id];
  if (!scenario) {
    say(`? неизвестная команда «${id}»`);
    return;
  }
  if (id === 'normal') {
    for (const s of sensors) {
      s.target = s.base;
      s.rate = Math.max(Math.abs(s.base) * 0.08, 0.02);
    }
    offline.clear();
  }
  if (scenario.code) {
    const s = sensors.find((x) => x.code === scenario.code);
    if (s) {
      s.target = scenario.target;
      s.rate = scenario.rate;
    }
  }
  if (scenario.offline) offline.add(scenario.offline);
  say(`${clock()} ◆ сценарий: ${scenario.label}`);
}

/** Шум, похожий на нормальный: сумма трёх равномерных. */
const noise = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

function step() {
  tickNo += 1;
  for (const s of sensors) {
    const calm = s.target === s.base;
    if (s.kind === 'strength') {
      s.base = Math.min(99, s.base + 0.08); // бетон набирает прочность
      s.target = s.base;
    }
    if (s.kind === 'settlement' && calm) {
      s.base += 0.002; // медленная консолидация основания
      s.target = s.base;
    }
    const diff = s.target - s.value;
    s.value += Math.sign(diff) * Math.min(Math.abs(diff), s.rate);
    const daily = s.kind === 'temperature' && calm ? Math.sin(tickNo / 12) * 1.1 : 0;
    s.reading = Number((s.value + daily + (NOISE[s.kind] ?? 0) * noise()).toFixed(s.decimals));
  }
}

function batch(tsIso) {
  return sensors
    .filter((s) => !offline.has(s.code))
    .map((s) => ({ sensor: s.code, value: s.reading, ...(tsIso ? { ts: tsIso } : {}) }));
}

/* ── Обмен с порталом ───────────────────────────────────────────────────── */

async function loadConfig() {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const res = await fetch(`${BASE}/api/ingest/v1/sensors`, { headers });
      if (res.status === 401) {
        say('▲ портал не принял ключ устройства');
        process.exit(2);
      }
      if (res.ok) return await res.json();
      say(`… портал ответил ${res.status}, повтор через 2 с`);
    } catch (error) {
      // Причину показываем сразу: «не тот протокол» и «сервер не запущен» лечатся по-разному.
      const reason = error.cause?.code ?? error.cause?.message ?? error.message;
      if (attempt === 1 || attempt % 10 === 0) say(`… жду портал ${BASE}: ${reason}`);
    }
    await sleep(2000);
  }
}

async function send(readings) {
  const res = await fetch(`${BASE}/api/ingest/v1/readings`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ device: DEVICE, readings }),
  });
  let body = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  return { status: res.status, body };
}

async function backfill() {
  if (!BACKFILL_MIN) return;
  const stepS = 15;
  const steps = Math.floor((BACKFILL_MIN * 60) / stepS);
  say(`${clock()} ◆ передаю буфер шлюза за ${BACKFILL_MIN} мин: ${steps} пакетов`);
  const now = Date.now();
  for (let i = steps; i >= 1; i -= 1) {
    step();
    try {
      await send(batch(new Date(now - i * stepS * 1000).toISOString()));
    } catch {
      return;
    }
  }
}

let inflight = false;
async function tick() {
  if (inflight) return;
  inflight = true;
  step();
  try {
    const { status, body } = await send(batch());
    const rejected = body.rejected?.length ? ` · отклонено ${body.rejected.length}` : '';
    const alarms = body.open_alarms?.length ? ` · тревоги: ${body.open_alarms.join(', ')}` : '';
    say(`${clock()} → ${status} · принято ${body.accepted ?? 0}${rejected}${alarms}`);
  } catch (error) {
    say(`${clock()} ▲ портал недоступен: ${error.message}`);
  } finally {
    inflight = false;
  }
}

function controls() {
  if (!CONTROL && process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.on('keypress', (str, key) => {
      if ((key?.ctrl && key.name === 'c') || str === 'q') process.exit(0);
      const id = KEYS[str];
      if (id) applyScenario(id);
    });
    say('клавиши: 1 перегруз Ф-2 · 2 осадка ГМ-07 · 3 перегрев бетона · 4 обрыв связи ТП-1 · 0 норма · q выход');
    return;
  }
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', (line) => {
    const cmd = line.trim();
    if (!cmd) return;
    if (cmd === 'quit' || cmd === 'stop') process.exit(0);
    applyScenario(KEYS[cmd] ?? cmd);
  });
  // Портал закрыл канал (перезапуск сервера) — не оставляем осиротевший процесс.
  if (CONTROL) rl.on('close', () => process.exit(0));
}

const config = await loadConfig();
init(config);
say(`${clock()} ◆ шлюз ${DEVICE} → ${BASE} · объект ${config.asset} · датчиков ${sensors.length} · опрос ${INTERVAL_S} с`);
controls();
await backfill();
await tick();
setInterval(tick, INTERVAL_S * 1000);
