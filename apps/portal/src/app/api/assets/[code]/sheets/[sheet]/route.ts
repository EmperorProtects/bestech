import { NextResponse, type NextRequest } from 'next/server';
import { getAsset, getSheet } from '@/api';
import { getCurrentUser } from '@/lib/session';
import { renderSheet } from '@/lib/drawings';
import { contentDisposition } from '@/lib/storage';
import { isFeatureEnabled } from '@/lib/stages';

export const dynamic = 'force-dynamic';

/**
 * Один лист чертежа: `?download=1` — скачать файлом, без параметра — показать
 * во встроенном просмотрщике.
 */
export async function GET(request: NextRequest, { params }: { params: { code: string; sheet: string } }) {
  const user = getCurrentUser();
  if (!user) return new NextResponse('Требуется вход', { status: 401 });
  if (!isFeatureEnabled('drawings')) return new NextResponse('Раздел в разработке', { status: 403 });

  const asset = await getAsset(params.code, user.orgId);
  if (!asset) return new NextResponse('Объект не найден', { status: 404 });

  const sheet = await getSheet(asset.code, decodeURIComponent(params.sheet));
  if (!sheet) return new NextResponse('Лист не найден', { status: 404 });

  const payload = await renderSheet(sheet, asset, { organization: user.orgName });
  const download = request.nextUrl.searchParams.get('download') === '1';

  return new NextResponse(new Uint8Array(payload.bytes), {
    headers: {
      'Content-Type': payload.contentType,
      'Content-Length': String(payload.bytes.length),
      'Content-Disposition': contentDisposition(payload.fileName, !download),
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  });
}
