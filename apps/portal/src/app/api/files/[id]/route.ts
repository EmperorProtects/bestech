import { NextResponse, type NextRequest } from 'next/server';
import { getAsset, getFile } from '@/api';
import { getCurrentUser } from '@/lib/session';
import { contentDisposition, contentTypeFor, readStoredFile } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/**
 * Отдача загруженного файла. Доступ — только своей организации: файл привязан к
 * объекту, объект к организации, организация к пользователю.
 *
 * `?inline=1` — открыть в браузере (просмотр PDF), иначе скачивание.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return new NextResponse('Требуется вход', { status: 401 });

  const file = getFile(params.id);
  if (!file) return new NextResponse('Файл не найден', { status: 404 });

  const asset = await getAsset(file.assetCode, user.orgId);
  if (!asset) return new NextResponse('Файл не найден', { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await readStoredFile(file);
  } catch {
    return new NextResponse('Файл отсутствует в хранилище', { status: 410 });
  }

  const inline = request.nextUrl.searchParams.get('inline') === '1';
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': contentTypeFor(file.originalName),
      'Content-Length': String(bytes.length),
      'Content-Disposition': contentDisposition(file.originalName, inline),
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  });
}
