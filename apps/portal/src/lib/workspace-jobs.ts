/**
 * Задания Claude в мастерской. Портал не запускает claude.exe сам — он
 * обращается к уже существующей веб-обёртке мастерской (`newExport/_web/server.py`),
 * которая держит права (`--permission-mode`), cwd проекта, хуки и MCP-серверы.
 *
 *   POST {WEB}/api/chat   → SSE: session · delta · tool · result · error · done
 *   POST {WEB}/api/stop   → прервать сессию
 *
 * Токен обёртки читается на сервере портала и в браузер не попадает.
 * Одновременно идёт одно задание: RevitBridge обслуживает один документ.
 */

import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { Readable } from 'node:stream';
import { all, one, run } from '@/db/client';
import { AR_TEMPLATE, FOLDERS, PROJECT_PHASES, WORKSPACE_DIR, phasesFileRel, readPhases, syncWorkspace, type LinkedProject } from './workspace';

export const CLAUDE_WEB_URL = (process.env.BESTECH_CLAUDE_WEB_URL ?? 'http://127.0.0.1:8090').replace(/\/$/, '');

/**
 * POST с потоковым ответом через node:http. Не fetch: у undici bodyTimeout 5 минут,
 * а агент может молчать дольше (долгая команда Revit) — поток рвался с «terminated».
 */
function postStream(url: string, headers: Record<string, string>, body: string, signal: AbortSignal) {
  return new Promise<{ status: number; body: ReadableStream<Uint8Array> }>((resolve, reject) => {
    const req = http.request(
      url,
      { method: 'POST', signal, headers: { ...headers, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      (res) => resolve({ status: res.statusCode ?? 0, body: Readable.toWeb(res) as ReadableStream<Uint8Array> }),
    );
    req.on('error', reject);
    req.end(body);
  });
}

function claudeWebToken(): string | null {
  if (process.env.BESTECH_CLAUDE_WEB_TOKEN) return process.env.BESTECH_CLAUDE_WEB_TOKEN;
  const file = path.join(WORKSPACE_DIR, '_web', '.token');
  return existsSync(file) ? readFileSync(file, 'utf8').trim() || null : null;
}

/* ── Пресеты: задания под скиллы мастерской ──────────────────────────────── */

export type PresetId = 'project' | 'album' | 'normcheck-ar' | 'normcheck' | 'verify' | 'rpz' | 'smeta' | 'custom';

export interface Preset {
  id: PresetId;
  label: string;
  skill: string | null;
  note: string;
  /** Задание меняет модель или файлы мастерской. */
  writes: boolean;
}

export const PRESETS: Preset[] = [
  { id: 'project', label: 'Проект по ТЗ', skill: 'normcheck-ar · revit-verify · normcheck', note: 'Модель из шаблона и работа по этапам регламента до альбома. Каждое задание продолжает с первого незакрытого этапа', writes: true },
  { id: 'album', label: 'Выпуск альбома', skill: 'revit-verify · normcheck', note: 'Собрать листы по ТЗ, проверить, экспортировать PDF и манифест в 04_Чертежи', writes: true },
  { id: 'normcheck-ar', label: 'Нормоконтроль планировки', skill: 'normcheck-ar', note: 'Планы этажей по нормам РК, правки на месте', writes: true },
  { id: 'normcheck', label: 'Нормоконтроль листов СПДС', skill: 'normcheck', note: 'Оси, размеры, штамп, выноски, отметки — с правкой', writes: true },
  { id: 'verify', label: 'Проверка листов', skill: 'revit-verify', note: 'Только отчёт: предупреждения, пустые виды, размеры листов', writes: false },
  { id: 'rpz', label: 'Обновить РПЗ', skill: null, note: 'Площади и ТЭП из модели в 03_РПЗ', writes: true },
  { id: 'smeta', label: 'Смета ПИР', skill: 'smeta', note: 'Расчёт по СЦП РК в 02_Сметы', writes: true },
  { id: 'custom', label: 'Своя задача', skill: null, note: 'Текст задания целиком ваш', writes: true },
];

/** Соглашение о выдаче, которое читает портал, — повторяется в каждом задании. */
function contract(shifr: string): string {
  return [
    'Выдача для портала BESTECH (портал читает папки мастерской, не нарушай соглашение):',
    `- альбом: ${FOLDERS.drawings}\\${shifr}_альбом.pdf;`,
    `- манифест листов рядом: ${FOLDERS.drawings}\\${shifr}_альбом.json вида {"sheets":[{"number":"1","name":"Общие данные","format":"А3"}]} — порядок = порядок страниц PDF;`,
    `- РПЗ: ${FOLDERS.rpz}\\${shifr}_РПЗ.md; смета: ${FOLDERS.estimates}\\.`,
  ].join('\n');
}

export function buildPrompt(preset: PresetId, project: LinkedProject, extra: string, userName: string): string {
  const { shifr } = project;
  const model = project.modelPath ? `${WORKSPACE_DIR}\\${project.modelPath}` : `модели ${shifr}.rvt в ${FOLDERS.models} ещё нет`;
  const head = `Задание из портала BESTECH (пользователь: ${userName}). Шифр ${shifr}. Модель: ${model}. ТЗ — в «${FOLDERS.inputs}».`;

  const body: Record<PresetId, string> = {
    album:
      `Выпусти или обнови альбом ${shifr} по ТЗ и регламенту. Перед экспортом — скилл revit-verify, после оформления каждой фазы — normcheck. ` +
      'Сохрани модель. В конце перечисли листы альбома и что изменилось.',
    'normcheck-ar':
      `Прогони скилл normcheck-ar по всем планам этажей ${shifr}, исправь найденное на месте, повтори проверку до чистого результата. ` +
      'В конце — таблица: замечание, где, что сделано.',
    normcheck:
      `Прогони скилл normcheck по листам ${shifr} с правкой на месте. В конце — таблица замечаний и исправлений.`,
    verify:
      `Проверь листы ${shifr} скиллом revit-verify. Модель НЕ меняй, файлы не пиши — только отчёт: лист, проблема, что предлагаешь.`,
    rpz:
      `Обнови расчётно-пояснительную записку ${shifr}: площади, экспликацию и ТЭП бери из модели, не набирай вручную.`,
    smeta:
      `Составь или пересчитай смету ПИР для ${shifr} скиллом smeta. Excel — в ${FOLDERS.estimates}, в конце итоговые суммы.`,
    project: '',
    custom: '',
  };

  return [head, preset === 'project' ? projectBrief(project) : body[preset], extra.trim() ? `Дополнительно: ${extra.trim()}` : '', contract(shifr)].filter(Boolean).join('\n\n');
}

/** Задание «Проект по ТЗ»: создать модель или продолжить с первого незакрытого этапа. */
function projectBrief(project: LinkedProject): string {
  const { shifr } = project;
  const phasesFile = `${WORKSPACE_DIR}\\${phasesFileRel(shifr)}`;
  const phases = readPhases(shifr);
  const state = phases
    ? phases.map((p) => `${p.id}: ${p.status}${p.comment ? ` (${p.comment})` : ''}`).join('; ')
    : 'файла этапов нет';

  return [
    `Веди проект ${shifr} по ТЗ из «${FOLDERS.inputs}» (ТЗ_${shifr}.md и файлы с шифром в имени) строго по регламенту ~/.claude/РЕГЛАМЕНТ_агентов.md и agent/experts/ar.md. Мебель на листах АР не показывать.`,
    project.modelPath
      ? `Модель уже есть: ${WORKSPACE_DIR}\\${project.modelPath}. Продолжай с первого незавершённого этапа.`
      : `Модели ещё нет: создай её из шаблона ${AR_TEMPLATE} и сохрани как ${WORKSPACE_DIR}\\${FOLDERS.models}\\${shifr}.rvt.`,
    `Этапы по порядку: ${PROJECT_PHASES.map((p) => `${p.id} — ${p.label} (${p.note})`).join('; ')}.`,
    `Текущее состояние этапов: ${state}.`,
    `После КАЖДОГО этапа: нормоконтроль этапа сразу, сохранить модель, обновить ${phasesFile} — {"phases":{"<id>":{"status":"done|in_progress|blocked","note":"что сделано","updated":"ISO-дата"}}}. Закрытые этапы не переделывать без причины.`,
    `Скрипты — в _скрипты\\${shifr}\\. Если этап не укладывается в задание или нужны решения заказчика — отметь его in_progress или blocked с причиной и остановись на границе этапа.`,
    'В последнем сообщении: какие этапы закрыты, что следующее, вопросы к заказчику.',
  ].join('\n');
}

/* ── Статус обёртки ──────────────────────────────────────────────────────── */

export interface ClaudeWebStatus {
  url: string;
  online: boolean;
  tokenFound: boolean;
  permissionMode: string | null;
  error: string | null;
}

export async function claudeWebStatus(): Promise<ClaudeWebStatus> {
  const token = claudeWebToken();
  const status: ClaudeWebStatus = { url: CLAUDE_WEB_URL, online: false, tokenFound: Boolean(token), permissionMode: null, error: null };
  try {
    const res = await fetch(`${CLAUDE_WEB_URL}/api/config`, {
      headers: token ? { 'X-Token': token } : {},
      signal: AbortSignal.timeout(1500),
      cache: 'no-store',
    });
    if (res.status === 401) {
      status.online = true;
      status.error = 'сервер отвечает, но токен не подошёл';
      return status;
    }
    const data = (await res.json()) as { permission_mode?: string };
    status.online = res.ok;
    status.permissionMode = data.permission_mode ?? null;
  } catch {
    status.error = 'сервер мастерской не запущен (_web\\start.bat)';
  }
  return status;
}

/* ── Задания ─────────────────────────────────────────────────────────────── */

export type JobStatus = 'running' | 'done' | 'error' | 'stopped';

export interface WorkspaceJob {
  id: string;
  assetCode: string;
  shifr: string;
  preset: PresetId;
  prompt: string;
  status: JobStatus;
  sessionId: string | null;
  log: string;
  result: string | null;
  costUsd: number | null;
  startedAt: string;
  finishedAt: string | null;
  userName: string | null;
}

interface JobRow {
  id: string; asset_code: string; shifr: string; preset: PresetId; prompt: string; status: JobStatus;
  session_id: string | null; log: string; result: string | null; cost_usd: number | null;
  started_at: string; finished_at: string | null; user_name: string | null;
}

const JOB_SELECT = `SELECT j.*, u.name AS user_name FROM workspace_jobs j LEFT JOIN users u ON u.id = j.user_id`;

function toJob(r: JobRow): WorkspaceJob {
  return {
    id: r.id, assetCode: r.asset_code, shifr: r.shifr, preset: r.preset, prompt: r.prompt, status: r.status,
    sessionId: r.session_id, log: r.log, result: r.result, costUsd: r.cost_usd === null ? null : Number(r.cost_usd),
    startedAt: r.started_at, finishedAt: r.finished_at, userName: r.user_name,
  };
}

/** Живые задания этого процесса. То, что «running» в БД, но не здесь, — осиротело после перезапуска. */
const live = ((globalThis as { __bestechJobs?: Map<string, AbortController> }).__bestechJobs ??= new Map());

function reapOrphans(): void {
  for (const r of all<{ id: string }>("SELECT id FROM workspace_jobs WHERE status = 'running'")) {
    if (!live.has(r.id)) {
      run("UPDATE workspace_jobs SET status = 'error', result = COALESCE(result, 'Прервано: портал перезапущен во время задания'), finished_at = ? WHERE id = ?",
        new Date().toISOString(), r.id);
    }
  }
}

export function getJob(id: string): WorkspaceJob | undefined {
  reapOrphans();
  const r = one<JobRow>(`${JOB_SELECT} WHERE j.id = ?`, id);
  return r ? toJob(r) : undefined;
}

export function listJobs(assetCode: string, limit = 20): WorkspaceJob[] {
  reapOrphans();
  return all<JobRow>(`${JOB_SELECT} WHERE j.asset_code = ? ORDER BY j.started_at DESC LIMIT ?`, assetCode, limit).map(toJob);
}

function lastSessionId(assetCode: string): string | null {
  return one<{ session_id: string | null }>(
    "SELECT session_id FROM workspace_jobs WHERE asset_code = ? AND session_id IS NOT NULL ORDER BY started_at DESC LIMIT 1",
    assetCode,
  )?.session_id ?? null;
}

export class JobError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export interface StartJobInput {
  project: LinkedProject;
  preset: PresetId;
  extra: string;
  continueSession: boolean;
  user: { id: string; name: string; orgId: string };
}

export async function startJob(input: StartJobInput): Promise<WorkspaceJob> {
  const { project, preset, extra, user } = input;
  if (!PRESETS.some((p) => p.id === preset)) throw new JobError('Неизвестный тип задания', 400);
  if (preset === 'custom' && !extra.trim()) throw new JobError('Опишите задачу', 400);

  reapOrphans();
  const busy = one<{ shifr: string }>("SELECT shifr FROM workspace_jobs WHERE status = 'running' LIMIT 1");
  if (busy) throw new JobError(`В мастерской уже идёт задание по ${busy.shifr} — Revit обслуживает один документ`, 409);

  const token = claudeWebToken();
  if (!token) throw new JobError('Не найден токен сервера мастерской (_web/.token)', 503);

  const prompt = buildPrompt(preset, project, extra, user.name);
  const sessionId = input.continueSession ? lastSessionId(project.assetCode) : null;

  const controller = new AbortController();
  let res: { status: number; body: ReadableStream<Uint8Array> };
  try {
    res = await postStream(
      `${CLAUDE_WEB_URL}/api/chat`,
      { 'X-Token': token },
      JSON.stringify({ message: prompt, attachments: [], session_id: sessionId }),
      controller.signal,
    );
  } catch {
    throw new JobError('Сервер мастерской не отвечает — запустите _web\\start.bat', 503);
  }
  if (res.status !== 200) {
    void res.body.cancel();
    throw new JobError(`Сервер мастерской ответил ${res.status}`, 502);
  }

  const id = randomUUID();
  const startedAt = new Date().toISOString();
  run(
    "INSERT INTO workspace_jobs (id, asset_code, shifr, user_id, preset, prompt, status, session_id, log, started_at) VALUES (?, ?, ?, ?, ?, ?, 'running', ?, '', ?)",
    id, project.assetCode, project.shifr, user.id, preset, prompt, sessionId, startedAt,
  );
  run('INSERT INTO activity (id, org_id, user_id, asset_code, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    randomUUID(), user.orgId, user.id, project.assetCode, 'workspace-job', preset, startedAt);

  live.set(id, controller);
  void consume(id, project, preset, res.body, controller);

  return getJob(id)!;
}

/** Читает SSE обёртки и пишет журнал в БД не чаще раза в секунду. */
async function consume(id: string, project: LinkedProject, preset: PresetId, body: ReadableStream<Uint8Array>, controller: AbortController) {
  const decoder = new TextDecoder();
  let buffer = '';
  let log = '';
  let flushedAt = 0;
  let final: { status: JobStatus; result: string | null; cost: number | null } = { status: 'error', result: 'Поток оборвался без результата', cost: null };

  const flush = (force = false) => {
    if (!force && Date.now() - flushedAt < 1000) return;
    flushedAt = Date.now();
    run('UPDATE workspace_jobs SET log = ? WHERE id = ?', log.slice(-200_000), id);
  };

  try {
    const reader = body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        if (!part.startsWith('data: ')) continue;
        let ev: { kind?: string; [k: string]: unknown };
        try {
          ev = JSON.parse(part.slice(6));
        } catch {
          continue;
        }

        if (ev.kind === 'session' && typeof ev.session_id === 'string') {
          run('UPDATE workspace_jobs SET session_id = ? WHERE id = ?', ev.session_id, id);
        } else if (ev.kind === 'delta' && typeof ev.text === 'string') {
          log += ev.text;
        } else if (ev.kind === 'tool') {
          const input = ev.input as Record<string, unknown> | undefined;
          const hint = input ? String(input.skill ?? input.command ?? input.file_path ?? input.description ?? '').slice(0, 120) : '';
          log += `\n▸ ${String(ev.name)}${hint ? ` · ${hint}` : ''}\n`;
        } else if (ev.kind === 'result') {
          final = {
            status: ev.is_error ? 'error' : 'done',
            result: typeof ev.text === 'string' ? ev.text : null,
            cost: typeof ev.cost === 'number' ? ev.cost : null,
          };
        } else if (ev.kind === 'error' && typeof ev.text === 'string') {
          log += `\n▲ ${ev.text}\n`;
          if (final.status !== 'done') final = { status: 'error', result: ev.text, cost: final.cost };
        }
        flush();
      }
    }
  } catch (error) {
    if (controller.signal.aborted) final = { status: 'stopped', result: 'Остановлено пользователем', cost: final.cost };
    else final = { status: 'error', result: `Ошибка чтения потока: ${(error as Error).message}`, cost: final.cost };
  } finally {
    live.delete(id);
    const current = one<{ status: JobStatus }>('SELECT status FROM workspace_jobs WHERE id = ?', id);
    const status = current?.status === 'stopped' ? 'stopped' : final.status;
    log = log.slice(-200_000);
    run('UPDATE workspace_jobs SET status = ?, log = ?, result = COALESCE(?, result), cost_usd = ?, finished_at = ? WHERE id = ?',
      status, log, final.result, final.cost, new Date().toISOString(), id);

    // Задание могло выпустить альбом или РПЗ — забираем свежую выдачу сразу.
    try {
      syncWorkspace(true);
    } catch (error) {
      console.error('Синхронизация после задания не удалась', error);
    }

    const label = PRESETS.find((p) => p.id === preset)?.label ?? preset;
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    run(
      'INSERT INTO asset_events (id, asset_code, date, severity, title, meta, action, href, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      randomUUID(), project.assetCode, `${p(now.getDate())}.${p(now.getMonth() + 1)}.${now.getFullYear()} ${p(now.getHours())}:${p(now.getMinutes())}`,
      status === 'done' ? 'ok' : status === 'stopped' ? 'offline' : 'warning',
      `Мастерская: «${label}» — ${status === 'done' ? 'выполнено' : status === 'stopped' ? 'остановлено' : 'ошибка'}`,
      `шифр ${project.shifr} · Claude Code`, 'Журнал', `/cabinet/assets/${project.assetCode}/workspace?job=${id}`, -1,
    );
  }
}

export async function stopJob(id: string): Promise<boolean> {
  const job = getJob(id);
  if (!job || job.status !== 'running') return false;

  run("UPDATE workspace_jobs SET status = 'stopped' WHERE id = ?", id);
  const token = claudeWebToken();
  if (job.sessionId && token) {
    try {
      await fetch(`${CLAUDE_WEB_URL}/api/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Token': token },
        body: JSON.stringify({ session_id: job.sessionId }),
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // Обёртка недоступна — оборвём хотя бы свой поток.
    }
  }
  live.get(id)?.abort();
  return true;
}
