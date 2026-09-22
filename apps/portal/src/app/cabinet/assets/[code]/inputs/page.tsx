import { notFound } from 'next/navigation';
import { STAGE_LABELS } from '@bestech/tokens';
import { getAsset, getCompleteness, getInputDocs, getOpenRemarks, normalizeCode } from '@/api';
import { CabinetShell } from '@/components/shell/CabinetShell';
import { AssetTabs } from '@/components/asset/AssetTabs';
import { InputsPanel } from '@/components/inputs/InputsPanel';
import { UnderDevelopment } from '@/components/common/UnderDevelopment';
import { requireUser } from '@/lib/session';
import { isFeatureEnabled } from '@/lib/stages';
import { assetTabs } from '../tabs';

export async function generateMetadata({ params }: { params: { code: string } }) {
  return { title: `Исходные данные · ${normalizeCode(params.code)} — BESTECH` };
}

/** B4. Исходные данные объекта: загрузка файлов и проверка комплектности. */
export default async function AssetInputsPage({ params }: { params: { code: string } }) {
  const user = requireUser();
  const asset = await getAsset(params.code, user.orgId);
  if (!asset) notFound();

  const [docs, completeness, openRemarks] = await Promise.all([
    getInputDocs(asset.code),
    getCompleteness(asset.code),
    getOpenRemarks(asset.code),
  ]);

  return (
    <CabinetShell
      currentCode={asset.code}
      headerCells={[
        { k: 'ШИФР', v: asset.code },
        { k: 'РАЗДЕЛ', v: 'ИСХОДНЫЕ ДАННЫЕ' },
        { k: 'ПРИНЯТО', v: `${docs.filter((d) => d.state === 'accepted').length} из ${docs.length}` },
        {
          k: 'КОМПЛЕКТНОСТЬ',
          v: <span style={{ color: (completeness?.percent ?? 0) >= 90 ? 'var(--bst-ok)' : 'var(--bst-warn)' }}>{completeness?.percent ?? 0} %</span>,
        },
        { k: 'ЛИСТ', v: 'B4 / 17' },
      ]}
      footerCells={[
        { k: 'ОБЪЕКТ', v: `${asset.code} · ${asset.name}` },
        { k: 'РАЗДЕЛ', v: 'Кабинет · B4' },
        { k: 'СТАДИЯ', v: STAGE_LABELS[asset.stage] },
        { k: 'ПОЛЬЗОВАТЕЛЬ', v: user.name },
        { k: 'ЛИСТ', v: 'B4 / 17' },
      ]}
      tabs={<AssetTabs tabs={assetTabs(asset, openRemarks.length)} />}
    >
      {isFeatureEnabled('inputs') ? (
        <div className="page">
          <InputsPanel assetCode={asset.code} docs={docs} {...(completeness ? { completeness } : {})} />
        </div>
      ) : (
        <UnderDevelopment feature="inputs" assetCode={asset.code} />
      )}
    </CabinetShell>
  );
}
