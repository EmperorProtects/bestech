import { notFound } from 'next/navigation';
import { STAGE_LABELS } from '@bestech/tokens';
import { getAsset, getDocSections, getDocSheets, getOpenRemarks, normalizeCode } from '@/api';
import { CabinetShell } from '@/components/shell/CabinetShell';
import { AssetTabs } from '@/components/asset/AssetTabs';
import { DocumentsBrowser } from '@/components/documents/DocumentsBrowser';
import { UnderDevelopment } from '@/components/common/UnderDevelopment';
import { requireUser } from '@/lib/session';
import { isFeatureEnabled } from '@/lib/stages';
import { assetTabs } from '../tabs';

export async function generateMetadata({ params }: { params: { code: string } }) {
  return { title: `Документация · ${normalizeCode(params.code)} — BESTECH` };
}

/** B5. Ведомость разделов ПД и выдача чертежей заказчику. */
export default async function DocumentsPage({ params }: { params: { code: string } }) {
  const user = requireUser();
  const asset = await getAsset(params.code, user.orgId);
  if (!asset) notFound();

  const [sections, sheets, openRemarks] = await Promise.all([
    getDocSections(asset.code),
    getDocSheets(asset.code),
    getOpenRemarks(asset.code),
  ]);

  const issued = sections.filter((s) => s.status === 'issued').length;
  const totalSheets = sections.reduce((n, s) => n + s.sheetsCount, 0);

  return (
    <CabinetShell
      currentCode={asset.code}
      headerCells={[
        { k: 'ШИФР', v: asset.code },
        { k: 'ВЕДОМОСТЬ', v: 'РАЗДЕЛЫ ПД' },
        { k: 'ВЫДАНО', v: <span style={{ color: 'var(--bst-ok)' }}>● {issued} из {sections.length}</span> },
        { k: 'ЗАМЕЧАНИЙ', v: <span style={{ color: openRemarks.length ? 'var(--bst-warn)' : 'var(--bst-ok)' }}>▲ {openRemarks.length}</span> },
        { k: 'ЛИСТОВ', v: totalSheets },
      ]}
      footerCells={[
        { k: 'ОБЪЕКТ', v: `${asset.code} · ${asset.name}` },
        { k: 'РАЗДЕЛ', v: 'Кабинет · B5' },
        { k: 'СТАДИЯ', v: STAGE_LABELS[asset.stage] },
        { k: 'ДОСТУПНО ЛИСТОВ', v: sheets.length },
        { k: 'ЛИСТ', v: 'B5 / 17' },
      ]}
      tabs={<AssetTabs tabs={assetTabs(asset, openRemarks.length)} />}
    >
      {isFeatureEnabled('documents') ? (
        <DocumentsBrowser assetCode={asset.code} sections={sections} sheets={sheets} openRemarks={openRemarks} />
      ) : (
        <UnderDevelopment feature="documents" assetCode={asset.code} />
      )}
    </CabinetShell>
  );
}
