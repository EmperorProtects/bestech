import { notFound } from 'next/navigation';
import { STAGE_LABELS } from '@bestech/tokens';
import { EmptyState } from '@bestech/ui-kit';
import { getAsset, getOpenRemarks, normalizeCode } from '@/api';
import { CabinetShell } from '@/components/shell/CabinetShell';
import { AssetTabs } from '@/components/asset/AssetTabs';
import { WorkspacePanel } from '@/components/workspace/WorkspacePanel';
import { UnderDevelopment } from '@/components/common/UnderDevelopment';
import { requireUser } from '@/lib/session';
import { isFeatureEnabled } from '@/lib/stages';
import { formatFileSize } from '@/lib/storage';
import { FOLDERS, WORKSPACE_DIR, getLinkedProject, modelInfo, readPhases, revitBridgeStatus, scanWorkspace } from '@/lib/workspace';
import { PRESETS, claudeWebStatus, listJobs } from '@/lib/workspace-jobs';
import { assetTabs } from '../tabs';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { code: string } }) {
  return { title: `Мастерская · ${normalizeCode(params.code)} — BESTECH` };
}

/** Мастерская выпуска чертежей: Claude Code + Revit по шифру объекта. */
export default async function WorkspacePage({ params, searchParams }: { params: { code: string }; searchParams: { job?: string; notice?: string } }) {
  const user = requireUser();
  const asset = await getAsset(params.code, user.orgId);
  if (!asset) notFound();

  const openRemarks = await getOpenRemarks(asset.code);
  const linked = getLinkedProject(asset.code);
  const header = [
    { k: 'ШИФР', v: asset.code },
    { k: 'РАЗДЕЛ', v: 'МАСТЕРСКАЯ' },
    { k: 'ПАПКА', v: linked ? 'newExport' : 'не связан' },
  ];
  const footer = [
    { k: 'ОБЪЕКТ', v: `${asset.code} · ${asset.name}` },
    { k: 'РАЗДЕЛ', v: 'Кабинет · мастерская' },
    { k: 'СТАДИЯ', v: STAGE_LABELS[asset.stage] },
    { k: 'ПОЛЬЗОВАТЕЛЬ', v: user.name },
    { k: 'ИНСТРУМЕНТ', v: 'Claude Code + Revit' },
  ];
  const tabs = <AssetTabs tabs={assetTabs(asset, openRemarks.length)} />;

  if (!isFeatureEnabled('workspace')) {
    return (
      <CabinetShell currentCode={asset.code} headerCells={header} footerCells={footer} tabs={tabs}>
        <UnderDevelopment feature="workspace" assetCode={asset.code} />
      </CabinetShell>
    );
  }

  if (!linked) {
    return (
      <CabinetShell currentCode={asset.code} headerCells={header} footerCells={footer} tabs={tabs}>
        <div className="page">
          <EmptyState
            title="Объект не связан с мастерской"
            note={`Проект подключается автоматически, когда в ${WORKSPACE_DIR} появляются файлы с его шифром: «${FOLDERS.inputs}\\ТЗ_<шифр>.md», «${FOLDERS.models}\\<шифр>.rvt» или альбом в «${FOLDERS.drawings}».`}
          />
        </div>
      </CabinetShell>
    );
  }

  const project = scanWorkspace().find((p) => p.shifr === linked.shifr);
  const model = modelInfo(linked.modelPath);
  const [claude, jobs] = await Promise.all([claudeWebStatus(), Promise.resolve(listJobs(asset.code))]);

  return (
    <CabinetShell currentCode={asset.code} headerCells={header} footerCells={footer} tabs={tabs}>
      <WorkspacePanel
        assetCode={asset.code}
        shifr={linked.shifr}
        workspaceDir={WORKSPACE_DIR}
        claude={claude}
        bridge={revitBridgeStatus()}
        model={model && linked.modelPath ? { path: linked.modelPath, size: formatFileSize(model.size), mtime: model.mtime } : null}
        album={
          project?.albumPath && project.albumMtime
            ? { path: project.albumPath, sheets: project.sheets.length, mtime: project.albumMtime.toLocaleString('ru-KZ') }
            : null
        }
        rpzPath={linked.rpzPath}
        phases={readPhases(linked.shifr)}
        {...(searchParams.notice ? { notice: searchParams.notice.slice(0, 300) } : {})}
        inputs={project?.inputs ?? []}
        presets={PRESETS}
        jobs={jobs.map(({ log: _log, prompt: _prompt, ...rest }) => rest)}
        canRun={user.role === 'engineer'}
        {...(searchParams.job ? { initialJobId: searchParams.job } : {})}
      />
    </CabinetShell>
  );
}
