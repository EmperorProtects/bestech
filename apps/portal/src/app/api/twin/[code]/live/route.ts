import { NextResponse, type NextRequest } from 'next/server';
import { getAsset } from '@/api';
import { getCurrentUser } from '@/lib/session';
import { isFeatureEnabled } from '@/lib/stages';
import { emulatorStatus } from '@/lib/twin/emulator';
import { buildLive } from '@/lib/twin/live';
import { canOperateTwin, isLivePeriod } from '@/lib/twin/shared';

export const dynamic = 'force-dynamic';

/** Снимок двойника для живого опроса экранов: датчики, графики, аварии, пакеты. */
export async function GET(request: NextRequest, { params }: { params: { code: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 });
  if (!isFeatureEnabled('telemetry')) return NextResponse.json({ error: 'Раздел в разработке' }, { status: 403 });

  const asset = await getAsset(params.code, user.orgId);
  if (!asset) return NextResponse.json({ error: 'Объект не найден' }, { status: 404 });

  const requested = request.nextUrl.searchParams.get('period');
  const live = buildLive(asset.code, isLivePeriod(requested) ? requested : '24h');
  if (canOperateTwin(user.role)) live.emulator = emulatorStatus();

  return NextResponse.json(live, { headers: { 'Cache-Control': 'no-store' } });
}
