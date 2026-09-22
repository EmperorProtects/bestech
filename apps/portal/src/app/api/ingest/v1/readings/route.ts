import { NextResponse, type NextRequest } from 'next/server';
import { authenticateKey, ingestPacket, logRejectedPacket } from '@/lib/twin/ingest';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 1_000_000;

function deviceKey(request: NextRequest): string | null {
  const auth = request.headers.get('authorization');
  if (auth && /^bearer\s+/i.test(auth)) return auth.replace(/^bearer\s+/i, '').trim();
  return request.headers.get('x-api-key');
}

function remoteAddress(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (forwarded || request.headers.get('x-real-ip') || 'локально').slice(0, 64);
}

/**
 * Приём показаний с устройств. Сессия пользователя не нужна: устройство
 * предъявляет свой ключ, и данные попадают только в объект этого ключа.
 */
export async function POST(request: NextRequest) {
  const key = authenticateKey(deviceKey(request));
  if (!key) {
    return NextResponse.json({ error: 'Неверный или отсутствующий ключ устройства' }, { status: 401 });
  }

  const device = (request.headers.get('x-device-id') ?? 'unknown').slice(0, 64);
  const remote = remoteAddress(request);
  const text = await request.text();
  const bytes = Buffer.byteLength(text);

  if (bytes > MAX_BYTES) {
    logRejectedPacket(key, device, remote, bytes, 413, 'пакет больше 1 МБ');
    return NextResponse.json({ error: 'Пакет больше 1 МБ — разбейте на части' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    logRejectedPacket(key, device, remote, bytes, 400, 'некорректный JSON');
    return NextResponse.json({ error: 'Тело запроса — не JSON' }, { status: 400 });
  }

  const result = ingestPacket({ key, body, device, remote, bytes });
  return NextResponse.json(result.body, { status: result.status });
}
