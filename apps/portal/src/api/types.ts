/** Типы предметной области. Совпадают со структурой фикстур в api/fixtures. */

import type { DocStatus, Stage, ToleranceState } from '@bestech/tokens';

export type { DocStatus, Stage, ToleranceState };

export interface Organization {
  id: string;
  name: string;
  bin: string;
}

export interface AssetFigureKind {
  kind: 'barn' | 'intake' | 'mill';
}

export interface Asset {
  /** Шифр объекта, он же сегмент маршрута: /cabinet/assets/2026-014 */
  code: string;
  name: string;
  shortName: string;
  region: string;
  address: string;
  stage: Stage;
  chief: string;
  area: string;
  capacity: string;
  contract: string;
  updated: string;
  /** Готовность СМР, % */
  progress: number;
  plannedProgress: number;
  figure: AssetFigureKind['kind'];
  sectionsLabel: string;
  deadline: { date: string; note: string };
  remarks: { count: number; label: string; note: string; state: ToleranceState };
  sensors: { online: number; total: number; note: string; state: ToleranceState };
  alarm?: { title: string; note: string };
  /** Координаты на схематичной карте, 0…1 */
  map: { x: number; y: number };
  hasTwin: boolean;
}

export interface AssetEvent {
  id: string;
  date: string;
  severity: ToleranceState | 'info';
  title: string;
  meta: string;
  action?: string;
  href?: string;
}

export interface AssetMetrics {
  deviations: { total: number; alarm: number; warning: number; parameters: number };
  remarksOpen: { count: number; sheets: string; due: string };
}

export type InputDocState = 'accepted' | 'review' | 'missing' | 'requested';

export interface InputDoc {
  id: string;
  code: string;
  title: string;
  /** Имя загруженного файла; null — документ ещё не приложен. */
  file: string | null;
  /** Идентификатор файла в хранилище — по нему строится ссылка на скачивание. */
  fileId: string | null;
  date: string | null;
  state: InputDocState;
}

export interface Completeness {
  percent: number;
  /** Что мешает выпустить разделы — результат ИИ-проверки, требует подтверждения инженером. */
  missing: { id: string; severity: ToleranceState; title: string; note: string }[];
}

export interface Sensor {
  id: string;
  code: string;
  discipline: string;
  name: string;
  value: string;
  limit: string;
  state: ToleranceState;
  axis: string;
  meta: string;
  /** Позиция метки в системе координат вьюера (viewBox 760×470). */
  x: number;
  y: number;
  series: number[];
  seen: string;
}

export interface Deviation {
  id: string;
  discipline: string;
  parameter: string;
  element: string;
  design: string;
  actual: string;
  delta: string;
  tolerance: string;
  state: ToleranceState;
  level: string;
  source: string;
  norm: string;
  /** Подсветка элемента в модели: путь в координатах вьюера 420×300. */
  path: string;
  x: number;
  y: number;
  series: number[];
  thresholdValue: number;
}

export interface TelemetryChart {
  id: string;
  title: string;
  subtitle: string;
  state: ToleranceState;
  current: string;
  unit: string;
  kind: 'line' | 'bar';
  xLabels: string[];
  yTicks: number[];
  max: number;
  thresholds: { value: number; label: string; color: string }[];
  series: { id: string; label: string; values: number[]; color: string; dashed?: boolean; marker?: boolean }[];
  bars?: { label: string; value: number; highlight?: boolean }[];
  summary: { k: string; v: string }[];
}

export interface TwinSummary {
  progress: number;
  plannedProgress: number;
  sensorsOnline: number;
  sensorsTotal: number;
  withinTolerance: number;
  nearTolerance: number;
  outOfTolerance: number;
  offline: number;
  updated: string;
  scale: string;
}

/* ── Документация и чертежи (B5, B6) ─────────────────────────────────────── */

export interface DocSection {
  id: string;
  code: string;
  name: string;
  sheetsCount: number;
  version: number;
  author: string;
  status: DocStatus;
  remarksCount: number;
  issued: string | null;
  /** Листы, выпущенные в прототипе, — их можно открыть и скачать. */
  availableSheets: number;
}

export interface DocSheet {
  id: string;
  sectionId: string;
  sectionCode: string;
  /** Автор раздела — подставляется в графу «Разраб.» основной надписи. */
  sectionAuthor: string;
  assetCode: string;
  code: string;
  name: string;
  format: string;
  version: number;
  changed: string;
  /** Загруженный исходник (PDF/DWG); если null — лист отдаётся сгенерированным. */
  fileId: string | null;
  fileName: string | null;
  openRemarks: number;
  /** Порядковый номер листа в разделе с 1 — он же страница альбома PDF. */
  position: number;
}

export interface RemarkMessage {
  id: string;
  author: string;
  initials: string;
  role: string;
  createdAt: string;
  text: string;
}

export interface SheetRemark {
  id: string;
  sheetId: string;
  sheetCode: string;
  number: number;
  /** Позиция пина в системе координат просмотрщика (viewBox 760×470). */
  x: number;
  y: number;
  status: 'open' | 'closed';
  date: string;
  clause: string;
  locus: string;
  text: string;
  thread: RemarkMessage[];
}

/* ── Файлы ───────────────────────────────────────────────────────────────── */

export type FileKind = 'input' | 'sheet' | 'other';

export interface StoredFile {
  id: string;
  assetCode: string;
  kind: FileKind;
  originalName: string;
  storedName: string;
  size: number;
  mime: string;
  uploadedBy: string | null;
  uploadedAt: string;
  /** Файл живёт в мастерской newExport, а не в хранилище портала. */
  externalPath: string | null;
}
