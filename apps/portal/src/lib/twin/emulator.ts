/**
 * Встроенный запуск эмулятора датчиков для презентации. Портал не генерирует
 * показания сам: он запускает отдельный процесс `scripts/sensor-simulator.mjs`,
 * который шлёт пакеты в публичный API приёма так же, как внешний шлюз. Поэтому
 * на экране «Приём данных» эмулятор виден обычным устройством emulator-01.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { run, transaction } from '@/db/client';
import { DEMO_INGEST_KEY } from './catalog';
import { hhmmss } from './model';
import { SCENARIOS, type ScenarioId } from './shared';

export interface EmulatorStatus {
  available: boolean;
  running: boolean;
  startedLabel: string | null;
  scenario: ScenarioId;
  lines: string[];
}

interface State {
  proc: ChildProcess | null;
  lines: string[];
  startedAt: Date | null;
  scenario: ScenarioId;
}

const state = ((globalThis as { __bestechEmulator?: State }).__bestechEmulator ??= {
  proc: null,
  lines: [],
  startedAt: null,
  scenario: 'normal',
});

const SCRIPT = path.join(process.cwd(), 'scripts', 'sensor-simulator.mjs');

function push(chunk: string): void {
  for (const line of chunk.split(/\r?\n/)) {
    if (line.trim()) state.lines.push(line);
  }
  if (state.lines.length > 60) state.lines.splice(0, state.lines.length - 60);
}

function isRunning(): boolean {
  return Boolean(state.proc && state.proc.exitCode === null && !state.proc.killed);
}

export function emulatorStatus(): EmulatorStatus {
  return {
    available: existsSync(SCRIPT),
    running: isRunning(),
    startedLabel: state.startedAt ? hhmmss(state.startedAt) : null,
    scenario: state.scenario,
    lines: state.lines.slice(-30),
  };
}

/**
 * Адрес, по которому эмулятор достучится до портала. Эмулятор работает на той же
 * машине, что и сервер, поэтому адрес из браузера не годится: за прокси или туннелем
 * он бывает https или внешним хостом. Перебираем локальные адреса на порту сервера
 * и берём первый, где действительно отвечает API приёма.
 */
async function resolvePortalUrl(requestUrl: { port: string; origin: string }): Promise<{ base: string | null; tried: string[] }> {
  const ports = Array.from(new Set([process.env.PORT, requestUrl.port, '3000'].filter((p): p is string => Boolean(p))));
  const candidates = [
    ...(process.env.BESTECH_EMULATOR_URL ? [process.env.BESTECH_EMULATOR_URL] : []),
    ...ports.flatMap((p) => [`http://127.0.0.1:${p}`, `http://localhost:${p}`]),
    requestUrl.origin,
  ].map((u) => u.replace(/\/$/, ''));

  for (const base of candidates) {
    try {
      const res = await fetch(`${base}/api/ingest/v1/health`, { signal: AbortSignal.timeout(1500), cache: 'no-store' });
      const body = (await res.json()) as { service?: string };
      if (res.ok && body.service === 'bestech-ingest') return { base, tried: candidates };
    } catch {
      // Адрес не отвечает — пробуем следующий.
    }
  }
  return { base: null, tried: candidates };
}

export async function startEmulator(requestUrl: { port: string; origin: string }): Promise<EmulatorStatus> {
  if (isRunning()) return emulatorStatus();
  if (!existsSync(SCRIPT)) {
    push(`скрипт эмулятора не найден: ${SCRIPT}`);
    return emulatorStatus();
  }

  const { base, tried } = await resolvePortalUrl(requestUrl);
  if (!base) {
    push(`▲ портал не ответил ни по одному локальному адресу: ${tried.join(', ')} — задайте BESTECH_EMULATOR_URL`);
    return emulatorStatus();
  }
  // Пока проверяли адреса, эмулятор мог запустить второй клик.
  if (isRunning()) return emulatorStatus();

  state.lines = [`адрес портала для эмулятора: ${base}`];
  state.scenario = 'normal';
  const proc = spawn(
    process.execPath,
    [SCRIPT, '--url', base, '--key', DEMO_INGEST_KEY, '--device', 'emulator-01', '--control', '--backfill', '10', '--interval', '3'],
    { cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true },
  );

  proc.stdout?.setEncoding('utf8');
  proc.stderr?.setEncoding('utf8');
  proc.stdout?.on('data', (d: string) => push(d));
  proc.stderr?.on('data', (d: string) => push(`! ${d}`));
  proc.on('exit', (code) => {
    push(`эмулятор остановлен (код ${code ?? '—'})`);
    if (state.proc === proc) {
      state.proc = null;
      state.startedAt = null;
    }
  });

  state.proc = proc;
  state.startedAt = new Date();
  return emulatorStatus();
}

export function stopEmulator(): EmulatorStatus {
  if (state.proc) {
    state.proc.stdin?.end();
    state.proc.kill();
  }
  state.proc = null;
  state.startedAt = null;
  return emulatorStatus();
}

/**
 * Чистый лист перед показом: останавливает эмулятор и удаляет показания, журнал
 * пакетов, аварии и их события в ленте объекта. Реестр датчиков и ключи остаются.
 */
export function resetDemoData(assetCode: string): EmulatorStatus {
  stopEmulator();
  transaction(() => {
    run('DELETE FROM sensor_readings WHERE sensor_id IN (SELECT id FROM sensors WHERE asset_code = ?)', assetCode);
    run('DELETE FROM alarms WHERE asset_code = ?', assetCode);
    run('DELETE FROM ingest_packets WHERE asset_code = ?', assetCode);
    run("DELETE FROM asset_events WHERE asset_code = ? AND href LIKE '%/alarms%'", assetCode);
    run("UPDATE sensors SET last_value = NULL, last_ts = NULL, last_state = 'offline' WHERE asset_code = ?", assetCode);
  });
  state.lines = ['демо-данные сброшены: показания, пакеты и аварии удалены'];
  state.scenario = 'normal';
  return emulatorStatus();
}

export function setScenario(id: ScenarioId): EmulatorStatus {
  const scenario = SCENARIOS.find((s) => s.id === id);
  if (!scenario || !isRunning()) return emulatorStatus();
  state.scenario = id;
  state.proc?.stdin?.write(`${id}\n`);
  return emulatorStatus();
}
