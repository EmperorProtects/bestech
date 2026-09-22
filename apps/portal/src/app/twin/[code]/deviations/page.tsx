import { notFound } from 'next/navigation';
import { Button } from '@bestech/ui-kit';
import { getAsset, getDeviations, getTwinSummary, normalizeCode } from '@/api';
import { TwinShell } from '@/components/shell/TwinShell';
import { DeviationsPanel } from '@/components/twin/DeviationsPanel';
import { UnderDevelopment } from '@/components/common/UnderDevelopment';
import { requireUser } from '@/lib/session';
import { isFeatureEnabled } from '@/lib/stages';

export async function generateMetadata({ params }: { params: { code: string } }) {
  return { title: `Факт / проект · ${normalizeCode(params.code)} — BESTECH` };
}

/** C2. Сравнение фактических и проектных параметров. Стадия «Строительство» — закрыто флагом. */
export default async function DeviationsPage({ params }: { params: { code: string } }) {
  const user = requireUser();
  const asset = await getAsset(params.code, user.orgId);
  if (!asset) notFound();

  if (!isFeatureEnabled('deviations')) {
    return (
      <TwinShell
        code={asset.code}
        headerCells={[
          { k: 'ШИФР', v: asset.code },
          { k: 'РАЗДЕЛ', v: 'ФАКТ / ПРОЕКТ' },
          { k: 'СТАТУС', v: <span style={{ color: 'var(--bst-warn)' }}>В РАЗРАБОТКЕ</span> },
        ]}
        footerCells={[
          { k: 'ОБЪЕКТ', v: `${asset.code} · ${asset.name}` },
          { k: 'РАЗДЕЛ', v: 'Двойник · C2' },
          { k: 'СТАТУС', v: 'в разработке' },
          { k: 'СТАДИЯ', v: 'Строительство' },
          { k: 'ЛИСТ', v: 'C2 / 07' },
        ]}
      >
        <UnderDevelopment feature="deviations" assetCode={asset.code} />
      </TwinShell>
    );
  }

  const [deviations, summary] = await Promise.all([getDeviations(asset.code), getTwinSummary(asset.code)]);
  if (!summary) notFound();
  const off = deviations.filter((d) => d.state !== 'ok').length;

  return (
    <TwinShell
      code={asset.code}
      headerCells={[
        { k: 'ШИФР', v: asset.code },
        { k: 'СРАВНЕНИЕ', v: 'ФАКТ / ПРОЕКТ' },
        { k: 'ПАРАМЕТРОВ', v: 214 },
        { k: 'ОТКЛОНЕНИЙ', v: <span style={{ color: 'var(--bst-warn)' }}>▲ {off}</span> },
        { k: 'ОБНОВЛЕНО', v: summary.updated },
      ]}
      headerAside={<Button size="sm">Экспорт XLSX</Button>}
      footerCells={[
        { k: 'ОБЪЕКТ', v: asset.name },
        { k: 'РАЗДЕЛ', v: 'Двойник · C2' },
        { k: 'ТЕМА', v: 'Цианотипия' },
        { k: 'ОБНОВЛЕНО', v: summary.updated },
        { k: 'ЛИСТ', v: 'C2 / 07' },
      ]}
    >
      <DeviationsPanel code={asset.code} deviations={deviations} />
    </TwinShell>
  );
}
