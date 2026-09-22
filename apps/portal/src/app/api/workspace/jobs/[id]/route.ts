import { NextResponse, type NextRequest } from 'next/server';
import { getAsset } from '@/api';
import { getCurrentUser } from '@/lib/session';
import { getJob, stopJob } from '@/lib/workspace-jobs';

export const dynamic = 'force-dynamic';

async function authorizedJob(id: string) {
  const user = getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Требуется вход' }, { status: 401 }) } as const;
  const job = getJob(id);
  // Задание чужой организации неотличимо от несуществующего.
  if (!job || !(await getAsset(job.assetCode, user.orgId))) {
    return { error: NextResponse.json({ error: 'Задание не найдено' }, { status: 404 }) } as const;
  }
  return { user, job } as const;
}

/** Состояние и журнал задания — опрашивается панелью мастерской. */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const r = await authorizedJob(params.id);
  if ('error' in r) return r.error;
  return NextResponse.json({ job: r.job });
}

/** Остановка задания. */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const r = await authorizedJob(params.id);
  if ('error' in r) return r.error;
  if (r.user.role !== 'engineer') return NextResponse.json({ error: 'Останавливать задания могут только проектировщики' }, { status: 403 });
  return NextResponse.json({ stopped: await stopJob(params.id) });
}
