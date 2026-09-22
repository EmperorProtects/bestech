import { NextResponse, type NextRequest } from 'next/server';
import { authenticateKey } from '@/lib/twin/ingest';

export const dynamic = 'force-dynamic';

/** Проверка связи шлюза с порталом. С ключом — ещё и то, к какому объекту он привязан. */
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const raw = auth && /^bearer\s+/i.test(auth) ? auth.replace(/^bearer\s+/i, '') : request.headers.get('x-api-key');
  const key = authenticateKey(raw);

  return NextResponse.json({
    ok: true,
    service: 'bestech-ingest',
    version: 'v1',
    server_time: new Date().toISOString(),
    authorized: Boolean(key),
    asset: key?.asset_code ?? null,
  });
}
