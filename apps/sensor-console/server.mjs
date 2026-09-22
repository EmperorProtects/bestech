#!/usr/bin/env node
/**
 * Пульт показаний датчиков — отдельный сайт для демонстрации цифрового двойника.
 *
 * Заказчик открывает страницу (в том числе с телефона в той же сети), двигает
 * ползунки — сервер пульта пересылает значения в портал через API приёма, как
 * шлюз стройплощадки. Ключ устройства хранится только здесь, в браузер не уходит.
 *
 * Запуск:   pnpm console                      (из корня репозитория)
 * Настройка переменными окружения:
 *   PORTAL_URL   адрес портала для сервера пульта     http://127.0.0.1:3000
 *   DEVICE_KEY   ключ устройства объекта              bst_demo_2026-014_gateway
 *   DEVICE_ID    имя устройства в журнале пакетов     customer-console
 *   PORT, HOST   где слушает пульт                    4000, 0.0.0.0
 *   CONSOLE_PIN  PIN для доступа к пульту (по желанию)
 */

import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORTAL = (process.env.PORTAL_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const KEY = process.env.DEVICE_KEY ?? 'bst_demo_2026-014_gateway';
const DEVICE = process.env.DEVICE_ID ?? 'customer-console';
const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? '0.0.0.0';
const PIN = process.env.CONSOLE_PIN ?? '';

const portalHeaders = { Authorization: `Bearer ${KEY}`, 'X-Device-Id': DEVICE, 'Content-Type': 'application/json' };

function reply(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

async function readBody(req, limit = 100_000) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('слишком большой запрос');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

const reason = (error) => error?.cause?.code ?? error?.cause?.message ?? error?.message ?? 'ошибка';

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://console.local');

  try {
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      return reply(res, 200, await readFile(path.join(DIR, 'public', 'index.html'), 'utf8'), 'text/html; charset=utf-8');
    }

    if (req.method === 'GET' && url.pathname === '/api/health') {
      try {
        const r = await fetch(`${PORTAL}/api/ingest/v1/health`, { headers: portalHeaders, signal: AbortSignal.timeout(3000) });
        const body = await r.json();
        return reply(res, 200, { portal: true, authorized: Boolean(body.authorized), asset: body.asset, device: DEVICE, pinRequired: Boolean(PIN) });
      } catch (error) {
        return reply(res, 200, { portal: false, error: reason(error), device: DEVICE, pinRequired: Boolean(PIN) });
      }
    }

    if (PIN && req.headers['x-console-pin'] !== PIN) {
      return reply(res, 401, { error: 'Неверный PIN', pinRequired: true });
    }

    if (req.method === 'GET' && url.pathname === '/api/config') {
      const r = await fetch(`${PORTAL}/api/ingest/v1/sensors`, { headers: portalHeaders, signal: AbortSignal.timeout(5000) });
      return reply(res, r.status, await r.text());
    }

    if (req.method === 'POST' && url.pathname === '/api/send') {
      let body;
      try {
        body = JSON.parse((await readBody(req)) || '{}');
      } catch {
        return reply(res, 400, { error: 'тело запроса не JSON' });
      }
      const readings = Array.isArray(body.readings)
        ? body.readings.slice(0, 50).map((r) => ({ sensor: String(r.sensor ?? ''), value: Number(r.value) }))
        : [];
      if (!readings.length) return reply(res, 400, { error: 'нет показаний' });

      const r = await fetch(`${PORTAL}/api/ingest/v1/readings`, {
        method: 'POST',
        headers: portalHeaders,
        body: JSON.stringify({ device: DEVICE, readings }),
        signal: AbortSignal.timeout(8000),
      });
      return reply(res, r.status, await r.text());
    }

    return reply(res, 404, { error: 'не найдено' });
  } catch (error) {
    return reply(res, 502, { error: `портал недоступен: ${reason(error)}` });
  }
});

server.listen(PORT, HOST, () => {
  const lan = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => `http://${i.address}:${PORT}`);

  process.stdout.write(
    [
      '',
      '  BESTECH · пульт показаний датчиков',
      `  На этом компьютере:  http://localhost:${PORT}`,
      ...lan.map((u) => `  В локальной сети:    ${u}`),
      `  Портал:              ${PORTAL}  (устройство ${DEVICE})`,
      PIN ? '  Доступ по PIN:       включён' : '  Доступ по PIN:       выключен (CONSOLE_PIN)',
      '',
    ].join('\n') + '\n',
  );
});
