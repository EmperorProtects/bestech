'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { run } from '@/db/client';
import { requireUser } from '@/lib/session';
import { decodeFileName } from '@/lib/storage';
import { SHIFR_STRICT, createProjectFiles, getLinkedProject, syncWorkspace, workspaceAvailable } from '@/lib/workspace';
import { JobError, startJob } from '@/lib/workspace-jobs';

export interface NewProjectState {
  error?: string;
}

const TZ_EXTENSIONS = ['.md', '.txt', '.pdf', '.docx', '.doc'];
const MAX_TZ_SIZE = 50 * 1024 * 1024;

/**
 * Новый проект по ТЗ: ТЗ пишется в мастерскую, объект появляется в кабинете
 * синхронизацией, по желанию сразу стартует задание «Проект по ТЗ».
 */
export async function createProject(_prev: NewProjectState, formData: FormData): Promise<NewProjectState> {
  const user = requireUser();
  if (user.role !== 'engineer') return { error: 'Создавать проекты могут только проектировщики.' };
  if (!workspaceAvailable()) return { error: 'Мастерская newExport недоступна на этом сервере.' };

  const text = (k: string, max: number) => String(formData.get(k) ?? '').trim().slice(0, max);
  const shifr = text('shifr', 20).toUpperCase().replace(/[‐-―]/g, '-');
  const object = text('object', 200);
  const brief = text('brief', 20_000);

  if (!SHIFR_STRICT.test(shifr)) return { error: 'Шифр должен быть вида 422-2026-АР.' };

  const file = formData.get('tz');
  let attachment: { name: string; bytes: Buffer } | null = null;
  if (file instanceof File && file.size > 0) {
    const name = decodeFileName(file.name);
    const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
    if (!TZ_EXTENSIONS.includes(ext)) return { error: 'ТЗ принимается в MD, TXT, PDF или DOCX.' };
    if (file.size > MAX_TZ_SIZE) return { error: 'Файл ТЗ больше 50 МБ.' };
    attachment = { name, bytes: Buffer.from(await file.arrayBuffer()) };
  }

  if (!object && !attachment) return { error: 'Укажите объект или приложите файл ТЗ.' };
  if (!brief && !attachment) return { error: 'Опишите задание или приложите файл ТЗ — Claude нужно, из чего проектировать.' };

  try {
    createProjectFiles({
      shifr,
      object,
      stage: text('stage', 80),
      place: text('place', 200),
      customer: text('customer', 200),
      brief,
      author: user.name,
      attachment,
    });
  } catch (error) {
    return { error: (error as Error).message };
  }

  syncWorkspace(true);
  const project = getLinkedProject(shifr);
  if (!project) return { error: 'ТЗ записано, но проект не подхватился синхронизацией — проверьте папку мастерской.' };

  run('INSERT INTO activity (id, org_id, user_id, asset_code, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    randomUUID(), user.orgId, user.id, shifr, 'project-create', object || shifr, new Date().toISOString());

  let query = '';
  if (formData.get('startNow') === 'on') {
    try {
      const job = await startJob({ project, preset: 'project', extra: '', continueSession: false, user: { id: user.id, name: user.name, orgId: user.orgId } });
      query = `?job=${job.id}`;
    } catch (error) {
      const message = error instanceof JobError ? error.message : 'не удалось запустить задание';
      query = `?notice=${encodeURIComponent(`Проект создан, но задание не запущено: ${message}`)}`;
    }
  }

  redirect(`/cabinet/assets/${encodeURIComponent(shifr)}/workspace${query}`);
}
