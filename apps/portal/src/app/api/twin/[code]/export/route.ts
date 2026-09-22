import { NextResponse, type NextRequest } from 'next/server';
import { getAsset } from '@/api';
import { all } from '@/db/client';
import { getCurrentUser } from '@/lib/session';
import { isFeatureEnabled } from '@/lib/stages';
import { contentDisposition } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/** Показания датчиков за сутки в CSV (разделитель «;», BOM — чтобы Excel открыл кириллицу). */
export async function GET(_request: NextRequest, { params }: { params: { code: string } }) {
  const user = getCurrentUser();
  if (!user) return new NextResponse('Требуется вход', { status: 401 });
  if (!isFeatureEnabled('telemetry')) return new NextResponse('Раздел в разработке', { status: 403 });

  const asset = await getAsset(params.code, user.orgId);
  if (!asset) return new NextResponse('Объект не найден', { status: 404 });

  const rows = all<{ ts: string; code: string; name: string; value: number; unit: string }>(
    `SELECT r.ts, s.code, s.name, r.value, s.unit
       FROM sensor_readings r JOIN sensors s ON s.id = r.sensor_id
      WHERE s.asset_code = ? AND r.ts >= ?
      ORDER BY r.ts, s.sort`,
    asset.code,
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  );

  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [
    'время;датчик;параметр;значение;единица',
    ...rows.map((r) => [new Date(r.ts).toLocaleString('ru-RU'), r.code, r.name, String(Number(r.value)).replace('.', ','), r.unit].map(esc).join(';')),
  ];
  const body = `﻿${lines.join('\r\n')}`;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': contentDisposition(`${asset.code}_телеметрия_24ч.csv`),
      'Cache-Control': 'no-store',
    },
  });
}
