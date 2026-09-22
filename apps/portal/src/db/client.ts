/**
 * Подключение к SQLite через встроенный модуль `node:sqlite` (Node 22.5+).
 * Внешних зависимостей и нативной сборки не требуется — прототип поднимается
 * одной командой `pnpm dev`.
 *
 * Файл БД и загруженные файлы лежат в каталоге данных (по умолчанию
 * `apps/portal/.data`, переопределяется переменной BESTECH_DATA_DIR).
 *
 * Соединение кешируется в globalThis: в dev-режиме Next пересоздаёт модули при
 * каждой правке, а второй DatabaseSync на том же файле нам не нужен.
 */

import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { SCHEMA_SQL, SCHEMA_VERSION } from './schema';
import { seedIfEmpty } from './seed';
import { seedTwin } from './seed-twin';

export const DATA_DIR = path.resolve(process.env.BESTECH_DATA_DIR ?? path.join(process.cwd(), '.data'));
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'bestech.db');

type Cache = { db?: DatabaseSync; seeded?: boolean; schema?: number };

const cache = ((globalThis as { __bestechDb?: Cache }).__bestechDb ??= {});

function open(): DatabaseSync {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(UPLOADS_DIR, { recursive: true });

  const db = new DatabaseSync(DB_FILE);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec(SCHEMA_SQL);
  migrate(db);
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
    'schema_version',
    String(SCHEMA_VERSION),
  );
  return db;
}

/**
 * Изменения существующих таблиц. CREATE TABLE IF NOT EXISTS не добавляет
 * колонки в уже созданную базу, поэтому ALTER выполняется по факту их отсутствия.
 */
function migrate(db: DatabaseSync): void {
  const columns = (table: string) =>
    (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);

  // v2: файл может лежать вне хранилища портала — в мастерской newExport.
  if (!columns('files').includes('external_path')) {
    db.exec('ALTER TABLE files ADD COLUMN external_path TEXT');
  }
}

/** Соединение с БД. Схема применяется при первом обращении, данные — засеиваются один раз. */
export function getDb(): DatabaseSync {
  if (!cache.db) {
    cache.db = open();
    cache.schema = SCHEMA_VERSION;
  } else if (cache.schema !== SCHEMA_VERSION) {
    // dev-сервер перезагрузил модули с новой схемой, а соединение живое в globalThis —
    // догоняем схему без перезапуска процесса.
    cache.db.exec(SCHEMA_SQL);
    migrate(cache.db);
    cache.schema = SCHEMA_VERSION;
    cache.seeded = false;
  }
  if (!cache.seeded) {
    // Флаг ставится после успеха: если засев упал, следующий запрос повторит его,
    // а не станет молча работать с полупустой базой.
    seedIfEmpty(cache.db);
    seedTwin(cache.db);
    cache.seeded = true;
  }
  return cache.db;
}

/**
 * SELECT, возвращающий список строк.
 *
 * node:sqlite отдаёт строки с прототипом null; такие объекты нельзя передать из
 * серверного компонента в клиентский, поэтому копируем их в обычные.
 */
export function all<T>(sql: string, ...params: SqlParam[]): T[] {
  return (getDb().prepare(sql).all(...params) as unknown as T[]).map((row) => ({ ...row }));
}

/** SELECT, возвращающий одну строку или undefined. */
export function one<T>(sql: string, ...params: SqlParam[]): T | undefined {
  const row = getDb().prepare(sql).get(...params) as unknown as T | undefined;
  return row === undefined ? undefined : { ...row };
}

/** INSERT / UPDATE / DELETE. */
export function run(sql: string, ...params: SqlParam[]): void {
  getDb().prepare(sql).run(...params);
}

/** Выполняет колбэк в транзакции: любое исключение откатывает всё целиком. */
export function transaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/** Типы, которые принимает node:sqlite в качестве параметров запроса. */
export type SqlParam = SQLInputValue;

/** SQLite не знает boolean: в схеме это INTEGER 0/1. */
export function bool(value: number | bigint | null | undefined): boolean {
  return Number(value ?? 0) === 1;
}

export function flag(value: boolean): number {
  return value ? 1 : 0;
}
