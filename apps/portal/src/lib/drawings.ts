/**
 * Выдача чертежей: подбор исходника листа и сборка комплекта в архив.
 *
 * Приоритет отдачи листа:
 *   1) загруженный проектировщиком исходник (PDF/DWG) — если он есть;
 *   2) лист, сгенерированный из данных БД (SVG с рамкой и штампом по ГОСТ).
 */

import { STAGE_LABELS } from '@bestech/tokens';
import type { Asset, DocSheet } from '@/api/types';
import { getFile } from '@/api';
import { renderSheetSvg, sheetFileName, type SheetContext, type SheetSubject } from './sheet';
import { contentTypeFor, readStoredFile } from './storage';
import { createZip, type ZipEntry } from './zip';

export function sheetSubject(sheet: DocSheet): SheetSubject {
  return { code: sheet.code, name: sheet.name, format: sheet.format, version: sheet.version, changed: sheet.changed };
}

export function sheetContext(asset: Asset, author: string, organization: string): SheetContext {
  return {
    assetCode: asset.code,
    assetName: asset.name,
    stageLabel: STAGE_LABELS[asset.stage],
    chief: asset.chief,
    author,
    organization,
  };
}

export interface SheetPayload {
  bytes: Buffer;
  fileName: string;
  contentType: string;
  /** true — лист собран порталом, false — отдан загруженный исходник. */
  generated: boolean;
}

/** Байты одного листа для скачивания или просмотра. */
export async function renderSheet(sheet: DocSheet, asset: Asset, ctx: { organization: string }): Promise<SheetPayload> {
  if (sheet.fileId) {
    const file = getFile(sheet.fileId);
    if (file) {
      try {
        return {
          bytes: await readStoredFile(file),
          fileName: file.originalName,
          contentType: contentTypeFor(file.originalName),
          generated: false,
        };
      } catch {
        // Исходник потерян — падать не надо, ниже соберём лист заново.
      }
    }
  }

  const svg = renderSheetSvg(sheetSubject(sheet), sheetContext(asset, sheet.sectionAuthor, ctx.organization));
  return {
    bytes: Buffer.from(svg, 'utf8'),
    fileName: sheetFileName(asset.code, sheetSubject(sheet), 'svg'),
    contentType: 'image/svg+xml; charset=utf-8',
    generated: true,
  };
}

/** Комплект листов одним архивом: по папке на раздел, плюс ведомость состава. */
export async function bundleSheets(sheets: DocSheet[], asset: Asset, ctx: { organization: string }): Promise<Buffer> {
  const entries: ZipEntry[] = [];

  const seenFiles = new Set<string>();
  for (const sheet of sheets) {
    // Листы альбома из мастерской ссылаются на один PDF — в архив он идёт один раз.
    if (sheet.fileId) {
      if (seenFiles.has(sheet.fileId)) continue;
      seenFiles.add(sheet.fileId);
    }
    const payload = await renderSheet(sheet, asset, ctx);
    entries.push({ name: `${asset.code}/${sheet.sectionCode}/${payload.fileName}`, data: payload.bytes });
  }

  const manifest = [
    `Объект: ${asset.name}`,
    `Шифр: ${asset.code}`,
    `Стадия: ${STAGE_LABELS[asset.stage]}`,
    `ГИП: ${asset.chief}`,
    `Выгружено: ${new Date().toLocaleString('ru-KZ')}`,
    '',
    'Ведомость листов:',
    ...sheets.map((s, i) => `${String(i + 1).padStart(2, '0')}  ${s.code}  ${s.name}  ${s.format}  изм. ${s.version}  от ${s.changed}`),
  ].join('\r\n');

  entries.push({ name: `${asset.code}/Ведомость чертежей.txt`, data: Buffer.from(`﻿${manifest}`, 'utf8') });

  return createZip(entries);
}

export function bundleFileName(asset: Asset, sectionCodes: string[]): string {
  const suffix = sectionCodes.length > 0 ? `_${sectionCodes.join('-')}` : '_комплект';
  return `${asset.code}${suffix}.zip`;
}
