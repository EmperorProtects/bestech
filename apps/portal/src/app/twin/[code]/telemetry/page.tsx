import { notFound } from 'next/navigation';
import { Button, ButtonLink } from '@bestech/ui-kit';
import { getAsset, getSensors, getTelemetry, getTwinSummary, normalizeCode } from '@/api';
import { TwinShell } from '@/components/shell/TwinShell';
import { TelemetryPanel } from '@/components/twin/TelemetryPanel';
import { LiveBadge, LiveTelemetry } from '@/components/twin/LiveTwin';
import { UnderDevelopment } from '@/components/common/UnderDevelopment';
import { requireUser } from '@/lib/session';
import { isFeatureEnabled } from '@/lib/stages';
import { buildLive, hasLiveSensors } from '@/lib/twin/live';
import { canOperateTwin } from '@/lib/twin/shared';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { code: string } }) {
  return { title: `Телеметрия · ${normalizeCode(params.code)} — BESTECH` };
}

/** C3. Временные ряды приборов. */
export default async function TelemetryPage({ params }: { params: { code: string } }) {
  const user = requireUser();
  const asset = await getAsset(params.code, user.orgId);
  if (!asset) notFound();

  if (!isFeatureEnabled('telemetry')) {
    return (
      <TwinShell
        code={asset.code}
        headerCells={[
          { k: 'ШИФР', v: asset.code },
          { k: 'РАЗДЕЛ', v: 'ТЕЛЕМЕТРИЯ' },
          { k: 'СТАТУС', v: <span style={{ color: 'var(--bst-warn)' }}>В РАЗРАБОТКЕ</span> },
        ]}
        footerCells={[
          { k: 'ОБЪЕКТ', v: `${asset.code} · ${asset.name}` },
          { k: 'РАЗДЕЛ', v: 'Двойник · C3' },
          { k: 'СТАТУС', v: 'в разработке' },
          { k: 'СТАДИЯ', v: 'Строительство' },
          { k: 'ЛИСТ', v: 'C3 / 07' },
        ]}
      >
        <UnderDevelopment feature="telemetry" assetCode={asset.code} />
      </TwinShell>
    );
  }

  if (hasLiveSensors(asset.code)) {
    // Стор телеметрии по умолчанию на периоде «30d» — в живом режиме это окно в 1 час.
    const live = buildLive(asset.code, '30d');
    return (
      <TwinShell
        code={asset.code}
        headerCells={[
          { k: 'ШИФР', v: asset.code },
          { k: 'РАЗДЕЛ', v: 'ТЕЛЕМЕТРИЯ' },
          { k: 'ПРИБОРОВ', v: `${live.summary.sensorsOnline} / ${live.summary.sensorsTotal} на связи` },
          { k: 'ИСТОЧНИК', v: 'API ПРИЁМА' },
        ]}
        headerAside={
          <>
            <ButtonLink href={`/api/twin/${encodeURIComponent(asset.code)}/export`} size="sm">
              Экспорт CSV
            </ButtonLink>
            <LiveBadge code={asset.code} initial={live} />
          </>
        }
        footerCells={[
          { k: 'ОБЪЕКТ', v: asset.name },
          { k: 'РАЗДЕЛ', v: 'Двойник · C3' },
          { k: 'ТЕМА', v: 'Цианотипия' },
          { k: 'ДАТЧИКОВ', v: live.summary.sensorsTotal },
          { k: 'ЛИСТ', v: 'C3 / 07' },
        ]}
      >
        <LiveTelemetry code={asset.code} initial={live} canAct={canOperateTwin(user.role)} />
      </TwinShell>
    );
  }

  const [charts, sensors, summary] = await Promise.all([getTelemetry(asset.code), getSensors(asset.code), getTwinSummary(asset.code)]);
  if (!summary) notFound();

  return (
    <TwinShell
      code={asset.code}
      headerCells={[
        { k: 'ШИФР', v: asset.code },
        { k: 'РАЗДЕЛ', v: 'ТЕЛЕМЕТРИЯ' },
        { k: 'ПРИБОРОВ', v: `${summary.sensorsOnline} / ${summary.sensorsTotal} на связи` },
        { k: 'ПОСЛЕДНИЙ ПАКЕТ', v: summary.updated },
      ]}
      headerAside={
        <>
          <Button size="sm">Экспорт CSV</Button>
          <Button size="sm">Пороги</Button>
        </>
      }
      footerCells={[
        { k: 'ОБЪЕКТ', v: asset.name },
        { k: 'РАЗДЕЛ', v: 'Двойник · C3' },
        { k: 'ТЕМА', v: 'Цианотипия' },
        { k: 'ОБНОВЛЕНО', v: summary.updated },
        { k: 'ЛИСТ', v: 'C3 / 07' },
      ]}
    >
      <TelemetryPanel charts={charts} sensors={sensors} />
    </TwinShell>
  );
}
