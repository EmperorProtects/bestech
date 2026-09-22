/**
 * Коннектор мастерской выпуска чертежей — папки `Documents\newExport`, где Claude
 * Code работает с Revit через RevitBridge и скиллы (normcheck-ar, revit-verify,
 * normcheck, smeta).
 *
 * Мастерская остаётся источником истины для проектной выдачи, портал её не
 * копирует, а читает по соглашению о папках:
 *
 *   01_Исходные данные/ТЗ_<шифр>.md     → объект портала и исходные данные
 *   03_РПЗ/<шифр>_РПЗ.md                → раздел «ПЗ» в документации
 *   04_Чертежи/<шифр>_альбом.pdf        → раздел альбома, листы = страницы PDF
 *   04_Чертежи/<шифр>_альбом.json       → (необязательно) номера и названия листов
 *   05_Модели/<шифр>.rvt                → модель, по ней виден статус работы
 *
 * Шифр — `NNN-ГГГГ-МАРКА`, например `421-2026-ЭП`. Все проекты мастерской —
 * стадия «Проектирование» портала (ЭП, П и Р — её подстадии).
 */

import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { all, one, run, transaction } from '@/db/client';

export const WORKSPACE_DIR = path.resolve(
  process.env.BESTECH_WORKSPACE_DIR ?? path.join(os.homedir(), 'Documents', 'newExport'),
);

export const FOLDERS = {
  inputs: '01_Исходные данные',
  estimates: '02_Сметы',
  rpz: '03_РПЗ',
  drawings: '04_Чертежи',
  models: '05_Модели',
} as const;

const SHIFR_RE = /(\d{3}-\d{4}-[А-ЯЁA-Z]{1,4})/;

/** Путь внутри мастерской или null, если он из неё выходит. */
export function resolveInWorkspace(target: string): string | null {
  const full = path.resolve(WORKSPACE_DIR, target);
  const rel = path.relative(WORKSPACE_DIR, full);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? full : null;
}

export function workspaceAvailable(): boolean {
  return existsSync(path.join(WORKSPACE_DIR, FOLDERS.inputs));
}

function listFiles(folder: string): string[] {
  const dir = path.join(WORKSPACE_DIR, folder);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name);
}

function ruDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function ruDateTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${ruDate(d)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* ── Разбор проекта ──────────────────────────────────────────────────────── */

export interface WorkspaceSheet {
  number: string;
  name: string;
  format: string;
  page: number;
}

export interface WorkspaceProject {
  shifr: string;
  /** Марка комплекта из шифра: ЭП, АР, КЖ… */
  mark: string;
  title: string;
  shortTitle: string;
  stageLabel: string;
  place: string;
  customer: string;
  tzPath: string | null;
  rpzPath: string | null;
  modelPath: string | null;
  modelMtime: Date | null;
  albumPath: string | null;
  albumMtime: Date | null;
  sheets: WorkspaceSheet[];
  /** Файлы исходных данных этого шифра (имя содержит шифр). */
  inputs: string[];
}

/** Поле ТЗ вида `**Объект:** значение` или `- Объект: значение`. */
function field(md: string, ...names: string[]): string | null {
  for (const name of names) {
    const re = new RegExp(`^(?:[-*]\\s*)?(?:\\*\\*)?${name}(?:\\*\\*)?\\s*:\\s*(?:\\*\\*)?\\s*(.+)$`, 'im');
    const m = md.match(re);
    if (m?.[1]) return m[1].replace(/\*\*/g, '').replace(/\s+$/, '').trim();
  }
  return null;
}

/**
 * Значение поля ТЗ для карточки: первое предложение без хвостовой точки.
 * Заглавная буква ставится только слову («индивидуальный» → «Индивидуальный»),
 * сокращения вроде «г. Астана» не трогаем. Пояснения в скобках убираются по запросу:
 * у места строительства это шум, у стадии — расшифровка, её оставляем.
 */
function tidy(value: string, dropParens = false): string {
  // Конец предложения — точка после слова от трёх букв или скобки: «г. Астана» не режем.
  let v = value.replace(/(?<=[а-яёa-z]{3}|\))\.\s+(?=[А-ЯЁA-Z])[\s\S]*$/i, '');
  if (dropParens) v = v.replace(/\s*\([^)]*\)/g, '');
  v = v.replace(/\s+([.,;])/g, '$1').replace(/[.;,\s]+$/, '').trim();
  return /^[а-яё]{2,}/.test(v) ? v[0]!.toLocaleUpperCase('ru') + v.slice(1) : v;
}

/** Число страниц PDF без библиотек: объекты /Type /Page, иначе /Count корня. */
export function pdfPageCount(file: string): number {
  const text = readFileSync(file).toString('latin1');
  const pages = text.match(/\/Type\s*\/Page(?![s\w])/g)?.length ?? 0;
  if (pages > 0) return pages;
  const counts = Array.from(text.matchAll(/\/Count\s+(\d+)/g)).map((m) => Number(m[1]));
  return counts.length ? Math.max(...counts) : 0;
}

function readManifest(file: string): WorkspaceSheet[] | null {
  if (!existsSync(file)) return null;
  try {
    const data = JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, '')) as {
      sheets?: { number?: string | number; name?: string; format?: string }[];
    };
    if (!Array.isArray(data.sheets)) return null;
    return data.sheets.map((s, i) => ({
      number: String(s.number ?? i + 1),
      name: s.name?.trim() || `Лист ${i + 1}`,
      format: s.format?.trim() || 'А3',
      page: i + 1,
    }));
  } catch {
    return null;
  }
}

function modelFile(shifr: string): string | null {
  // Revit рядом кладёт резервные копии <шифр>.0016.rvt — берём основной файл.
  const name = `${shifr}.rvt`;
  return listFiles(FOLDERS.models).includes(name) ? path.join(FOLDERS.models, name) : null;
}

function readProject(shifr: string): WorkspaceProject {
  const mark = shifr.split('-').pop() ?? '';
  const inputs = listFiles(FOLDERS.inputs).filter((f) => f.includes(shifr));
  const tzName = inputs.find((f) => /^ТЗ/i.test(f) && f.endsWith('.md')) ?? null;
  const tzPath = tzName ? path.join(FOLDERS.inputs, tzName) : null;
  const md = tzPath ? readFileSync(path.join(WORKSPACE_DIR, tzPath), 'utf8') : '';

  const heading = md.match(/^#\s+(.+)$/m)?.[1]?.replace(/\s*[—-]\s*$/, '') ?? '';
  // Заголовок «ТЗ — Индивидуальный жилой дом. Шифр …» точнее короткого поля «Объект».
  const fromHeading = heading.replace(/^ТЗ(\s+на\s+[^—-]+)?\s*[—-]\s*/i, '').replace(/\.?\s*Шифр.*$/i, '').trim();
  const fromField = field(md, 'Объект');
  const title = tidy((fromField && fromField.length > fromHeading.length ? fromField : fromHeading) || fromField || shifr);
  const stage = tidy(field(md, 'Стадия') ?? mark);
  const place = tidy(field(md, 'Место строительства', 'Район строительства') ?? 'Республика Казахстан', true);

  const rpzName = listFiles(FOLDERS.rpz).find((f) => f.includes(shifr) && f.endsWith('.md')) ?? null;
  const modelPath = modelFile(shifr);
  const albumName = listFiles(FOLDERS.drawings).find((f) => f.includes(shifr) && f.toLowerCase().endsWith('.pdf')) ?? null;
  const albumPath = albumName ? path.join(FOLDERS.drawings, albumName) : null;

  let sheets: WorkspaceSheet[] = [];
  if (albumPath) {
    const abs = path.join(WORKSPACE_DIR, albumPath);
    const manifest = readManifest(abs.replace(/\.pdf$/i, '.json'));
    const pages = pdfPageCount(abs);
    sheets =
      manifest?.slice(0, pages || undefined) ??
      Array.from({ length: pages }, (_, i) => ({ number: String(i + 1), name: `Лист ${i + 1}`, format: 'А3', page: i + 1 }));
  }

  const shortTitle = title.split(/[,.(]/)[0]!.trim().slice(0, 40);

  return {
    shifr,
    mark,
    title: title || shifr,
    shortTitle: shortTitle || shifr,
    stageLabel: stage,
    place,
    customer: field(md, 'Заказчик') ?? '—',
    tzPath,
    rpzPath: rpzName ? path.join(FOLDERS.rpz, rpzName) : null,
    modelPath,
    modelMtime: modelPath ? statSync(path.join(WORKSPACE_DIR, modelPath)).mtime : null,
    albumPath,
    albumMtime: albumPath ? statSync(path.join(WORKSPACE_DIR, albumPath)).mtime : null,
    sheets,
    inputs,
  };
}

/** Все шифры мастерской: по ТЗ, моделям и альбомам. */
export function scanWorkspace(): WorkspaceProject[] {
  if (!workspaceAvailable()) return [];
  const shifrs = new Set<string>();
  for (const folder of [FOLDERS.inputs, FOLDERS.models, FOLDERS.drawings]) {
    for (const f of listFiles(folder)) {
      const m = f.match(SHIFR_RE);
      if (m?.[1]) shifrs.add(m[1]);
    }
  }
  return Array.from(shifrs).sort().map(readProject);
}

/* ── Статус инструментов ─────────────────────────────────────────────────── */

export interface BridgeStatus {
  dir: string;
  present: boolean;
  alive: boolean;
  pid: number | null;
  revitVersion: string | null;
  startedAt: string | null;
}

/** RevitBridge: живой ли Revit, который держит bridge.lock. */
export function revitBridgeStatus(): BridgeStatus {
  const dir = path.resolve(process.env.BESTECH_REVIT_BRIDGE_DIR ?? path.join(os.homedir(), 'Documents', 'RevitBridge'));
  const status: BridgeStatus = { dir, present: existsSync(dir), alive: false, pid: null, revitVersion: null, startedAt: null };
  const lock = path.join(dir, 'bridge.lock');
  if (!existsSync(lock)) return status;

  try {
    const owner = JSON.parse(readFileSync(lock, 'utf8').replace(/^﻿/, '')) as {
      pid?: number;
      revit_version?: string;
      started_at_utc?: string;
    };
    status.pid = Number(owner.pid) || null;
    status.revitVersion = owner.revit_version ?? null;
    status.startedAt = owner.started_at_utc ?? null;
    if (status.pid) {
      try {
        process.kill(status.pid, 0);
        status.alive = true;
      } catch (error) {
        // EPERM — процесс есть, но чужой: для нас это «жив».
        status.alive = (error as NodeJS.ErrnoException).code === 'EPERM';
      }
    }
  } catch {
    status.alive = false;
  }
  return status;
}

/* ── Синхронизация с БД портала ──────────────────────────────────────────── */

/** Организация, в которую попадают проекты мастерской. */
function workspaceOrgId(): string | null {
  const configured = process.env.BESTECH_WORKSPACE_ORG;
  if (configured) return one<{ id: string }>('SELECT id FROM organizations WHERE id = ?', configured)?.id ?? null;
  return one<{ id: string }>('SELECT id FROM organizations ORDER BY created_at LIMIT 1')?.id ?? null;
}

const SYNC_INTERVAL_MS = 10_000;
const syncState = ((globalThis as { __bestechWorkspaceSync?: { at: number } }).__bestechWorkspaceSync ??= { at: 0 });

/** Регистрирует файл мастерской в таблице files (или обновляет размер). */
function upsertExternalFile(assetCode: string, relPath: string, kind: 'input' | 'sheet' | 'other'): string {
  const existing = one<{ id: string }>('SELECT id FROM files WHERE external_path = ?', relPath);
  const abs = path.join(WORKSPACE_DIR, relPath);
  const st = statSync(abs);
  if (existing) {
    run('UPDATE files SET size = ?, uploaded_at = ?, asset_code = ? WHERE id = ?', st.size, st.mtime.toISOString(), assetCode, existing.id);
    return existing.id;
  }
  const id = randomUUID();
  run(
    `INSERT INTO files (id, asset_code, kind, original_name, stored_name, size, mime, uploaded_by, uploaded_at, external_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    id,
    assetCode,
    kind,
    path.basename(relPath),
    path.basename(relPath),
    st.size,
    'application/octet-stream',
    st.mtime.toISOString(),
    relPath,
  );
  return id;
}

function syncProject(p: WorkspaceProject, orgId: string): void {
  const code = p.shifr;
  const exists = one<{ code: string }>('SELECT code FROM assets WHERE code = ?', code);
  const updated = ruDateTime(p.albumMtime ?? p.modelMtime ?? new Date());
  const phases = p.albumPath ? null : readPhases(p.shifr);
  const sectionsLabel = p.albumPath
    ? `альбом ${p.mark}: ${p.sheets.length} л.`
    : phases
      ? `этапы: ${phases.filter((x) => x.status === 'done').length} из ${phases.length}`
      : 'альбом не выпущен';

  if (exists) {
    run(
      `UPDATE assets SET name = ?, short_name = ?, region = ?, address = ?, capacity = ?, contract = ?, updated = ?, sections_label = ?
        WHERE code = ?`,
      p.title, p.shortTitle, p.place, p.place, `стадия ${p.stageLabel}`, `заказчик: ${p.customer}`, updated, sectionsLabel, code,
    );
  } else {
    run(
      `INSERT INTO assets (
         code, org_id, name, short_name, region, address, stage, chief, area, capacity, contract, updated,
         progress, planned_progress, figure, sections_label, deadline_date, deadline_note,
         remarks_count, remarks_label, remarks_note, remarks_state,
         sensors_online, sensors_total, sensors_note, sensors_state, map_x, map_y, has_twin
       ) VALUES (?, ?, ?, ?, ?, ?, 'design', ?, '—', ?, ?, ?, 0, 0, 'barn', ?, ?, ?, 0, 'нет', 'нормоконтроль в мастерской', 'ok',
                 0, 0, 'стадия «Строительство»', 'offline', ?, ?, 0)`,
      code, orgId, p.title, p.shortTitle, p.place, p.place,
      'Сагинтаев Е.', `стадия ${p.stageLabel}`, `заказчик: ${p.customer}`, updated, sectionsLabel,
      ruDate(new Date()), 'мастерская newExport', 0.3 + Math.random() * 0.4, 0.3 + Math.random() * 0.4,
    );
    run(
      'INSERT INTO asset_events (id, asset_code, date, severity, title, meta, action, href, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      randomUUID(), code, ruDateTime(new Date()), 'info', `Проект подключён из мастерской выпуска чертежей`,
      `${WORKSPACE_DIR} · шифр ${code}`, 'Мастерская', `/cabinet/assets/${code}/workspace`, 0,
    );
  }

  run(
    `INSERT INTO workspace_projects (shifr, asset_code, title, stage_mark, model_path, album_path, album_mtime, rpz_path, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(shifr) DO UPDATE SET title = excluded.title, stage_mark = excluded.stage_mark, model_path = excluded.model_path,
       album_path = excluded.album_path, album_mtime = excluded.album_mtime, rpz_path = excluded.rpz_path, synced_at = excluded.synced_at`,
    p.shifr, code, p.title, p.mark, p.modelPath, p.albumPath, p.albumMtime?.toISOString() ?? null, p.rpzPath, new Date().toISOString(),
  );

  // Исходные данные: каждый файл шифра — строка ведомости, ТЗ сразу «принято».
  p.inputs.forEach((name, i) => {
    const rel = path.join(FOLDERS.inputs, name);
    const fileId = upsertExternalFile(code, rel, 'input');
    const row = one<{ id: string }>('SELECT id FROM input_docs WHERE file_id = ?', fileId);
    if (row) return;
    const isTz = /^ТЗ/i.test(name);
    run(
      'INSERT INTO input_docs (id, asset_code, code, title, file_id, file_name, date, state, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      randomUUID(), code, isTz ? 'ЗАД' : 'ИД', isTz ? 'Техническое задание' : 'Исходные данные мастерской', fileId, name,
      ruDate(statSync(path.join(WORKSPACE_DIR, rel)).mtime), isTz ? 'accepted' : 'review', 100 + i,
    );
  });

  const docs = one<{ total: number; ready: number }>(
    `SELECT COUNT(*) AS total, SUM(CASE WHEN state IN ('accepted','review') THEN 1 ELSE 0 END) AS ready FROM input_docs WHERE asset_code = ?`,
    code,
  );
  const percent = Number(docs?.total) ? Math.round((Number(docs?.ready) / Number(docs?.total)) * 100) : 0;
  run('INSERT INTO completeness (asset_code, percent) VALUES (?, ?) ON CONFLICT(asset_code) DO UPDATE SET percent = excluded.percent', code, percent);

  // Альбом: раздел с маркой комплекта, листы = страницы PDF.
  const sectionId = `${code}:${p.mark}`;
  if (p.albumPath) {
    const albumId = upsertExternalFile(code, p.albumPath, 'sheet');
    const issued = p.albumMtime ? ruDate(p.albumMtime) : null;
    run(
      `INSERT INTO doc_sections (id, asset_code, code, name, sheets_count, version, author, status, remarks_count, issued, sort)
       VALUES (?, ?, ?, ?, ?, 1, ?, 'review', 0, ?, 0)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, sheets_count = excluded.sheets_count, issued = excluded.issued`,
      sectionId, code, p.mark, p.stageLabel.startsWith(p.mark) ? `Альбом ${p.stageLabel}` : `Альбом ${p.mark} · ${p.stageLabel}`,
      p.sheets.length, 'Claude · мастерская', issued,
    );

    const keep = new Set<string>();
    p.sheets.forEach((s) => {
      const sheetCode = `${p.mark}-${s.number}`;
      keep.add(sheetCode);
      run(
        `INSERT INTO doc_sheets (id, section_id, asset_code, code, name, format, version, changed, file_id, sort)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, format = excluded.format, changed = excluded.changed,
           file_id = excluded.file_id, sort = excluded.sort`,
        `${code}:${sheetCode}`, sectionId, code, sheetCode, s.name, s.format, issued ?? ruDate(new Date()), albumId, s.page - 1,
      );
    });
    // Листы, которых больше нет в альбоме, убираем — альбом перевыпущен короче.
    for (const r of all<{ id: string; code: string }>('SELECT id, code FROM doc_sheets WHERE section_id = ?', sectionId)) {
      if (!keep.has(r.code)) run('DELETE FROM doc_sheets WHERE id = ?', r.id);
    }
  }

  // РПЗ — отдельный раздел с одним документом.
  if (p.rpzPath) {
    const rpzId = upsertExternalFile(code, p.rpzPath, 'other');
    const mtime = ruDate(statSync(path.join(WORKSPACE_DIR, p.rpzPath)).mtime);
    run(
      `INSERT INTO doc_sections (id, asset_code, code, name, sheets_count, version, author, status, remarks_count, issued, sort)
       VALUES (?, ?, 'ПЗ', 'Расчётно-пояснительная записка', 1, 1, 'Claude · мастерская', 'review', 0, ?, 1)
       ON CONFLICT(id) DO UPDATE SET issued = excluded.issued`,
      `${code}:ПЗ`, code, mtime,
    );
    run(
      `INSERT INTO doc_sheets (id, section_id, asset_code, code, name, format, version, changed, file_id, sort)
       VALUES (?, ?, ?, 'ПЗ-1', 'Расчётно-пояснительная записка', 'А4', 1, ?, ?, 0)
       ON CONFLICT(id) DO UPDATE SET changed = excluded.changed, file_id = excluded.file_id`,
      `${code}:ПЗ-1`, `${code}:ПЗ`, code, mtime, rpzId,
    );
  }
}

export interface SyncResult {
  available: boolean;
  projects: number;
  skipped: boolean;
}

/**
 * Переносит состояние мастерской в БД. Идемпотентна и дешёвая (только stat и
 * чтение ТЗ), поэтому вызывается при открытии страниц; чаще раза в 10 секунд
 * диск не трогаем, если не попросили явно.
 */
export function syncWorkspace(force = false): SyncResult {
  if (!workspaceAvailable()) return { available: false, projects: 0, skipped: false };
  if (!force && Date.now() - syncState.at < SYNC_INTERVAL_MS) return { available: true, projects: 0, skipped: true };

  const orgId = workspaceOrgId();
  if (!orgId) return { available: true, projects: 0, skipped: true };

  const projects = scanWorkspace();
  transaction(() => {
    for (const p of projects) syncProject(p, orgId);
  });
  syncState.at = Date.now();
  return { available: true, projects: projects.length, skipped: false };
}

export interface LinkedProject {
  shifr: string;
  assetCode: string;
  title: string;
  stageMark: string;
  modelPath: string | null;
  albumPath: string | null;
  albumMtime: string | null;
  rpzPath: string | null;
  syncedAt: string;
}

export function getLinkedProject(assetCode: string): LinkedProject | undefined {
  const r = one<{
    shifr: string; asset_code: string; title: string; stage_mark: string; model_path: string | null;
    album_path: string | null; album_mtime: string | null; rpz_path: string | null; synced_at: string;
  }>('SELECT * FROM workspace_projects WHERE asset_code = ?', assetCode);
  if (!r) return undefined;
  return {
    shifr: r.shifr, assetCode: r.asset_code, title: r.title, stageMark: r.stage_mark, modelPath: r.model_path,
    albumPath: r.album_path, albumMtime: r.album_mtime, rpzPath: r.rpz_path, syncedAt: r.synced_at,
  };
}

/** Кладёт загруженный в портал файл в «01_Исходные данные» мастерской, чтобы его видел Claude. */
export function inputFileName(shifr: string, original: string): string {
  const safe = path.basename(original.replace(/\\/g, '/')).replace(/[<>:"|?*\x00-\x1f]/g, '_').trim() || 'file';
  return safe.includes(shifr) ? safe : `${shifr}_${safe}`;
}

export function uniqueInputPath(name: string): string {
  const dir = path.join(WORKSPACE_DIR, FOLDERS.inputs);
  const ext = path.extname(name);
  const stem = name.slice(0, name.length - ext.length);
  let candidate = name;
  for (let i = 1; existsSync(path.join(dir, candidate)); i += 1) candidate = `${stem} (${i})${ext}`;
  return path.join(FOLDERS.inputs, candidate);
}

export function modelInfo(relPath: string | null): { size: number; mtime: string } | null {
  if (!relPath) return null;
  const abs = resolveInWorkspace(relPath);
  if (!abs || !existsSync(abs)) return null;
  const st = statSync(abs);
  return { size: st.size, mtime: ruDateTime(st.mtime) };
}

/* ── Новый проект по ТЗ ──────────────────────────────────────────────────── */

/** Шифр целиком: номер-год-марка, марка кириллицей или латиницей. */
export const SHIFR_STRICT = /^\d{3}-\d{4}-[А-ЯЁA-Z]{1,4}$/;

/**
 * Шаблон АР по умолчанию — тот же, что назначен в newExport\CLAUDE.md.
 * Берём копию, обновлённую в Revit 2026: исходный r2021 при new_project через мост
 * запускает обновление, окно обновления из API не создаётся, и Revit падает.
 */
const AR_TEMPLATE_DIR = path.join(os.homedir(), 'Documents', 'EngPro_Revit_BIM2B_Шаблоны', 'adsk_ru_shablonproekta_ar_r2021_v2.2.3');
const AR_TEMPLATE_2026 = path.join(AR_TEMPLATE_DIR, 'ADSK_RU_Шаблон_АР_BIM2B_r2026_v2.2.3.rte');
export const AR_TEMPLATE =
  process.env.BESTECH_AR_TEMPLATE ??
  (existsSync(AR_TEMPLATE_2026) ? AR_TEMPLATE_2026 : path.join(AR_TEMPLATE_DIR, 'ADSK_RU_Шаблон_АР_BIM2B_r2021_v2.2.3.rte'));

/**
 * Этапы проекта по регламенту (конвейер §2.1): модель → геометрия → помещения →
 * normcheck-ar → оформление → листы → альбом. Claude отмечает их в
 * `05_Модели\<шифр>_этапы.json`, портал по файлу показывает ход работы, а
 * следующее задание продолжает с первого незакрытого этапа.
 */
export const PROJECT_PHASES = [
  { id: 'model', label: 'Модель из шаблона', note: 'файл .rvt, сведения о проекте, уровни, типы' },
  { id: 'geometry', label: 'Геометрия', note: 'оси, стены, перекрытия, кровля' },
  { id: 'openings', label: 'Проёмы', note: 'окна, двери, ворота' },
  { id: 'rooms', label: 'Помещения', note: 'помещения, площади, экспликация' },
  { id: 'normcheck-ar', label: 'Нормоконтроль планировки', note: 'скилл normcheck-ar, правки на месте' },
  { id: 'annotation', label: 'Оформление', note: 'марки, размеры, отметки, разрезы, фасады' },
  { id: 'sheets', label: 'Листы', note: 'листы и спецификации; revit-verify и normcheck' },
  { id: 'album', label: 'Альбом и РПЗ', note: 'PDF и манифест в 04_Чертежи, РПЗ в 03_РПЗ' },
] as const;

export type PhaseStatus = 'todo' | 'in_progress' | 'done' | 'blocked';

export interface ProjectPhase {
  id: string;
  label: string;
  note: string;
  status: PhaseStatus;
  comment: string | null;
  updated: string | null;
}

export function phasesFileRel(shifr: string): string {
  return path.join(FOLDERS.models, `${shifr}_этапы.json`);
}

/**
 * Этапы проекта. null — файла этапов нет, а модель есть: проект собран раньше
 * без этого соглашения (как 421), ход работы по этапам не показываем.
 */
export function readPhases(shifr: string): ProjectPhase[] | null {
  const file = path.join(WORKSPACE_DIR, phasesFileRel(shifr));
  let saved: Record<string, { status?: string; note?: string; updated?: string }> = {};

  if (existsSync(file)) {
    try {
      const data = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) as { phases?: typeof saved };
      saved = data.phases ?? {};
    } catch {
      saved = {};
    }
  } else if (modelFile(shifr)) {
    return null;
  }

  const statuses: PhaseStatus[] = ['todo', 'in_progress', 'done', 'blocked'];
  return PROJECT_PHASES.map((ph) => {
    const entry = saved[ph.id];
    const status = statuses.includes(entry?.status as PhaseStatus) ? (entry!.status as PhaseStatus) : 'todo';
    return { id: ph.id, label: ph.label, note: ph.note, status, comment: entry?.note ?? null, updated: entry?.updated ?? null };
  });
}

/** Все шифры, упомянутые в папках мастерской. */
function knownShifrs(): string[] {
  const set = new Set<string>();
  for (const folder of Object.values(FOLDERS)) {
    for (const f of listFiles(folder)) {
      const m = f.match(SHIFR_RE);
      if (m?.[1]) set.add(m[1]);
    }
  }
  return Array.from(set);
}

/** Шифр уже занят файлами мастерской — повторно не заводим. */
export function shifrTaken(shifr: string): boolean {
  return knownShifrs().includes(shifr);
}

/** Следующий порядковый номер: наибольший номер мастерской + 1. */
export function nextProjectNumber(): string {
  const numbers = knownShifrs().map((s) => Number(s.slice(0, 3))).filter(Number.isFinite);
  return String((numbers.length ? Math.max(...numbers) : 0) + 1).padStart(3, '0');
}

export interface NewProjectInput {
  shifr: string;
  object: string;
  stage: string;
  place: string;
  customer: string;
  brief: string;
  author: string;
  attachment: { name: string; bytes: Buffer } | null;
}

const oneLine = (v: string) => v.replace(/\s+/g, ' ').trim();

/**
 * Пишет ТЗ проекта в «01_Исходные данные». Поля шапки совпадают с теми, что
 * читает readProject, поэтому объект появляется в кабинете с нормальным
 * названием сразу после синхронизации. Текстовое ТЗ (.md/.txt) встраивается,
 * PDF и DOCX кладутся рядом с шифром в имени — Claude прочитает их сам.
 */
export function createProjectFiles(input: NewProjectInput): { tzPath: string; attachmentPath: string | null } {
  if (!SHIFR_STRICT.test(input.shifr)) throw new Error('Шифр должен быть вида 422-2026-АР');
  if (shifrTaken(input.shifr)) throw new Error(`Шифр ${input.shifr} уже есть в мастерской`);

  let attachmentPath: string | null = null;
  let embedded = '';

  if (input.attachment) {
    const ext = path.extname(input.attachment.name).toLowerCase();
    if (ext === '.md' || ext === '.txt') {
      embedded = input.attachment.bytes.toString('utf8').replace(/^\uFEFF/, '');
    } else {
      attachmentPath = path.join(FOLDERS.inputs, `ТЗ_${input.shifr}_исходник${ext}`);
      writeFileSync(path.join(WORKSPACE_DIR, attachmentPath), input.attachment.bytes, { flag: 'wx' });
    }
  }

  const object = oneLine(input.object) || input.shifr;
  const today = new Date();
  const p2 = (n: number) => String(n).padStart(2, '0');

  const md = [
    `# ТЗ — ${object}. Шифр ${input.shifr}`,
    '',
    `**Шифр:** ${input.shifr}`,
    `**Объект:** ${object}`,
    `**Стадия:** ${oneLine(input.stage)}`,
    `**Место строительства:** ${oneLine(input.place) || 'Республика Казахстан'}`,
    `**Заказчик:** ${oneLine(input.customer) || '—'}`,
    `**Модель:** \`Documents\\newExport\\${FOLDERS.models}\\${input.shifr}.rvt\``,
    `**Создано:** ${p2(today.getDate())}.${p2(today.getMonth() + 1)}.${today.getFullYear()} в портале BESTECH, ${oneLine(input.author)}`,
    '',
    '## Задание',
    '',
    input.brief.trim() || 'Состав и параметры — в приложенном файле ТЗ.',
    ...(embedded ? ['', '## Текст ТЗ заказчика', '', embedded.trim()] : []),
    ...(attachmentPath ? ['', `Полный текст ТЗ заказчика — \`${path.basename(attachmentPath)}\` в этой папке.`] : []),
    '',
    '## Порядок и приёмка',
    '',
    'Конвейер — регламент §2.1: модель → геометрия → помещения → **normcheck-ar** → оформление → листы → альбом.',
    `Нормоконтроль после каждой фазы. Ход работы — в \`${phasesFileRel(input.shifr)}\`.`,
    '',
  ].join('\n');

  const tzPath = path.join(FOLDERS.inputs, `ТЗ_${input.shifr}.md`);
  writeFileSync(path.join(WORKSPACE_DIR, tzPath), md, { encoding: 'utf8', flag: 'wx' });
  return { tzPath, attachmentPath };
}
