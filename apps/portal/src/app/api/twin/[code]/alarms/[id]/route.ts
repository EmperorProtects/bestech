import { NextResponse, type NextRequest } from 'next/server';
import { getAsset } from '@/api';
import { getCurrentUser } from '@/lib/session';
import { actOnAlarm } from '@/lib/twin/alarms';
import { canOperateTwin } from '@/lib/twin/shared';

export const dynamic = 'force-dynamic';

/** Квитирование или ручное закрытие аварии: `{ "action": "ack" | "close" }`. */
export async function POST(request: NextRequest, { params }: { params: { code: string; id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 });
  if (!canOperateTwin(user.role)) return NextResponse.json({ error: 'Действия с авариями — у технадзора и проектировщиков' }, { status: 403 });

  const asset = await getAsset(params.code, user.orgId);
  if (!asset) return NextResponse.json({ error: 'Объект не найден' }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { action?: string };
  if (body.action !== 'ack' && body.action !== 'close') {
    return NextResponse.json({ error: 'action: ack или close' }, { status: 400 });
  }

  const ok = actOnAlarm(asset.code, params.id, body.action, user.name);
  return NextResponse.json({ ok }, { status: ok ? 200 : 409 });
}
