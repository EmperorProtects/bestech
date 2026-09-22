import { notFound } from 'next/navigation';
import { ToleranceStamp } from '@bestech/ui-kit';
import { getAsset, getSensors, getTwinSummary, normalizeCode } from '@/api';
import { TwinShell } from '@/components/shell/TwinShell';
import { TwinOverview } from '@/components/twin/TwinOverview';
import { LiveBadge, LiveOverview } from '@/components/twin/LiveTwin';
import { UnderDevelopment } from '@/components/common/UnderDevelopment';
import { requireUser } from '@/lib/session';
import { isFeatureEnabled } from '@/lib/stages';
import { emulatorStatus } from '@/lib/twin/emulator';
import { buildLive, hasLiveSensors } from '@/lib/twin/live';
import { canOperateTwin } from '@/lib/twin/shared';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { code: string } }) {
  return { title: `Двойник · ${normalizeCode(params.code)} — BESTECH` };
}

/** C1. Обзор цифрового двойника: модель с датчиками, живые показания. */
export default async function TwinOverviewPage({ params }: { params: { code: string } }) {
  const user = requireUser();
  const asset = await getAsset(params.code, user.orgId);
  if (!asset) notFound();

  if (!isFeatureEnabled('twin')) {
    return (
      <TwinShell
        code={asset.code}
        headerCells={[
          { k: 'ШИФР', v: asset.code },
          { k: 'РАЗДЕЛ', v: 'ЦИФРОВОЙ ДВОЙНИК' },
          { k: 'СТАТУС', v: <span style={{ color: 'var(--bst-warn)' }}>В РАЗРАБОТКЕ</span> },
        ]}
        footerCells={[
          { k: 'ОБЪЕКТ', v: `${asset.code} · ${asset.name}` },
          { k: 'РАЗДЕЛ', v: 'Двойник · C1' },
          { k: 'СТАТУС', v: 'в разработке' },
          { k: 'СТАДИЯ', v: 'Строительство' },
          { k: 'ЛИСТ', v: 'C1 / 07' },
        ]}
      >
        <UnderDevelopment feature="twin" assetCode={asset.code} />
      </TwinShell>
    );
  }

  // Объект с датчиками в БД — живой режим по данным API приёма.
  if (hasLiveSensors(asset.code)) {
    const live = buildLive(asset.code, '24h');
    const canAct = canOperateTwin(user.role);
    if (canAct) live.emulator = emulatorStatus();

    return (
      <TwinShell
        code={asset.code}
        headerCells={[
          { k: 'ШИФР', v: asset.code },
          { k: 'СТАДИЯ', v: 'СТРОИТЕЛЬСТВО' },
          { k: 'ГИП', v: asset.chief },
          { k: 'ИСТОЧНИК', v: 'ТЕЛЕМЕТРИЯ · API ПРИЁМА' },
          { k: 'ЛИСТ', v: 'C1 / 07' },
        ]}
        headerAside={<LiveBadge code={asset.code} initial={live} />}
        footerCells={[
          { k: 'ОБЪЕКТ', v: `${asset.name} · ${asset.region}` },
          { k: 'РАЗДЕЛ', v: 'Двойник · C1' },
          { k: 'ТЕМА', v: 'Цианотипия' },
          { k: 'ДАТЧИКОВ', v: live.summary.sensorsTotal },
          { k: 'ЛИСТ', v: 'C1 / 07' },
        ]}
      >
        <LiveOverview code={asset.code} initial={live} canAct={canAct} />
      </TwinShell>
    );
  }

  const [sensors, summary] = await Promise.all([getSensors(asset.code), getTwinSummary(asset.code)]);
  if (!summary) notFound();

  return (
    <TwinShell
      code={asset.code}
      headerCells={[
        { k: 'ШИФР', v: asset.code },
        { k: 'СТАДИЯ', v: 'СТРОИТЕЛЬСТВО' },
        { k: 'ГИП', v: asset.chief },
        { k: 'ОБНОВЛЕНО', v: summary.updated },
        { k: 'ЛИСТ', v: 'C1 / 07' },
      ]}
      headerAside={
        summary.outOfTolerance > 0 ? <ToleranceStamp status="alarm" label={`${summary.outOfTolerance} АВАРИЯ`} size="lg" /> : <ToleranceStamp status="ok" label="БЕЗ АВАРИЙ" size="lg" />
      }
      footerCells={[
        { k: 'ОБЪЕКТ', v: `${asset.name} · ${asset.region}` },
        { k: 'РАЗДЕЛ', v: 'Двойник · C1' },
        { k: 'ТЕМА', v: 'Цианотипия' },
        { k: 'ОБНОВЛЕНО', v: summary.updated },
        { k: 'ЛИСТ', v: 'C1 / 07' },
      ]}
    >
      <TwinOverview code={asset.code} sensors={sensors} summary={summary} />
    </TwinShell>
  );
}
