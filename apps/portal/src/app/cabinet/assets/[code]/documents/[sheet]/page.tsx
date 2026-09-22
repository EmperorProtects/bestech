import { notFound } from 'next/navigation';
import { STAGE_LABELS } from '@bestech/tokens';
import { getAsset, getDocSheets, getOpenRemarks, getSheet, getSheetRemarks, normalizeCode } from '@/api';
import { CabinetShell } from '@/components/shell/CabinetShell';
import { AssetTabs } from '@/components/asset/AssetTabs';
import { SheetViewer } from '@/components/documents/SheetViewer';
import { UnderDevelopment } from '@/components/common/UnderDevelopment';
import { requireUser } from '@/lib/session';
import { isFeatureEnabled } from '@/lib/stages';
import { assetTabs } from '../../tabs';

export async function generateMetadata({ params }: { params: { code: string; sheet: string } }) {
  return { title: `${decodeURIComponent(params.sheet)} · ${normalizeCode(params.code)} — BESTECH` };
}

/** B6. Просмотр листа чертежа с пинами замечаний и скачиванием. */
export default async function SheetPage({
  params,
  searchParams,
}: {
  params: { code: string; sheet: string };
  searchParams: { remark?: string };
}) {
  const user = requireUser();
  const asset = await getAsset(params.code, user.orgId);
  if (!asset) notFound();

  const sheetCode = decodeURIComponent(params.sheet);
  const sheet = await getSheet(asset.code, sheetCode);
  if (!sheet) notFound();

  const [remarks, siblings, openRemarks] = await Promise.all([
    getSheetRemarks(sheet.id),
    getDocSheets(asset.code, sheet.sectionCode),
    getOpenRemarks(asset.code),
  ]);

  return (
    <CabinetShell
      currentCode={asset.code}
      headerCells={[
        { k: 'ШИФР', v: asset.code },
        { k: 'ЛИСТ', v: sheet.code },
        { k: 'ФОРМАТ', v: sheet.format },
        { k: 'ИЗМ.', v: `${sheet.version} от ${sheet.changed}` },
        {
          k: 'ЗАМЕЧАНИЙ',
          v: sheet.openRemarks > 0 ? <span style={{ color: 'var(--bst-warn)' }}>▲ {sheet.openRemarks}</span> : <span style={{ color: 'var(--bst-ok)' }}>● 0</span>,
        },
      ]}
      footerCells={[
        { k: 'ОБЪЕКТ', v: `${asset.code} · ${asset.name}` },
        { k: 'РАЗДЕЛ', v: `Кабинет · B6 · ${sheet.sectionCode}` },
        { k: 'СТАДИЯ', v: STAGE_LABELS[asset.stage] },
        { k: 'АВТОР', v: sheet.sectionAuthor },
        { k: 'ЛИСТ', v: 'B6 / 17' },
      ]}
      tabs={<AssetTabs tabs={assetTabs(asset, openRemarks.length)} />}
    >
      {isFeatureEnabled('drawings') ? (
        <SheetViewer
          assetCode={asset.code}
          sheet={sheet}
          siblings={siblings}
          remarks={remarks}
          {...(searchParams.remark ? { initialRemarkId: searchParams.remark } : {})}
          generated={sheet.fileId === null}
          mode={
            sheet.fileId === null
              ? 'svg'
              : /\.pdf$/i.test(sheet.fileName ?? '')
                ? 'pdf'
                : /\.(md|txt|svg)$/i.test(sheet.fileName ?? '')
                  ? 'text'
                  : 'file'
          }
        />
      ) : (
        <UnderDevelopment feature="drawings" assetCode={asset.code} />
      )}
    </CabinetShell>
  );
}
