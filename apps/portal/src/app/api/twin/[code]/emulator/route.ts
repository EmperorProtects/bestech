import { NextResponse, type NextRequest } from 'next/server';
import { getAsset } from '@/api';
import { getCurrentUser } from '@/lib/session';
import { DEMO_ASSET } from '@/lib/twin/catalog';
import { emulatorStatus, resetDemoData, setScenario, startEmulator, stopEmulator } from '@/lib/twin/emulator';
import { SCENARIOS, canOperateTwin, type ScenarioId } from '@/lib/twin/shared';

export const dynamic = 'force-dynamic';

/** Управление эмулятором датчиков: `{ "action": "start" | "stop" | "scenario", "scenario": "load" }`. */
export async function POST(request: NextRequest, { params }: { params: { code: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 });
  if (!canOperateTwin(user.role)) return NextResponse.json({ error: 'Эмулятором управляют технадзор и проектировщики' }, { status: 403 });

  const asset = await getAsset(params.code, user.orgId);
  if (!asset) return NextResponse.json({ error: 'Объект не найден' }, { status: 404 });
  if (asset.code !== DEMO_ASSET) return NextResponse.json({ error: `Эмулятор настроен на объект ${DEMO_ASSET}` }, { status: 409 });

  const body = (await request.json().catch(() => ({}))) as { action?: string; scenario?: string };

  if (body.action === 'start') {
    // Эмулятор — процесс на этой же машине: адрес портала для него подбирается среди локальных.
    return NextResponse.json({ emulator: await startEmulator(request.nextUrl) });
  }
  if (body.action === 'stop') return NextResponse.json({ emulator: stopEmulator() });
  if (body.action === 'reset') return NextResponse.json({ emulator: resetDemoData(asset.code) });
  if (body.action === 'scenario' && SCENARIOS.some((s) => s.id === body.scenario)) {
    return NextResponse.json({ emulator: setScenario(body.scenario as ScenarioId) });
  }
  return NextResponse.json({ error: 'action: start, stop, reset или scenario', emulator: emulatorStatus() }, { status: 400 });
}
