import type { ReactNode } from 'react';
import { getAssets, getOpenRemarks } from '@/api';
import { AppShell } from '@/components/shell/AppShell';
import type { NavItem } from '@/components/shell/SidebarNav';
import { requireUser } from '@/lib/session';
import { getFeature, isFeatureEnabled } from '@/lib/stages';
import { getLinkedProject, syncWorkspace } from '@/lib/workspace';

export interface CabinetShellProps {
  currentCode?: string;
  headerCells: { k: string; v: ReactNode }[];
  headerAside?: ReactNode;
  footerCells: { k: string; v: ReactNode }[];
  tabs?: ReactNode;
  children: ReactNode;
}

/** Кабинет заказчика: светлая тема «Бумага», навигация по объекту. */
export async function CabinetShell({ currentCode, headerCells, headerAside, footerCells, tabs, children }: CabinetShellProps) {
  const user = requireUser();
  try {
    // Проекты мастерской newExport подтягиваются в кабинет без отдельной кнопки.
    syncWorkspace();
  } catch (error) {
    console.error('Синхронизация с мастерской не удалась', error);
  }
  const assets = await getAssets(user.orgId);
  const code = currentCode ?? assets[0]?.code;
  const active = assets.find((a) => a.code === code);
  const openRemarks = code ? (await getOpenRemarks(code)).length : 0;

  /** Пункт закрытого раздела: виден в меню, но не кликается. */
  const locked = (id: Parameters<typeof getFeature>[0], icon: NavItem['icon']): NavItem => ({
    href: `#${id}`,
    label: getFeature(id).label,
    icon,
    disabled: true,
    note: getFeature(id).note,
  });

  const nav: NavItem[] = [
    { href: '/cabinet/assets', label: 'Мои объекты', icon: 'assets' },
    ...(code
      ? [
          { href: `/cabinet/assets/${code}`, label: 'Лист объекта', icon: 'sheet' as const },
          {
            href: `/cabinet/assets/${code}/inputs`,
            label: 'Исходные данные',
            icon: 'inputs' as const,
            ...(active?.remarks.count ? { count: { value: `▲ ${active.remarks.count}`, tone: 'warning' as const } } : {}),
          },
          {
            href: `/cabinet/assets/${code}/documents`,
            label: 'Документация',
            icon: 'docs' as const,
            ...(openRemarks ? { count: { value: `▲ ${openRemarks}`, tone: 'warning' as const } } : {}),
          },
          ...(isFeatureEnabled('workspace') && getLinkedProject(code)
            ? [{ href: `/cabinet/assets/${code}/workspace`, label: 'Мастерская', icon: 'workspace' as const }]
            : []),
        ]
      : []),
    ...(isFeatureEnabled('twin') && active?.hasTwin && code
      ? [{ href: `/twin/${code}`, label: 'Цифровой двойник', icon: 'twin' as const }]
      : [locked('twin', 'twin')]),
    locked('progress', 'progress'),
    locked('operation', 'operation'),
    locked('finance', 'inputs'),
  ];

  return (
    <AppShell
      sectionTheme="paper"
      sectionTitle="Кабинет заказчика"
      navItems={nav}
      assets={assets}
      {...(code ? { currentCode: code } : {})}
      switcherSection="cabinet"
      switcherLabel="ОБЪЕКТ"
      headerCells={headerCells}
      {...(headerAside ? { headerAside } : {})}
      footerCells={footerCells}
      user={user}
      {...(tabs ? { tabs } : {})}
    >
      {children}
    </AppShell>
  );
}
