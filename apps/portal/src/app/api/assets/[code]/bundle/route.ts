import { NextResponse, type NextRequest } from 'next/server';
import { getAsset, getDocSheets } from '@/api';
import { getCurrentUser } from '@/lib/session';
import { bundleFileName, bundleSheets } from '@/lib/drawings';
import { contentDisposition } from '@/lib/storage';
import { isFeatureEnabled } from '@/lib/stages';

export const dynamic = 'force-dynamic';

/**
 * Комплект чертежей одним ZIP-архивом.
 * `?sections=АР,КМ` — только выбранные разделы, без параметра — весь комплект.
 */
export async function GET(request: NextRequest, { params }: { params: { code: string } }) {
  const user = getCurrentUser();
  if (!user) return new NextResponse('Требуется вход', { status: 401 });
  if (!isFeatureEnabled('drawings')) return new NextResponse('Раздел в разработке', { status: 403 });

  const asset = await getAsset(params.code, user.orgId);
  if (!asset) return new NextResponse('Объект не найден', { status: 404 });

  const requested = (request.nextUrl.searchParams.get('sections') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const all = await getDocSheets(asset.code);
  const sheets = requested.length > 0 ? all.filter((s) => requested.includes(s.sectionCode)) : all;

  if (sheets.length === 0) {
    return new NextResponse('В выбранных разделах нет выпущенных листов', { status: 404 });
  }

  const zip = await bundleSheets(sheets, asset, { organization: user.orgName });
  const name = bundleFileName(asset, requested);

  return new NextResponse(new Uint8Array(zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(zip.length),
      'Content-Disposition': contentDisposition(name),
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  });
}
