import { notFound } from 'next/navigation';
import { EmptyState } from '@bestech/ui-kit';
import { getAsset, normalizeCode } from '@/api';
import { TwinShell } from '@/components/shell/TwinShell';
import { AlarmsPanel } from '@/components/twin/AlarmsPanel';
import { LiveBadge } from '@/components/twin/LiveTwin';
import { UnderDevelopment } from '@/components/common/UnderDevelopment';
import { requireUser } from '@/lib/session';
import { isFeatureEnabled } from '@/lib/stages';
import { buildLive, hasLiveSensors } from '@/lib/twin/live';
import { canOperateTwin } from '@/lib/twin/shared';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { code: string } }) {
  return { title: `Аварии · ${normalizeCode(params.code)} — BESTECH` };
}

/** C5. Очередь аварий и инцидентов по телеметрии. */
export default async function AlarmsPage({ params, searchParams }: { params: { code: string }; searchParams: { alarm?: string } }) {
  const user = requireUser();
  const asset = await getAsset(params.code, user.orgId);
  if (!asset) notFound();

  const header = [
    { k: 'ШИФР', v: asset.code },
    { k: 'ОЧЕРЕДЬ', v: 'АВАРИИ И ИНЦИДЕНТЫ' },
    { k: 'СОЗДАНИЕ', v: 'АВТОМАТИЧЕСКИ ПО ТЕЛЕМЕТРИИ' },
  ];
  const footer = [
    { k: 'ОБЪЕКТ', v: asset.name },
    { k: 'РАЗДЕЛ', v: 'Двойник · C5' },
    { k: 'ТЕМА', v: 'Цианотипия' },
    { k: 'ПОЛЬЗОВАТЕЛЬ', v: user.name },
    { k: 'ЛИСТ', v: 'C5 / 07' },
  ];

  if (!isFeatureEnabled('alarms')) {
    return (
      <TwinShell code={asset.code} headerCells={header} footerCells={footer}>
        <UnderDevelopment feature="alarms" assetCode={asset.code} />
      </TwinShell>
    );
  }

  if (!hasLiveSensors(asset.code)) {
    return (
      <TwinShell code={asset.code} headerCells={header} footerCells={footer}>
        <div className="page">
          <EmptyState title="Датчики объекта не подключены" note="Аварии создаются по телеметрии: подключите шлюз объекта к API приёма данных." />
        </div>
      </TwinShell>
    );
  }

  const live = buildLive(asset.code, '24h');

  return (
    <TwinShell code={asset.code} headerCells={header} headerAside={<LiveBadge code={asset.code} initial={live} />} footerCells={footer}>
      <AlarmsPanel
        code={asset.code}
        initial={live}
        canAct={canOperateTwin(user.role)}
        {...(searchParams.alarm ? { initialAlarmId: searchParams.alarm } : {})}
      />
    </TwinShell>
  );
}
