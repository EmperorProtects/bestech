import { existsSync } from 'node:fs';
import { EmptyState } from '@bestech/ui-kit';
import { CabinetShell } from '@/components/shell/CabinetShell';
import { NewProjectForm } from '@/components/workspace/NewProjectForm';
import { requireUser } from '@/lib/session';
import { AR_TEMPLATE, WORKSPACE_DIR, nextProjectNumber, revitBridgeStatus, workspaceAvailable } from '@/lib/workspace';
import { claudeWebStatus } from '@/lib/workspace-jobs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Новый проект — BESTECH' };

/** Новый проект по ТЗ: заводится в мастерской newExport, проектирует Claude. */
export default async function NewProjectPage() {
  const user = requireUser();
  const header = [
    { k: 'РАЗДЕЛ', v: 'НОВЫЙ ПРОЕКТ' },
    { k: 'МАСТЕРСКАЯ', v: 'newExport' },
  ];
  const footer = [
    { k: 'ОРГАНИЗАЦИЯ', v: user.orgName },
    { k: 'РАЗДЕЛ', v: 'Кабинет · новый проект' },
    { k: 'СТАДИЯ', v: 'Проектирование' },
    { k: 'ПОЛЬЗОВАТЕЛЬ', v: user.name },
    { k: 'ИНСТРУМЕНТ', v: 'Claude Code + Revit' },
  ];

  if (user.role !== 'engineer' || !workspaceAvailable()) {
    return (
      <CabinetShell headerCells={header} footerCells={footer}>
        <div className="page">
          <EmptyState
            title={user.role !== 'engineer' ? 'Создание проекта — у проектировщиков' : 'Мастерская недоступна'}
            note={
              user.role !== 'engineer'
                ? 'Новый проект по ТЗ заводит ГИП: он запускает проектирование в мастерской. Передайте ТЗ через вкладку «Исходные данные» объекта.'
                : `Папка мастерской не найдена: ${WORKSPACE_DIR}. Укажите её в BESTECH_WORKSPACE_DIR.`
            }
          />
        </div>
      </CabinetShell>
    );
  }

  const claude = await claudeWebStatus();

  return (
    <CabinetShell headerCells={header} footerCells={footer}>
      <div className="page">
        <NewProjectForm
          nextNumber={nextProjectNumber()}
          year={new Date().getFullYear()}
          claudeOnline={claude.online && !claude.error}
          revitAlive={revitBridgeStatus().alive}
          workspaceDir={WORKSPACE_DIR}
          template={AR_TEMPLATE}
          templateFound={existsSync(AR_TEMPLATE)}
        />
      </div>
    </CabinetShell>
  );
}
