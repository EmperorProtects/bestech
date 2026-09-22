import { NextResponse, type NextRequest } from 'next/server';
import { all } from '@/db/client';
import { authenticateKey } from '@/lib/twin/ingest';
import { evaluate, staleAfterMs, type SensorRow } from '@/lib/twin/model';

export const dynamic = 'force-dynamic';

/** Конфигурация для шлюза: какие датчики объекта ждёт портал и с каким периодом. */
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const raw = auth && /^bearer\s+/i.test(auth) ? auth.replace(/^bearer\s+/i, '') : request.headers.get('x-api-key');
  const key = authenticateKey(raw);
  if (!key) return NextResponse.json({ error: 'Неверный или отсутствующий ключ устройства' }, { status: 401 });

  const sensors = all<SensorRow>('SELECT * FROM sensors WHERE asset_code = ? ORDER BY sort', key.asset_code);
  const now = Date.now();

  return NextResponse.json({
    asset: key.asset_code,
    sensors: sensors.map((s) => {
      const stale = !s.last_ts || now - Date.parse(s.last_ts) > staleAfterMs(s);
      return {
        code: s.code,
        name: s.name,
        discipline: s.discipline,
        kind: s.kind,
        unit: s.unit,
        decimals: Number(s.decimals),
        interval: Number(s.interval_s),
        thresholds: { warn_low: s.warn_low, warn_high: s.warn_high, alarm_low: s.alarm_low, alarm_high: s.alarm_high },
        // Текущее значение — чтобы пульт открывался с актуальными цифрами, а не с нулями.
        last_value: s.last_value === null ? null : Number(s.last_value),
        last_ts: s.last_ts,
        state: stale ? 'offline' : evaluate(s, Number(s.last_value)),
      };
    }),
  });
}
