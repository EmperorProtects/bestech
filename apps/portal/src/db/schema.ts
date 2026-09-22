/**
 * Схема БД портала. Хранится строкой, а не .sql-файлом: так она попадает в бандл
 * Next вместе с кодом и не зависит от того, где лежит рабочая директория.
 *
 * Все DDL идемпотентны (IF NOT EXISTS) — схема применяется при каждом старте.
 */

export const SCHEMA_VERSION = 3;

export const SCHEMA_SQL = /* sql */ `
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

/* Организации и пользователи */

CREATE TABLE IF NOT EXISTS organizations (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  bin        TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  initials      TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('customer', 'engineer', 'supervisor')),
  position      TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  user_agent TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

/* Объекты */

CREATE TABLE IF NOT EXISTS assets (
  code             TEXT PRIMARY KEY,
  org_id           TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  short_name       TEXT NOT NULL,
  region           TEXT NOT NULL,
  address          TEXT NOT NULL,
  stage            TEXT NOT NULL CHECK (stage IN ('design', 'construction', 'operation')),
  chief            TEXT NOT NULL,
  area             TEXT NOT NULL,
  capacity         TEXT NOT NULL,
  contract         TEXT NOT NULL,
  updated          TEXT NOT NULL,
  progress         INTEGER NOT NULL DEFAULT 0,
  planned_progress INTEGER NOT NULL DEFAULT 0,
  figure           TEXT NOT NULL,
  sections_label   TEXT NOT NULL,
  deadline_date    TEXT NOT NULL,
  deadline_note    TEXT NOT NULL,
  remarks_count    INTEGER NOT NULL DEFAULT 0,
  remarks_label    TEXT NOT NULL,
  remarks_note     TEXT NOT NULL,
  remarks_state    TEXT NOT NULL,
  sensors_online   INTEGER NOT NULL DEFAULT 0,
  sensors_total    INTEGER NOT NULL DEFAULT 0,
  sensors_note     TEXT NOT NULL,
  sensors_state    TEXT NOT NULL,
  alarm_title      TEXT,
  alarm_note       TEXT,
  map_x            REAL NOT NULL DEFAULT 0.5,
  map_y            REAL NOT NULL DEFAULT 0.5,
  has_twin         INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_assets_org ON assets(org_id);

CREATE TABLE IF NOT EXISTS asset_metrics (
  asset_code            TEXT PRIMARY KEY REFERENCES assets(code) ON DELETE CASCADE,
  deviations_total      INTEGER NOT NULL DEFAULT 0,
  deviations_alarm      INTEGER NOT NULL DEFAULT 0,
  deviations_warning    INTEGER NOT NULL DEFAULT 0,
  deviations_parameters INTEGER NOT NULL DEFAULT 0,
  remarks_open_count    INTEGER NOT NULL DEFAULT 0,
  remarks_open_sheets   TEXT NOT NULL DEFAULT '',
  remarks_open_due      TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS asset_events (
  id         TEXT PRIMARY KEY,
  asset_code TEXT NOT NULL REFERENCES assets(code) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  severity   TEXT NOT NULL,
  title      TEXT NOT NULL,
  meta       TEXT NOT NULL,
  action     TEXT,
  href       TEXT,
  sort       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_events_asset ON asset_events(asset_code, sort);

/* Файлы. Объявлены до input_docs и doc_sheets, которые на них ссылаются. */

CREATE TABLE IF NOT EXISTS files (
  id            TEXT PRIMARY KEY,
  asset_code    TEXT NOT NULL REFERENCES assets(code) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('input', 'sheet', 'other')),
  original_name TEXT NOT NULL,
  stored_name   TEXT NOT NULL,
  size          INTEGER NOT NULL,
  mime          TEXT NOT NULL,
  uploaded_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_files_asset ON files(asset_code, kind);

/* Исходные данные (B4) */

CREATE TABLE IF NOT EXISTS input_docs (
  id         TEXT PRIMARY KEY,
  asset_code TEXT NOT NULL REFERENCES assets(code) ON DELETE CASCADE,
  code       TEXT NOT NULL,
  title      TEXT NOT NULL,
  file_id    TEXT REFERENCES files(id) ON DELETE SET NULL,
  file_name  TEXT,
  date       TEXT,
  state      TEXT NOT NULL CHECK (state IN ('accepted', 'review', 'missing', 'requested')),
  sort       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_inputs_asset ON input_docs(asset_code, sort);

CREATE TABLE IF NOT EXISTS completeness (
  asset_code TEXT PRIMARY KEY REFERENCES assets(code) ON DELETE CASCADE,
  percent    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS completeness_items (
  id         TEXT PRIMARY KEY,
  asset_code TEXT NOT NULL REFERENCES assets(code) ON DELETE CASCADE,
  severity   TEXT NOT NULL,
  title      TEXT NOT NULL,
  note       TEXT NOT NULL,
  sort       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_completeness_items_asset ON completeness_items(asset_code, sort);

/* Документация и чертежи (B5, B6) */

CREATE TABLE IF NOT EXISTS doc_sections (
  id            TEXT PRIMARY KEY,
  asset_code    TEXT NOT NULL REFERENCES assets(code) ON DELETE CASCADE,
  code          TEXT NOT NULL,
  name          TEXT NOT NULL,
  sheets_count  INTEGER NOT NULL DEFAULT 0,
  version       INTEGER NOT NULL DEFAULT 1,
  author        TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('issued', 'review', 'remarks', 'progress', 'void')),
  remarks_count INTEGER NOT NULL DEFAULT 0,
  issued        TEXT,
  sort          INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sections_asset_code ON doc_sections(asset_code, code);

CREATE TABLE IF NOT EXISTS doc_sheets (
  id         TEXT PRIMARY KEY,
  section_id TEXT NOT NULL REFERENCES doc_sections(id) ON DELETE CASCADE,
  asset_code TEXT NOT NULL REFERENCES assets(code) ON DELETE CASCADE,
  code       TEXT NOT NULL,
  name       TEXT NOT NULL,
  format     TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  changed    TEXT NOT NULL,
  file_id    TEXT REFERENCES files(id) ON DELETE SET NULL,
  sort       INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sheets_asset_code ON doc_sheets(asset_code, code);
CREATE INDEX IF NOT EXISTS idx_sheets_section ON doc_sheets(section_id, sort);

CREATE TABLE IF NOT EXISTS sheet_remarks (
  id       TEXT PRIMARY KEY,
  sheet_id TEXT NOT NULL REFERENCES doc_sheets(id) ON DELETE CASCADE,
  number   INTEGER NOT NULL,
  x        REAL NOT NULL,
  y        REAL NOT NULL,
  status   TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  date     TEXT NOT NULL,
  clause   TEXT NOT NULL,
  locus    TEXT NOT NULL,
  text     TEXT NOT NULL,
  sort     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_remarks_sheet ON sheet_remarks(sheet_id, sort);

CREATE TABLE IF NOT EXISTS remark_messages (
  id         TEXT PRIMARY KEY,
  remark_id  TEXT NOT NULL REFERENCES sheet_remarks(id) ON DELETE CASCADE,
  author     TEXT NOT NULL,
  initials   TEXT NOT NULL,
  role       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  text       TEXT NOT NULL,
  sort       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_messages_remark ON remark_messages(remark_id, sort);

/* Мастерская выпуска чертежей (Documents\newExport): связь шифра с объектом портала */

CREATE TABLE IF NOT EXISTS workspace_projects (
  shifr       TEXT PRIMARY KEY,
  asset_code  TEXT NOT NULL UNIQUE REFERENCES assets(code) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  stage_mark  TEXT NOT NULL,
  model_path  TEXT,
  album_path  TEXT,
  album_mtime TEXT,
  rpz_path    TEXT,
  synced_at   TEXT NOT NULL
);

/* Задания Claude в мастерской: выпуск альбома, нормоконтроль, смета */

CREATE TABLE IF NOT EXISTS workspace_jobs (
  id          TEXT PRIMARY KEY,
  asset_code  TEXT NOT NULL REFERENCES assets(code) ON DELETE CASCADE,
  shifr       TEXT NOT NULL,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  preset      TEXT NOT NULL,
  prompt      TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('running', 'done', 'error', 'stopped')),
  session_id  TEXT,
  log         TEXT NOT NULL DEFAULT '',
  result      TEXT,
  cost_usd    REAL,
  started_at  TEXT NOT NULL,
  finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_asset ON workspace_jobs(asset_code, started_at);

/* Цифровой двойник: датчики, показания, приём пакетов, аварии (v3) */

CREATE TABLE IF NOT EXISTS sensors (
  id         TEXT PRIMARY KEY,
  asset_code TEXT NOT NULL REFERENCES assets(code) ON DELETE CASCADE,
  code       TEXT NOT NULL,
  discipline TEXT NOT NULL,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL,
  unit       TEXT NOT NULL,
  decimals   INTEGER NOT NULL DEFAULT 1,
  axis       TEXT NOT NULL,
  x          REAL NOT NULL,
  y          REAL NOT NULL,
  warn_low   REAL,
  warn_high  REAL,
  alarm_low  REAL,
  alarm_high REAL,
  interval_s INTEGER NOT NULL DEFAULT 5,
  sort       INTEGER NOT NULL DEFAULT 0,
  last_value REAL,
  last_ts    TEXT,
  last_state TEXT NOT NULL DEFAULT 'offline'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sensors_asset_code ON sensors(asset_code, code);

CREATE TABLE IF NOT EXISTS sensor_readings (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  sensor_id TEXT NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
  ts        TEXT NOT NULL,
  value     REAL NOT NULL,
  packet_id INTEGER
);

CREATE INDEX IF NOT EXISTS idx_readings_sensor_ts ON sensor_readings(sensor_id, ts);

CREATE TABLE IF NOT EXISTS ingest_keys (
  id           TEXT PRIMARY KEY,
  asset_code   TEXT NOT NULL REFERENCES assets(code) ON DELETE CASCADE,
  key_hash     TEXT NOT NULL UNIQUE,
  label        TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  last_used_at TEXT
);

CREATE TABLE IF NOT EXISTS ingest_packets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_code  TEXT NOT NULL,
  key_id      TEXT,
  device      TEXT NOT NULL,
  remote      TEXT NOT NULL,
  received_at TEXT NOT NULL,
  accepted    INTEGER NOT NULL DEFAULT 0,
  rejected    INTEGER NOT NULL DEFAULT 0,
  bytes       INTEGER NOT NULL DEFAULT 0,
  status      INTEGER NOT NULL,
  note        TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_packets_asset ON ingest_packets(asset_code, id);

CREATE TABLE IF NOT EXISTS alarms (
  id         TEXT PRIMARY KEY,
  number     INTEGER NOT NULL,
  asset_code TEXT NOT NULL REFERENCES assets(code) ON DELETE CASCADE,
  sensor_id  TEXT NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
  level      TEXT NOT NULL CHECK (level IN ('warning', 'alarm', 'offline')),
  value      REAL,
  threshold  TEXT NOT NULL DEFAULT '',
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  opened_at  TEXT NOT NULL,
  closed_at  TEXT,
  close_note TEXT,
  ack_by     TEXT,
  ack_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_alarms_asset ON alarms(asset_code, closed_at);

/* Журнал действий */

CREATE TABLE IF NOT EXISTS activity (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL,
  user_id    TEXT,
  asset_code TEXT,
  action     TEXT NOT NULL,
  detail     TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_asset ON activity(asset_code, created_at);
`;
