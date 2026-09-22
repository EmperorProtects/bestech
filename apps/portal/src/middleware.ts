import { NextResponse, type NextRequest } from 'next/server';

/**
 * Быстрый отсев неавторизованных: middleware работает в Edge-рантайме и до
 * SQLite не дотягивается, поэтому здесь проверяется только наличие cookie.
 * Настоящая проверка сессии — в `requireUser()` на каждой защищённой странице
 * и в обработчиках маршрутов, так что подделанная cookie ничего не даёт.
 */
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has('bestech.sid');
  const { pathname, search } = request.nextUrl;

  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Всё, кроме входа, приёма данных с устройств (там ключ устройства), статики Next и favicon.
  matcher: ['/((?!login|api/ingest|_next/static|_next/image|favicon.ico).*)'],
};
