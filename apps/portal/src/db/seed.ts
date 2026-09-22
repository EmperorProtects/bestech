/**
 * Первичное наполнение БД. Запускается один раз — если таблица организаций пуста.
 *
 * Источник данных об объектах — те же фикстуры, что использовал прототип до
 * появления бекенда (`api/fixtures/cabinet.json`), поэтому экраны выглядят так
 * же, как на согласованных листах. Ведомость документации и листы чертежей
 * (B5, B6) добавлены здесь: в фикстурах их не было.
 *
 * Демо-учётные записи заводятся с паролем из BESTECH_DEMO_PASSWORD
 * (по умолчанию `bestech2026`) — он же показан на экране входа.
 */

import type { DatabaseSync } from 'node:sqlite';
import cabinet from '../api/fixtures/cabinet.json';
import { hashPassword } from '../lib/password';

const NOW = new Date().toISOString();
const DEMO_PASSWORD = process.env.BESTECH_DEMO_PASSWORD ?? 'bestech2026';

interface SeedUser {
  id: string;
  email: string;
  name: string;
  initials: string;
  role: 'customer' | 'engineer' | 'supervisor';
  position: string;
}

const USERS: SeedUser[] = [
  { id: 'usr-bekzhanov', email: 'zakazchik@akmola-agro.kz', name: 'Бекжанов Т.', initials: 'ТБ', role: 'customer', position: 'Заказчик' },
  { id: 'usr-sagintaev', email: 'gip@bekstroy.kz', name: 'Сагинтаев Е.', initials: 'ЕС', role: 'engineer', position: 'ГИП · лиц. ГСЛ №0788280' },
  { id: 'usr-kim', email: 'tehnadzor@bekstroy.kz', name: 'Ким А.', initials: 'АК', role: 'supervisor', position: 'Технадзор' },
];

/* ── Ведомость документации ──────────────────────────────────────────────── */

type SectionStatus = 'issued' | 'review' | 'remarks' | 'progress' | 'void';

interface SeedSection {
  code: string;
  name: string;
  sheets: number;
  version: number;
  author: string;
  status: SectionStatus;
  remarks: number;
  issued: string | null;
}

/** Разделы ПД для 2026-014 — данные с согласованного листа B5. */
const SECTIONS_2026_014: SeedSection[] = [
  { code: 'ГП', name: 'Генеральный план и транспорт', sheets: 8, version: 3, author: 'Сагинтаев Е.', status: 'issued', remarks: 0, issued: '04.08.2026' },
  { code: 'ТХ', name: 'Технологические решения', sheets: 14, version: 2, author: 'Сагинтаев Е.', status: 'issued', remarks: 0, issued: '11.08.2026' },
  { code: 'АР', name: 'Архитектурные решения', sheets: 12, version: 5, author: 'Ким А.', status: 'remarks', remarks: 2, issued: null },
  { code: 'КМ', name: 'Конструкции металлические', sheets: 22, version: 4, author: 'Бекжанов Т.', status: 'remarks', remarks: 1, issued: null },
  { code: 'КЖ', name: 'Конструкции железобетонные', sheets: 26, version: 4, author: 'Бекжанов Т.', status: 'issued', remarks: 0, issued: '18.08.2026' },
  { code: 'ОВ', name: 'Отопление, вентиляция, кондиционирование', sheets: 16, version: 1, author: 'Ахметова Г.', status: 'progress', remarks: 0, issued: null },
  { code: 'ВК', name: 'Водоснабжение и канализация', sheets: 11, version: 2, author: 'Оспанова Д.', status: 'review', remarks: 0, issued: null },
  { code: 'ЭОМ', name: 'Электроснабжение и электрооборудование', sheets: 9, version: 2, author: 'Тлеуов С.', status: 'review', remarks: 0, issued: null },
  { code: 'СС', name: 'Слаботочные системы и связь', sheets: 6, version: 1, author: 'Тлеуов С.', status: 'issued', remarks: 0, issued: '25.08.2026' },
];

/** 2026-021 — объект на стадии проектирования, комплект только формируется. */
const SECTIONS_2026_021: SeedSection[] = [
  { code: 'ГП', name: 'Генеральный план и транспорт', sheets: 6, version: 1, author: 'Сагинтаев Е.', status: 'review', remarks: 0, issued: null },
  { code: 'ТХ', name: 'Технологические решения', sheets: 9, version: 1, author: 'Сагинтаев Е.', status: 'progress', remarks: 0, issued: null },
  { code: 'АР', name: 'Архитектурные решения', sheets: 8, version: 2, author: 'Ким А.', status: 'review', remarks: 0, issued: null },
  { code: 'КЖ', name: 'Конструкции железобетонные', sheets: 12, version: 1, author: 'Бекжанов Т.', status: 'progress', remarks: 0, issued: null },
  { code: 'ВК', name: 'Водоснабжение и канализация', sheets: 7, version: 1, author: 'Оспанова Д.', status: 'progress', remarks: 0, issued: null },
];

/** 2025-097 — объект введён в эксплуатацию, комплект выдан полностью. */
const SECTIONS_2025_097: SeedSection[] = [
  { code: 'ГП', name: 'Генеральный план и транспорт', sheets: 7, version: 4, author: 'Сагинтаев Е.', status: 'issued', remarks: 0, issued: '12.03.2025' },
  { code: 'ТХ', name: 'Технологические решения', sheets: 11, version: 3, author: 'Сагинтаев Е.', status: 'issued', remarks: 0, issued: '12.03.2025' },
  { code: 'АР', name: 'Архитектурные решения', sheets: 10, version: 6, author: 'Ким А.', status: 'issued', remarks: 0, issued: '28.03.2025' },
  { code: 'КМ', name: 'Конструкции металлические', sheets: 18, version: 5, author: 'Бекжанов Т.', status: 'issued', remarks: 0, issued: '28.03.2025' },
  { code: 'ЭОМ', name: 'Электроснабжение и электрооборудование', sheets: 8, version: 3, author: 'Тлеуов С.', status: 'issued', remarks: 0, issued: '05.04.2025' },
];

/** Типовые наименования листов по разделам СПДС. */
const SHEET_NAMES: Record<string, string[]> = {
  ГП: [
    'Общие данные, ведомость чертежей',
    'Разбивочный план',
    'План организации рельефа',
    'План земляных масс',
    'Сводный план инженерных сетей',
    'План благоустройства и озеленения',
    'Поперечные профили проездов',
    'Ведомость малых архитектурных форм',
  ],
  ТХ: [
    'Общие данные, ведомость чертежей',
    'Схема технологического процесса',
    'План расположения оборудования на отм. +0.000',
    'План расположения оборудования на отм. +3.600',
    'Ведомость технологического оборудования',
    'Узлы крепления оборудования',
    'Схема потоков молока и кормов',
  ],
  АР: [
    'Общие данные, ведомость чертежей',
    'План на отм. +0.000',
    'План на отм. +3.600',
    'Разрез 1-1, разрез 2-2',
    'Экспликация помещений',
    'Фасады в осях 1–7',
    'Ведомость заполнения проёмов',
    'Узлы примыканий кровли',
  ],
  КМ: [
    'Общие данные, ведомость чертежей',
    'Схема расположения элементов каркаса',
    'Узлы У-1…У-6',
    'Ведомость элементов и метизов',
    'Связи по покрытию',
    'Прогоны и фахверк',
  ],
  КЖ: [
    'Общие данные, ведомость чертежей',
    'План фундаментов',
    'Схема армирования фундаментной плиты',
    'Монолитные участки, узлы',
    'Ведомость расхода стали',
  ],
  ОВ: ['Общие данные, ведомость чертежей', 'План систем отопления', 'План систем вентиляции', 'Аксонометрическая схема В1', 'Спецификация оборудования'],
  ВК: ['Общие данные, ведомость чертежей', 'План сетей В1', 'План сетей К1', 'Аксонометрическая схема', 'Спецификация оборудования'],
  ЭОМ: ['Общие данные, ведомость чертежей', 'Принципиальная схема ВРУ', 'План силового электрооборудования', 'План освещения', 'Схема заземления'],
  СС: ['Общие данные, ведомость чертежей', 'План сетей связи', 'Структурная схема СКС', 'План системы видеонаблюдения'],
};

/** Номера листов раздела АР на объекте 2026-014 — сквозные, с пропусками, как в альбоме. */
const AR_SHEET_NUMBERS = [1, 4, 5, 6, 7, 9];

/** Формат листа: общие данные и ведомости — А2, планы и разрезы — А1. */
function sheetFormat(name: string): string {
  return /общие данные|ведомость|экспликац|спецификац/i.test(name) ? 'А2' : 'А1';
}

interface SeedRemark {
  sheetCode: string;
  number: number;
  x: number;
  y: number;
  status: 'open' | 'closed';
  date: string;
  clause: string;
  locus: string;
  text: string;
  thread: { author: string; initials: string; role: string; at: string; text: string }[];
}

/** Замечания нормоконтроля на листах АР — данные с согласованного листа B6. */
const REMARKS_2026_014: SeedRemark[] = [
  {
    sheetCode: 'АР-05',
    number: 1,
    x: 250,
    y: 130,
    status: 'open',
    date: '05.09.2026',
    clause: 'ГОСТ 21.501, п. 5.3',
    locus: 'ось Б/2 · доильный зал',
    text: 'Не указана отметка чистого пола. Отметки уровней должны быть показаны на плане и разрезе.',
    thread: [
      {
        author: 'Сагинтаев Е.',
        initials: 'ЕС',
        role: 'нормоконтроль',
        at: '05.09.2026 11:05',
        text: 'Лист АР-05: отсутствует отметка чистого пола в помещении 1. Прошу внести по ГОСТ 21.501, п. 5.3.',
      },
      {
        author: 'Ким А.',
        initials: 'АК',
        role: 'автор раздела АР',
        at: '08.09.2026 09:20',
        text: 'Принято, отметку +3.600 нанесу на план и разрез 1-1. Версия 6 выйдет 12.09.2026.',
      },
    ],
  },
  {
    sheetCode: 'АР-07',
    number: 2,
    x: 620,
    y: 345,
    status: 'open',
    date: '05.09.2026',
    clause: 'ГОСТ 21.501, п. 7.2',
    locus: 'ось В/6 · венткамера',
    text: 'Площадь венткамеры в экспликации не совпадает с геометрией плана: 96,2 м² против 88,4 м².',
    thread: [
      {
        author: 'Сагинтаев Е.',
        initials: 'ЕС',
        role: 'нормоконтроль',
        at: '05.09.2026 11:12',
        text: 'Расхождение площади помещения 6 между экспликацией и планом. Уточнить и синхронизировать с разделом ОВ.',
      },
    ],
  },
  {
    sheetCode: 'АР-05',
    number: 3,
    x: 420,
    y: 250,
    status: 'closed',
    date: '22.08.2026',
    clause: 'СН РК 3.02-07-2014',
    locus: 'ось Б/4 · молочный блок',
    text: 'Ширина технологического проезда 3,2 м вместо нормируемых 3,5 м.',
    thread: [
      {
        author: 'Ким А.',
        initials: 'АК',
        role: 'автор раздела АР',
        at: '28.08.2026 16:40',
        text: 'Проезд расширен до 3,5 м за счёт переноса перегородки по оси 5. Внесено в изм. 5.',
      },
    ],
  },
  {
    sheetCode: 'КМ-03',
    number: 1,
    x: 480,
    y: 210,
    status: 'open',
    date: '06.09.2026',
    clause: 'СП РК 5.04-23-2019, п. 8.6',
    locus: 'узел У-4',
    text: 'Не указан класс прочности болтов в узле У-4.',
    thread: [
      {
        author: 'Сагинтаев Е.',
        initials: 'ЕС',
        role: 'нормоконтроль',
        at: '06.09.2026 10:30',
        text: 'В спецификации узла У-4 отсутствует класс прочности болтов. Срок ответа 18.09.2026.',
      },
    ],
  },
];

const SECTIONS_BY_ASSET: Record<string, SeedSection[]> = {
  '2026-014': SECTIONS_2026_014,
  '2026-021': SECTIONS_2026_021,
  '2025-097': SECTIONS_2025_097,
};

/* ── Типы фикстур ────────────────────────────────────────────────────────── */

interface FixtureAsset {
  code: string;
  name: string;
  shortName: string;
  region: string;
  address: string;
  stage: string;
  chief: string;
  area: string;
  capacity: string;
  contract: string;
  updated: string;
  progress: number;
  plannedProgress: number;
  figure: string;
  sectionsLabel: string;
  deadline: { date: string; note: string };
  remarks: { count: number; label: string; note: string; state: string };
  sensors: { online: number; total: number; note: string; state: string };
  alarm?: { title: string; note: string };
  map: { x: number; y: number };
  hasTwin: boolean;
}

/* ── Засев ───────────────────────────────────────────────────────────────── */

function isEmpty(db: DatabaseSync): boolean {
  const row = db.prepare('SELECT COUNT(*) AS n FROM organizations').get() as { n: number | bigint } | undefined;
  return Number(row?.n ?? 0) === 0;
}

export function seedIfEmpty(db: DatabaseSync): void {
  if (!isEmpty(db)) return;

  db.exec('BEGIN');
  try {
    seedOrganization(db);
    seedUsers(db);
    seedAssets(db);
    seedInputs(db);
    seedDocuments(db);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function seedOrganization(db: DatabaseSync): void {
  const org = cabinet.organization as { id: string; name: string; bin: string };
  db.prepare('INSERT INTO organizations (id, name, bin, created_at) VALUES (?, ?, ?, ?)').run(org.id, org.name, org.bin, NOW);
}

function seedUsers(db: DatabaseSync): void {
  const org = cabinet.organization as { id: string };
  const hash = hashPassword(DEMO_PASSWORD);
  const stmt = db.prepare(
    `INSERT INTO users (id, org_id, email, password_hash, name, initials, role, position, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const u of USERS) {
    stmt.run(u.id, org.id, u.email, hash, u.name, u.initials, u.role, u.position, NOW);
  }
}

function seedAssets(db: DatabaseSync): void {
  const org = cabinet.organization as { id: string };
  const assets = cabinet.assets as unknown as FixtureAsset[];
  const metrics = cabinet.metrics as Record<
    string,
    { deviations: { total: number; alarm: number; warning: number; parameters: number }; remarksOpen: { count: number; sheets: string; due: string } }
  >;
  const events = cabinet.events as Record<
    string,
    { id: string; date: string; severity: string; title: string; meta: string; action?: string; href?: string }[]
  >;

  const assetStmt = db.prepare(
    `INSERT INTO assets (
       code, org_id, name, short_name, region, address, stage, chief, area, capacity, contract, updated,
       progress, planned_progress, figure, sections_label, deadline_date, deadline_note,
       remarks_count, remarks_label, remarks_note, remarks_state,
       sensors_online, sensors_total, sensors_note, sensors_state,
       alarm_title, alarm_note, map_x, map_y, has_twin
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const metricsStmt = db.prepare(
    `INSERT INTO asset_metrics (
       asset_code, deviations_total, deviations_alarm, deviations_warning, deviations_parameters,
       remarks_open_count, remarks_open_sheets, remarks_open_due
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const eventStmt = db.prepare(
    'INSERT INTO asset_events (id, asset_code, date, severity, title, meta, action, href, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );

  for (const a of assets) {
    assetStmt.run(
      a.code,
      org.id,
      a.name,
      a.shortName,
      a.region,
      a.address,
      a.stage,
      a.chief,
      a.area,
      a.capacity,
      a.contract,
      a.updated,
      a.progress,
      a.plannedProgress,
      a.figure,
      a.sectionsLabel,
      a.deadline.date,
      a.deadline.note,
      a.remarks.count,
      a.remarks.label,
      a.remarks.note,
      a.remarks.state,
      a.sensors.online,
      a.sensors.total,
      a.sensors.note,
      a.sensors.state,
      a.alarm?.title ?? null,
      a.alarm?.note ?? null,
      a.map.x,
      a.map.y,
      a.hasTwin ? 1 : 0,
    );

    const m = metrics[a.code];
    if (m) {
      metricsStmt.run(
        a.code,
        m.deviations.total,
        m.deviations.alarm,
        m.deviations.warning,
        m.deviations.parameters,
        m.remarksOpen.count,
        m.remarksOpen.sheets,
        m.remarksOpen.due,
      );
    }

    (events[a.code] ?? []).forEach((e, i) => {
      eventStmt.run(e.id, a.code, e.date, e.severity, e.title, e.meta, e.action ?? null, e.href ?? null, i);
    });
  }
}

function seedInputs(db: DatabaseSync): void {
  const inputs = cabinet.inputs as Record<
    string,
    { id: string; code: string; title: string; file: string | null; date: string | null; state: string }[]
  >;
  const completeness = cabinet.completeness as Record<
    string,
    { percent: number; missing: { id: string; severity: string; title: string; note: string }[] }
  >;

  const docStmt = db.prepare(
    'INSERT INTO input_docs (id, asset_code, code, title, file_id, file_name, date, state, sort) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)',
  );
  const completenessStmt = db.prepare('INSERT INTO completeness (asset_code, percent) VALUES (?, ?)');
  const itemStmt = db.prepare('INSERT INTO completeness_items (id, asset_code, severity, title, note, sort) VALUES (?, ?, ?, ?, ?, ?)');

  for (const [code, docs] of Object.entries(inputs)) {
    docs.forEach((d, i) => docStmt.run(`${code}:${d.id}`, code, d.code, d.title, d.file, d.date, d.state, i));
  }
  for (const [code, c] of Object.entries(completeness)) {
    completenessStmt.run(code, c.percent);
    c.missing.forEach((m, i) => itemStmt.run(`${code}:${m.id}`, code, m.severity, m.title, m.note, i));
  }
}

function seedDocuments(db: DatabaseSync): void {
  const sectionStmt = db.prepare(
    `INSERT INTO doc_sections (id, asset_code, code, name, sheets_count, version, author, status, remarks_count, issued, sort)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const sheetStmt = db.prepare(
    'INSERT INTO doc_sheets (id, section_id, asset_code, code, name, format, version, changed, file_id, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)',
  );

  for (const [assetCode, sections] of Object.entries(SECTIONS_BY_ASSET)) {
    sections.forEach((s, si) => {
      const sectionId = `${assetCode}:${s.code}`;
      sectionStmt.run(sectionId, assetCode, s.code, s.name, s.sheets, s.version, s.author, s.status, s.remarks, s.issued, si);

      const names = SHEET_NAMES[s.code] ?? ['Общие данные, ведомость чертежей'];
      // Альбом крупный, в ведомость выносим первые листы каждого раздела —
      // именно они прошли нормоконтроль и доступны для скачивания в прототипе.
      const explicit = assetCode === '2026-014' && s.code === 'АР' ? AR_SHEET_NUMBERS : null;
      const take = Math.min(names.length, s.sheets, explicit?.length ?? Number.POSITIVE_INFINITY);

      for (let i = 0; i < take; i += 1) {
        const name = names[i]!;
        const number = explicit?.[i] ?? i + 1;
        const sheetCode = `${s.code}-${String(number).padStart(2, '0')}`;
        const changed = s.issued ?? '05.09.2026';
        sheetStmt.run(`${assetCode}:${sheetCode}`, sectionId, assetCode, sheetCode, name, sheetFormat(name), s.version, changed, i);
      }
    });
  }

  seedRemarks(db);
}

function seedRemarks(db: DatabaseSync): void {
  const remarkStmt = db.prepare(
    'INSERT INTO sheet_remarks (id, sheet_id, number, x, y, status, date, clause, locus, text, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  const messageStmt = db.prepare(
    'INSERT INTO remark_messages (id, remark_id, author, initials, role, created_at, text, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  );

  REMARKS_2026_014.forEach((r, i) => {
    const sheetId = `2026-014:${r.sheetCode}`;
    const exists = db.prepare('SELECT 1 AS ok FROM doc_sheets WHERE id = ?').get(sheetId);
    if (!exists) return;

    const remarkId = `${sheetId}:${r.number}`;
    remarkStmt.run(remarkId, sheetId, r.number, r.x, r.y, r.status, r.date, r.clause, r.locus, r.text, i);
    r.thread.forEach((m, j) => messageStmt.run(`${remarkId}:${j}`, remarkId, m.author, m.initials, m.role, m.at, m.text, j));
  });
}
