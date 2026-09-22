import { getAssets } from '@/api';
import { CabinetShell } from '@/components/shell/CabinetShell';
import { AssetsBrowser } from '@/components/assets/AssetsBrowser';
import { requireUser } from '@/lib/session';
import { ENABLED_STAGES } from '@/lib/stages';
import { workspaceAvailable } from '@/lib/workspace';
import { STAGE_LABELS } from '@bestech/tokens';

export const metadata = { title: 'Мои объекты — BESTECH' };

/** B2. Список объектов организации. */
export default async function AssetsPage() {
  const user = requireUser();
  const assets = await getAssets(user.orgId);
  const openRemarks = assets.reduce((sum, a) => sum + a.remarks.count, 0);

  return (
    <CabinetShell
      headerCells={[
        { k: 'РАЗДЕЛ', v: 'МОИ ОБЪЕКТЫ' },
        { k: 'ОБЪЕКТОВ', v: assets.length },
        { k: 'ОТКРЫТЫХ ЗАМЕЧАНИЙ', v: <span style={{ color: 'var(--bst-warn)' }}>▲ {openRemarks}</span> },
        { k: 'СТАДИЯ В РАБОТЕ', v: ENABLED_STAGES.map((s) => STAGE_LABELS[s].toUpperCase()).join(', ') },
      ]}
      footerCells={[
        { k: 'ОРГАНИЗАЦИЯ', v: `${user.orgName} · ${assets.length} объекта` },
        { k: 'РАЗДЕЛ', v: 'Кабинет · B2' },
        { k: 'ПОЛЬЗОВАТЕЛЬ', v: `${user.name} · ${user.position}` },
        { k: 'БИН', v: user.orgBin },
        { k: 'ЛИСТ', v: 'B2 / 17' },
      ]}
    >
      <AssetsBrowser assets={assets} canCreate={user.role === 'engineer' && workspaceAvailable()} />
    </CabinetShell>
  );
}
