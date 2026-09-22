/**
 * Слой доступа к данным. Читает SQLite через `db/client` — фикстуры остались
 * только как источник для первичного засева (`db/seed`) и для разделов
 * двойника, которые закрыты флагом стадии «Строительство».
 *
 * Подписи функций совпадают с будущими REST-эндпоинтами, чтобы вынос данных в
 * отдельный сервис не затрагивал разметку:
 *
 *   getAssets(orgId)              → GET /api/assets
 *   getAsset(code, orgId)         → GET /api/assets/:code
 *   getAssetEvents(code)          → GET /api/assets/:code/events
 *   getInputDocs(code)            → GET /api/assets/:code/inputs
 *   getCompleteness(code)         → GET /api/assets/:code/inputs/completeness
 *   getDocSections(code)          → GET /api/assets/:code/documents
 *   getDocSheets(code, section?)  → GET /api/assets/:code/documents/sheets
 *   getSheet(code, sheetCode)     → GET /api/assets/:code/documents/sheets/:sheet
 *   getSheetRemarks(sheetId)      → GET /api/sheets/:id/remarks
 *   getTwinSummary(code)          → GET /api/twin/:code/summary        (закрыто флагом)
 *
 * Все выборки по объектам ограничены организацией пользователя: чужой шифр в
 * адресе даёт 404, а не чужие данные.
 */

import { all, one } from '@/db/client';
import twin from './fixtures/twin.json';
import type {
  Asset,
  AssetEvent,
  AssetMetrics,
  Completeness,
  Deviation,
  DocSection,
  DocSheet,
  InputDoc,
  Organization,
  RemarkMessage,
  Sensor,
  SheetRemark,
  StoredFile,
  TelemetryChart,
  ToleranceState,
  TwinSummary,
} from './types';

/* ── Организация ─────────────────────────────────────────────────────────── */

export function getOrganization(orgId: string): Organization | undefined {
  return one<Organization>('SELECT id, name, bin FROM organizations WHERE id = ?', orgId);
}

/* ── Объекты ─────────────────────────────────────────────────────────────── */

interface AssetRow {
  code: string;
  name: string;
  short_name: string;
  region: string;
  address: string;
  stage: Asset['stage'];
  chief: string;
  area: string;
  capacity: string;
  contract: string;
  updated: string;
  progress: number;
  planned_progress: number;
  figure: Asset['figure'];
  sections_label: string;
  deadline_date: string;
  deadline_note: string;
  remarks_count: number;
  remarks_label: string;
  remarks_note: string;
  remarks_state: ToleranceState;
  sensors_online: number;
  sensors_total: number;
  sensors_note: string;
  sensors_state: ToleranceState;
  alarm_title: string | null;
  alarm_note: string | null;
  map_x: number;
  map_y: number;
  has_twin: number;
}

function toAsset(r: AssetRow): Asset {
  return {
    code: r.code,
    name: r.name,
    shortName: r.short_name,
    region: r.region,
    address: r.address,
    stage: r.stage,
    chief: r.chief,
    area: r.area,
    capacity: r.capacity,
    contract: r.contract,
    updated: r.updated,
    progress: Number(r.progress),
    plannedProgress: Number(r.planned_progress),
    figure: r.figure,
    sectionsLabel: r.sections_label,
    deadline: { date: r.deadline_date, note: r.deadline_note },
    remarks: { count: Number(r.remarks_count), label: r.remarks_label, note: r.remarks_note, state: r.remarks_state },
    sensors: { online: Number(r.sensors_online), total: Number(r.sensors_total), note: r.sensors_note, state: r.sensors_state },
    ...(r.alarm_title ? { alarm: { title: r.alarm_title, note: r.alarm_note ?? '' } } : {}),
    map: { x: Number(r.map_x), y: Number(r.map_y) },
    hasTwin: Number(r.has_twin) === 1,
  };
}

const ASSET_COLUMNS = 'code, name, short_name, region, address, stage, chief, area, capacity, contract, updated, progress, planned_progress, figure, sections_label, deadline_date, deadline_note, remarks_count, remarks_label, remarks_note, remarks_state, sensors_online, sensors_total, sensors_note, sensors_state, alarm_title, alarm_note, map_x, map_y, has_twin';

export async function getAssets(orgId: string): Promise<Asset[]> {
  return all<AssetRow>(`SELECT ${ASSET_COLUMNS} FROM assets WHERE org_id = ? ORDER BY code DESC`, orgId).map(toAsset);
}

/**
 * Шифр из сегмента маршрута. Next отдаёт params в процентной кодировке, пока в
 * шифре только ASCII это незаметно, но у проектов мастерской марка кириллицей
 * (`421-2026-ЭП` приходит как `421-2026-%D0%AD%D0%9F`).
 */
export function normalizeCode(code: string): string {
  if (!code.includes('%')) return code;
  try {
    return decodeURIComponent(code);
  } catch {
    return code;
  }
}

export async function getAsset(code: string, orgId: string): Promise<Asset | undefined> {
  const row = one<AssetRow>(`SELECT ${ASSET_COLUMNS} FROM assets WHERE code = ? AND org_id = ?`, normalizeCode(code), orgId);
  return row ? toAsset(row) : undefined;
}

interface MetricsRow {
  deviations_total: number;
  deviations_alarm: number;
  deviations_warning: number;
  deviations_parameters: number;
  remarks_open_count: number;
  remarks_open_sheets: string;
  remarks_open_due: string;
}

export async function getAssetMetrics(code: string): Promise<AssetMetrics | undefined> {
  const r = one<MetricsRow>(
    `SELECT deviations_total, deviations_alarm, deviations_warning, deviations_parameters,
            remarks_open_count, remarks_open_sheets, remarks_open_due
       FROM asset_metrics WHERE asset_code = ?`,
    code,
  );
  if (!r) return undefined;
  return {
    deviations: {
      total: Number(r.deviations_total),
      alarm: Number(r.deviations_alarm),
      warning: Number(r.deviations_warning),
      parameters: Number(r.deviations_parameters),
    },
    remarksOpen: { count: Number(r.remarks_open_count), sheets: r.remarks_open_sheets, due: r.remarks_open_due },
  };
}

export async function getAssetEvents(code: string): Promise<AssetEvent[]> {
  return all<AssetEvent & { action: string | null; href: string | null }>(
    'SELECT id, date, severity, title, meta, action, href FROM asset_events WHERE asset_code = ? ORDER BY sort',
    code,
  ).map((e) => ({
    id: e.id,
    date: e.date,
    severity: e.severity,
    title: e.title,
    meta: e.meta,
    ...(e.action ? { action: e.action } : {}),
    ...(e.href ? { href: e.href } : {}),
  }));
}

/* ── Исходные данные ─────────────────────────────────────────────────────── */

interface InputRow {
  id: string;
  code: string;
  title: string;
  file_id: string | null;
  file_name: string | null;
  date: string | null;
  state: InputDoc['state'];
}

export async function getInputDocs(code: string): Promise<InputDoc[]> {
  return all<InputRow>(
    'SELECT id, code, title, file_id, file_name, date, state FROM input_docs WHERE asset_code = ? ORDER BY sort',
    code,
  ).map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    file: r.file_name,
    fileId: r.file_id,
    date: r.date,
    state: r.state,
  }));
}

export async function getCompleteness(code: string): Promise<Completeness | undefined> {
  const head = one<{ percent: number }>('SELECT percent FROM completeness WHERE asset_code = ?', code);
  if (!head) return undefined;

  const missing = all<{ id: string; severity: ToleranceState; title: string; note: string }>(
    'SELECT id, severity, title, note FROM completeness_items WHERE asset_code = ? ORDER BY sort',
    code,
  );
  return { percent: Number(head.percent), missing };
}

/**
 * Пересчёт комплектности: доля принятых и проверяемых документов в общем
 * количестве. Раньше значение было статичным в фикстуре, теперь оно меняется
 * после каждой загрузки файла.
 */
export function recalcCompleteness(code: string): number {
  const row = one<{ total: number; ready: number }>(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN state IN ('accepted', 'review') THEN 1 ELSE 0 END) AS ready
       FROM input_docs WHERE asset_code = ?`,
    code,
  );
  const total = Number(row?.total ?? 0);
  if (total === 0) return 0;
  return Math.round((Number(row?.ready ?? 0) / total) * 100);
}

/* ── Документация и чертежи ──────────────────────────────────────────────── */

interface SectionRow {
  id: string;
  code: string;
  name: string;
  sheets_count: number;
  version: number;
  author: string;
  status: DocSection['status'];
  remarks_count: number;
  issued: string | null;
  available: number;
}

export async function getDocSections(code: string): Promise<DocSection[]> {
  return all<SectionRow>(
    `SELECT s.id, s.code, s.name, s.sheets_count, s.version, s.author, s.status, s.remarks_count, s.issued,
            (SELECT COUNT(*) FROM doc_sheets d WHERE d.section_id = s.id) AS available
       FROM doc_sections s
      WHERE s.asset_code = ?
      ORDER BY s.sort`,
    code,
  ).map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    sheetsCount: Number(r.sheets_count),
    version: Number(r.version),
    author: r.author,
    status: r.status,
    remarksCount: Number(r.remarks_count),
    issued: r.issued,
    availableSheets: Number(r.available),
  }));
}

interface SheetRow {
  id: string;
  section_id: string;
  section_code: string;
  section_author: string;
  asset_code: string;
  code: string;
  name: string;
  format: string;
  version: number;
  changed: string;
  file_id: string | null;
  file_name: string | null;
  open_remarks: number;
  sort: number;
}

const SHEET_SELECT = `
  SELECT d.id, d.section_id, sec.code AS section_code, sec.author AS section_author,
         d.asset_code, d.code, d.name, d.format, d.version, d.changed, d.sort,
         d.file_id, f.original_name AS file_name,
         (SELECT COUNT(*) FROM sheet_remarks r WHERE r.sheet_id = d.id AND r.status = 'open') AS open_remarks
    FROM doc_sheets d
    JOIN doc_sections sec ON sec.id = d.section_id
    LEFT JOIN files f ON f.id = d.file_id`;

function toSheet(r: SheetRow): DocSheet {
  return {
    id: r.id,
    sectionId: r.section_id,
    sectionCode: r.section_code,
    sectionAuthor: r.section_author,
    assetCode: r.asset_code,
    code: r.code,
    name: r.name,
    format: r.format,
    version: Number(r.version),
    changed: r.changed,
    fileId: r.file_id,
    fileName: r.file_name,
    openRemarks: Number(r.open_remarks),
    position: Number(r.sort) + 1,
  };
}

/** Листы объекта: все или только выбранного раздела. */
export async function getDocSheets(assetCode: string, sectionCode?: string): Promise<DocSheet[]> {
  const rows = sectionCode
    ? all<SheetRow>(`${SHEET_SELECT} WHERE d.asset_code = ? AND sec.code = ? ORDER BY sec.sort, d.sort`, assetCode, sectionCode)
    : all<SheetRow>(`${SHEET_SELECT} WHERE d.asset_code = ? ORDER BY sec.sort, d.sort`, assetCode);
  return rows.map(toSheet);
}

export async function getSheet(assetCode: string, sheetCode: string): Promise<DocSheet | undefined> {
  const r = one<SheetRow>(`${SHEET_SELECT} WHERE d.asset_code = ? AND d.code = ?`, assetCode, sheetCode);
  return r ? toSheet(r) : undefined;
}

interface RemarkRow {
  id: string;
  sheet_id: string;
  sheet_code: string;
  number: number;
  x: number;
  y: number;
  status: SheetRemark['status'];
  date: string;
  clause: string;
  locus: string;
  text: string;
}

export async function getSheetRemarks(sheetId: string): Promise<SheetRemark[]> {
  const rows = all<RemarkRow>(
    `SELECT r.id, r.sheet_id, d.code AS sheet_code, r.number, r.x, r.y, r.status, r.date, r.clause, r.locus, r.text
       FROM sheet_remarks r JOIN doc_sheets d ON d.id = r.sheet_id
      WHERE r.sheet_id = ? ORDER BY r.sort`,
    sheetId,
  );

  return rows.map((r) => ({
    id: r.id,
    sheetId: r.sheet_id,
    sheetCode: r.sheet_code,
    number: Number(r.number),
    x: Number(r.x),
    y: Number(r.y),
    status: r.status,
    date: r.date,
    clause: r.clause,
    locus: r.locus,
    text: r.text,
    thread: all<{ id: string; author: string; initials: string; role: string; created_at: string; text: string }>(
      'SELECT id, author, initials, role, created_at, text FROM remark_messages WHERE remark_id = ? ORDER BY sort',
      r.id,
    ).map<RemarkMessage>((m) => ({
      id: m.id,
      author: m.author,
      initials: m.initials,
      role: m.role,
      createdAt: m.created_at,
      text: m.text,
    })),
  }));
}

/** Открытые замечания по всему объекту — для сводки в ведомости. */
export async function getOpenRemarks(assetCode: string): Promise<SheetRemark[]> {
  const rows = all<RemarkRow>(
    `SELECT r.id, r.sheet_id, d.code AS sheet_code, r.number, r.x, r.y, r.status, r.date, r.clause, r.locus, r.text
       FROM sheet_remarks r JOIN doc_sheets d ON d.id = r.sheet_id
      WHERE d.asset_code = ? AND r.status = 'open'
      ORDER BY d.sort, r.sort`,
    assetCode,
  );
  return rows.map((r) => ({
    id: r.id,
    sheetId: r.sheet_id,
    sheetCode: r.sheet_code,
    number: Number(r.number),
    x: Number(r.x),
    y: Number(r.y),
    status: r.status,
    date: r.date,
    clause: r.clause,
    locus: r.locus,
    text: r.text,
    thread: [],
  }));
}

/* ── Файлы ───────────────────────────────────────────────────────────────── */

interface FileRow {
  id: string;
  asset_code: string;
  kind: StoredFile['kind'];
  original_name: string;
  stored_name: string;
  size: number;
  mime: string;
  uploaded_by: string | null;
  uploaded_at: string;
  external_path: string | null;
}

function toFile(r: FileRow): StoredFile {
  return {
    id: r.id,
    assetCode: r.asset_code,
    kind: r.kind,
    originalName: r.original_name,
    storedName: r.stored_name,
    size: Number(r.size),
    mime: r.mime,
    uploadedBy: r.uploaded_by,
    uploadedAt: r.uploaded_at,
    externalPath: r.external_path,
  };
}

const FILE_COLUMNS = 'id, asset_code, kind, original_name, stored_name, size, mime, uploaded_by, uploaded_at, external_path';

export function getFile(id: string): StoredFile | undefined {
  const r = one<FileRow>(`SELECT ${FILE_COLUMNS} FROM files WHERE id = ?`, id);
  return r ? toFile(r) : undefined;
}

export async function getAssetFiles(assetCode: string): Promise<StoredFile[]> {
  return all<FileRow>(`SELECT ${FILE_COLUMNS} FROM files WHERE asset_code = ? ORDER BY uploaded_at DESC`, assetCode).map(toFile);
}

/* ── Цифровой двойник ────────────────────────────────────────────────────── */
/* Разделы C1–C3 закрыты флагом стадии «Строительство» (lib/stages.ts).
   Данные остаются в фикстурах: в БД они попадут вместе с приёмом телеметрии. */

type ByCode<T> = Record<string, T | undefined>;

const SUMMARY = twin.summary as unknown as ByCode<TwinSummary>;
const SENSORS = twin.sensors as unknown as ByCode<Sensor[]>;
const DEVIATIONS = twin.deviations as unknown as ByCode<Deviation[]>;
const TELEMETRY = twin.telemetry as unknown as ByCode<TelemetryChart[]>;

export async function getTwinSummary(code: string): Promise<TwinSummary | undefined> {
  return SUMMARY[code];
}

export async function getSensors(code: string): Promise<Sensor[]> {
  return SENSORS[code] ?? [];
}

export async function getDeviations(code: string): Promise<Deviation[]> {
  return DEVIATIONS[code] ?? [];
}

export async function getTelemetry(code: string): Promise<TelemetryChart[]> {
  return TELEMETRY[code] ?? [];
}

/** Объекты с активным двойником — для переключателя в разделе C. */
export async function getTwinAssets(orgId: string): Promise<Asset[]> {
  return all<AssetRow>(`SELECT ${ASSET_COLUMNS} FROM assets WHERE org_id = ? AND has_twin = 1 ORDER BY code DESC`, orgId).map(toAsset);
}

export * from './types';
