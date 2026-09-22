/**
 * Засев двойника: датчики демо-объекта и ключ демо-шлюза. Отдельно от seed.ts,
 * потому что база прототипа уже создана — этот засев срабатывает и на ней,
 * как только появились таблицы датчиков (схема v3). Показаний не создаёт:
 * их присылает эмулятор или реальный шлюз через API приёма.
 */

import type { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { DEMO_ASSET, DEMO_INGEST_KEY, SENSOR_CATALOG } from '../lib/twin/catalog';

export function seedTwin(db: DatabaseSync): void {
  const asset = db.prepare('SELECT code FROM assets WHERE code = ?').get(DEMO_ASSET);
  if (!asset) return;

  const existing = db.prepare('SELECT COUNT(*) AS n FROM sensors WHERE asset_code = ?').get(DEMO_ASSET) as { n: number | bigint };
  if (Number(existing.n) > 0) return;

  const insert = db.prepare(
    `INSERT INTO sensors (id, asset_code, code, discipline, name, kind, unit, decimals, axis, x, y,
                          warn_low, warn_high, alarm_low, alarm_high, interval_s, sort, last_state)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'offline')`,
  );

  db.exec('BEGIN');
  try {
    SENSOR_CATALOG.forEach((s, i) => {
      insert.run(
        randomUUID(), DEMO_ASSET, s.code, s.discipline, s.name, s.kind, s.unit, s.decimals, s.axis, s.x, s.y,
        s.warnLow ?? null, s.warnHigh ?? null, s.alarmLow ?? null, s.alarmHigh ?? null, s.interval, i,
      );
    });

    const hash = createHash('sha256').update(DEMO_INGEST_KEY.trim()).digest('hex');
    db.prepare('INSERT OR IGNORE INTO ingest_keys (id, asset_code, key_hash, label, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(`key-demo-${DEMO_ASSET}`, DEMO_ASSET, hash, 'Демо-шлюз стройплощадки', new Date().toISOString());

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
