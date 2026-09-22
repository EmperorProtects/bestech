'use server';

import { randomUUID } from 'node:crypto';
import { copyFile } from 'node:fs/promises';
import path from 'node:path';
import { revalidatePath } from 'next/cache';
import { getAsset, recalcCompleteness } from '@/api';
import { all, one, run, transaction } from '@/db/client';
import { requireUser } from '@/lib/session';
import { MAX_FILE_SIZE, decodeFileName, filePath, formatFileSize, isAllowedFile, saveUpload } from '@/lib/storage';
import { WORKSPACE_DIR, getLinkedProject, inputFileName, uniqueInputPath } from '@/lib/workspace';
import { isFeatureEnabled } from '@/lib/stages';

export interface UploadState {
  error?: string;
  uploaded?: string[];
}

const TODAY = () =>
  new Date().toLocaleDateString('ru-KZ', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');

function logActivity(orgId: string, userId: string, assetCode: string, action: string, detail: string): void {
  run('INSERT INTO activity (id, org_id, user_id, asset_code, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    randomUUID(), orgId, userId, assetCode, action, detail, new Date().toISOString());
}

/** Обновляет процент комплектности после любого изменения состава документов. */
function syncCompleteness(assetCode: string): void {
  const percent = recalcCompleteness(assetCode);
  const exists = one<{ asset_code: string }>('SELECT asset_code FROM completeness WHERE asset_code = ?', assetCode);
  if (exists) {
    run('UPDATE completeness SET percent = ? WHERE asset_code = ?', percent, assetCode);
  } else {
    run('INSERT INTO completeness (asset_code, percent) VALUES (?, ?)', assetCode, percent);
  }
}

/**
 * Загрузка исходных данных. Файлы кладутся в хранилище и привязываются к
 * строкам ведомости: если указан `docId` — к нему, иначе по очереди к
 * документам, которые ещё не приняты.
 *
 * Загруженный документ переходит в состояние «на проверке»: принимает его
 * инженер, а не портал.
 */
export async function uploadInputFiles(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const user = requireUser();
  if (!isFeatureEnabled('inputs')) return { error: 'Раздел исходных данных в разработке.' };

  const assetCode = String(formData.get('assetCode') ?? '');
  const docId = formData.get('docId');
  const asset = await getAsset(assetCode, user.orgId);
  if (!asset) return { error: 'Объект не найден.' };

  const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: 'Файлы не выбраны.' };

  for (const file of files) {
    const name = decodeFileName(file.name);
    if (!isAllowedFile(name)) {
      return { error: `Формат файла «${name}» не поддерживается.` };
    }
    if (file.size > MAX_FILE_SIZE) {
      return { error: `Файл «${name}» больше ${formatFileSize(MAX_FILE_SIZE)}.` };
    }
  }

  // Целевые строки ведомости: либо конкретная, либо все ещё не принятые.
  const targets =
    typeof docId === 'string' && docId
      ? all<{ id: string }>('SELECT id FROM input_docs WHERE id = ? AND asset_code = ?', docId, assetCode)
      : all<{ id: string }>(
          `SELECT id FROM input_docs
            WHERE asset_code = ? AND state <> 'accepted'
            ORDER BY CASE state WHEN 'missing' THEN 0 WHEN 'requested' THEN 1 ELSE 2 END, sort`,
          assetCode,
        );

  const uploaded: string[] = [];
  // Объект из мастерской: файл должен лечь туда, где его увидит Claude.
  const linked = getLinkedProject(assetCode);

  for (const [index, file] of files.entries()) {
    const saved = await saveUpload(file, { assetCode, kind: 'input', userId: user.id });
    const target = targets[index];

    if (linked) {
      const rel = uniqueInputPath(inputFileName(linked.shifr, saved.originalName));
      await copyFile(filePath(saved.storedName), path.join(WORKSPACE_DIR, rel));
      run('UPDATE files SET external_path = ? WHERE id = ?', rel, saved.id);
    }

    transaction(() => {
      if (target) {
        run(
          "UPDATE input_docs SET file_id = ?, file_name = ?, date = ?, state = 'review' WHERE id = ?",
          saved.id,
          saved.originalName,
          TODAY(),
          target.id,
        );
      } else {
        run(
          "INSERT INTO input_docs (id, asset_code, code, title, file_id, file_name, date, state, sort) VALUES (?, ?, 'ИД', 'Исходные данные', ?, ?, ?, 'review', 1000)",
          randomUUID(),
          assetCode,
          saved.id,
          saved.originalName,
          TODAY(),
        );
      }
      logActivity(user.orgId, user.id, assetCode, 'upload', `${saved.originalName} · ${formatFileSize(saved.size)}`);
    });

    uploaded.push(saved.originalName);
  }

  syncCompleteness(assetCode);
  revalidatePath(`/cabinet/assets/${assetCode}/inputs`);
  revalidatePath(`/cabinet/assets/${assetCode}`);

  return { uploaded };
}

/** Запрос недостающих документов у заказчика: «не загружено» → «запрошено». */
export async function requestMissingDocs(assetCode: string): Promise<void> {
  const user = requireUser();
  const asset = await getAsset(assetCode, user.orgId);
  if (!asset || !isFeatureEnabled('inputs')) return;

  run("UPDATE input_docs SET state = 'requested' WHERE asset_code = ? AND state = 'missing'", assetCode);
  logActivity(user.orgId, user.id, assetCode, 'request', 'запрошены недостающие исходные данные');

  syncCompleteness(assetCode);
  revalidatePath(`/cabinet/assets/${assetCode}/inputs`);
}
