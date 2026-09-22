import { NextResponse, type NextRequest } from 'next/server';
import { getAsset } from '@/api';
import { getCurrentUser } from '@/lib/session';
import { isFeatureEnabled } from '@/lib/stages';
import { getLinkedProject } from '@/lib/workspace';
import { JobError, listJobs, startJob, type PresetId } from '@/lib/workspace-jobs';

export const dynamic = 'force-dynamic';

/** Список заданий объекта: `?asset=421-2026-ЭП`. */
export async function GET(request: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 });

  const code = request.nextUrl.searchParams.get('asset') ?? '';
  const asset = await getAsset(code, user.orgId);
  if (!asset) return NextResponse.json({ error: 'Объект не найден' }, { status: 404 });

  // Журнал в списке не нужен — он тяжёлый и тянется отдельно по id.
  return NextResponse.json({ jobs: listJobs(asset.code).map(({ log: _log, prompt: _prompt, ...rest }) => rest) });
}

/** Запуск задания. Только ГИП и инженеры: задание меняет модель и файлы мастерской. */
export async function POST(request: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 });
  if (user.role !== 'engineer') return NextResponse.json({ error: 'Запуск заданий доступен только проектировщикам' }, { status: 403 });
  if (!isFeatureEnabled('workspace')) return NextResponse.json({ error: 'Раздел в разработке' }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { asset?: string; preset?: PresetId; extra?: string; continueSession?: boolean };
  const asset = await getAsset(body.asset ?? '', user.orgId);
  if (!asset) return NextResponse.json({ error: 'Объект не найден' }, { status: 404 });

  const project = getLinkedProject(asset.code);
  if (!project) return NextResponse.json({ error: 'Объект не связан с мастерской' }, { status: 409 });

  try {
    const job = await startJob({
      project,
      preset: body.preset ?? 'verify',
      extra: String(body.extra ?? '').slice(0, 4000),
      continueSession: Boolean(body.continueSession),
      user: { id: user.id, name: user.name, orgId: user.orgId },
    });
    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    if (error instanceof JobError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
