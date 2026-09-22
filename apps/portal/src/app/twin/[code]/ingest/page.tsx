import os from 'node:os';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { EmptyState } from '@bestech/ui-kit';
import { getAsset, normalizeCode } from '@/api';
import { TwinShell } from '@/components/shell/TwinShell';
import { IngestPanel } from '@/components/twin/IngestPanel';
import { LiveBadge } from '@/components/twin/LiveTwin';
import { UnderDevelopment } from '@/components/common/UnderDevelopment';
import { requireUser } from '@/lib/session';
import { isFeatureEnabled } from '@/lib/stages';
import { DEMO_ASSET, DEMO_INGEST_KEY } from '@/lib/twin/catalog';
import { emulatorStatus } from '@/lib/twin/emulator';
import { buildLive, hasLiveSensors } from '@/lib/twin/live';
import { canOperateTwin } from '@/lib/twin/shared';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { code: string } }) {
  return { title: `Приём данных · ${normalizeCode(params.code)} — BESTECH` };
}

/** Адреса этой машины в локальной сети — шлюз или ноутбук в той же сети шлёт показания на них. */
function lanAddresses(port: string): string[] {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i): i is os.NetworkInterfaceInfo => Boolean(i && i.family === 'IPv4' && !i.internal))
    .map((i) => `http://${i.address}:${port}/api/ingest/v1/readings`)
    .slice(0, 3);
}

/** C4. Приём данных: входящие пакеты, точка приёма для шлюзов, эмулятор демо-стенда. */
export default async function IngestPage({ params }: { params: { code: string } }) {
  const user = requireUser();
  const asset = await getAsset(params.code, user.orgId);
  if (!asset) notFound();

  const header = [
    { k: 'ШИФР', v: asset.code },
    { k: 'РАЗДЕЛ', v: 'ПРИЁМ ДАННЫХ' },
    { k: 'ПРОТОКОЛ', v: 'HTTP · JSON · v1' },
  ];
  const footer = [
    { k: 'ОБЪЕКТ', v: asset.name },
    { k: 'РАЗДЕЛ', v: 'Двойник · C4' },
    { k: 'ТЕМА', v: 'Цианотипия' },
    { k: 'ПОЛЬЗОВАТЕЛЬ', v: user.name },
    { k: 'ЛИСТ', v: 'C4 / 07' },
  ];

  if (!isFeatureEnabled('telemetry')) {
    return (
      <TwinShell code={asset.code} headerCells={header} footerCells={footer}>
        <UnderDevelopment feature="telemetry" assetCode={asset.code} />
      </TwinShell>
    );
  }

  if (!hasLiveSensors(asset.code)) {
    return (
      <TwinShell code={asset.code} headerCells={header} footerCells={footer}>
        <div className="page">
          <EmptyState title="Датчики объекта не зарегистрированы" note="Чтобы принимать показания, датчики заводятся в реестр объекта и получают ключ шлюза." />
        </div>
      </TwinShell>
    );
  }

  const h = headers();
  const host = h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const port = host.includes(':') ? host.split(':').pop()! : proto === 'https' ? '443' : '80';

  const canControl = canOperateTwin(user.role) && asset.code === DEMO_ASSET;
  const live = buildLive(asset.code, '24h');
  if (canOperateTwin(user.role)) live.emulator = emulatorStatus();

  return (
    <TwinShell code={asset.code} headerCells={header} headerAside={<LiveBadge code={asset.code} initial={live} />} footerCells={footer}>
      <IngestPanel
        code={asset.code}
        initial={live}
        canControl={canControl}
        endpoint={`${proto}://${host}/api/ingest/v1/readings`}
        lanEndpoints={lanAddresses(port)}
        demoKey={canControl ? DEMO_INGEST_KEY : null}
      />
    </TwinShell>
  );
}
