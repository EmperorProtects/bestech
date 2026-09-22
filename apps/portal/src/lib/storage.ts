/**
 * Хранилище загруженных файлов: сами файлы лежат на диске в `.data/uploads`,
 * метаданные — в таблице `files`. Имя на диске генерируется, оригинальное
 * хранится в БД и подставляется при скачивании, поэтому кириллица и пробелы в
 * именах безопасны.
 */

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { UPLOADS_DIR, run } from '@/db/client';
import { resolveInWorkspace } from './workspace';
import type { FileKind, StoredFile } from '@/api/types';

/** Ограничение прототипа — совпадает с подписью в зоне загрузки. */
export const MAX_FILE_SIZE = 200 * 1024 * 1024;

const ALLOWED_EXTENSIONS = ['.pdf', '.dwg', '.dxf', '.ifc', '.rvt', '.xlsx', '.xls', '.docx', '.doc', '.png', '.jpg', '.jpeg', '.zip', '.svg'];

export function isAllowedFile(name: string): boolean {
  return ALLOWED_EXTENSIONS.includes(path.extname(name).toLowerCase());
}

/** Путь файла на диске. Имя всегда сгенерированное, выхода за каталог быть не может. */
export function filePath(storedName: string): string {
  return path.join(UPLOADS_DIR, path.basename(storedName));
}

/**
 * Имя файла из multipart-формы. Парсер отдаёт его байтами UTF-8, разобранными
 * как latin-1, поэтому «АПЗ_2026.dwg» превращается в «ÐÐÐ_2026.dwg».
 * Если строка целиком укладывается в один байт на символ и разбирается как
 * корректный UTF-8 — восстанавливаем исходное имя.
 */
export function decodeFileName(name: string): string {
  if (!/[\u0080-\u00ff]/.test(name)) return name;
  if (!Array.from(name).every((ch) => ch.codePointAt(0)! <= 0xff)) return name;

  try {
    const bytes = Uint8Array.from(name, (ch) => ch.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return name;
  }
}

export async function readStoredFile(file: StoredFile): Promise<Buffer> {
  if (file.externalPath) {
    // Путь из БД всё равно проверяем: отдаём только то, что лежит внутри мастерской.
    const inside = resolveInWorkspace(file.externalPath);
    if (!inside) throw new Error('Файл вне мастерской');
    return readFile(inside);
  }
  return readFile(filePath(file.storedName));
}

export interface SaveResult {
  id: string;
  originalName: string;
  storedName: string;
  size: number;
}

/** Сохраняет файл на диск и регистрирует его в БД. */
export async function saveUpload(
  file: File,
  options: { assetCode: string; kind: FileKind; userId: string },
): Promise<SaveResult> {
  const id = randomUUID();
  const originalName = decodeFileName(file.name);
  const ext = path.extname(originalName).toLowerCase();
  const storedName = `${id}${ext}`;

  await mkdir(UPLOADS_DIR, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath(storedName), bytes);

  run(
    `INSERT INTO files (id, asset_code, kind, original_name, stored_name, size, mime, uploaded_by, uploaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    options.assetCode,
    options.kind,
    originalName,
    storedName,
    bytes.length,
    file.type || 'application/octet-stream',
    options.userId,
    new Date().toISOString(),
  );

  return { id, originalName, storedName, size: bytes.length };
}

/** Человекочитаемый размер: 1,4 МБ. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  const units = ['КБ', 'МБ', 'ГБ'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1).replace('.', ',')} ${units[unit]}`;
}

/** Тип содержимого для отдачи браузеру — по расширению, MIME из формы не доверяем. */
export function contentTypeFor(name: string): string {
  const map: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.md': 'text/plain; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.zip': 'application/zip',
    '.dwg': 'image/vnd.dwg',
    '.dxf': 'image/vnd.dxf',
    '.ifc': 'application/x-step',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return map[path.extname(name).toLowerCase()] ?? 'application/octet-stream';
}

/** Заголовок Content-Disposition с RFC 5987-кодированием — иначе кириллица теряется. */
export function contentDisposition(fileName: string, inline = false): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
