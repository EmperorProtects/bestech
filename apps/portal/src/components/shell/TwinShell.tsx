import type { ReactNode } from 'react';
import { getAssets, getTwinSummary } from '@/api';
import { AppShell } from '@/components/shell/AppShell';
import type { NavItem } from '@/components/shell/SidebarNav';
import { requireUser } from '@/lib/session';
import { getFeature, isFeatureEnabled } from '@/lib/stages';
import { openAlarmCounts } from '@/lib/twin/alarms';
import { hasLiveSensors } from '@/lib/twin/live';

export interface TwinShellProps {
  code: string;
  headerCells: { k: string; v: ReactNode }[];
  headerAside?: ReactNode;
  footerCells: { k: string; v: ReactNode }[];
  children: ReactNode;
}

/** Дашборд двойника: тёмная тема «Цианотипия» по умолчанию (операторская). */
export async function TwinShell({ code, headerCells, headerAside, footerCells, children }: TwinShellProps) {
  const user = requireUser();
  const assets = await getAssets(user.orgId);
  const twinOn = isFeatureEnabled('twin');
  const live = twinOn && hasLiveSensors(code);
  const counts = live ? openAlarmCounts(code) : null;
  const fixture = twinOn ? await getTwinSummary(code) : undefined;
  const openTotal = counts ? counts.alarm + counts.warning + counts.offline : 0;

  const locked = (id: Parameters<typeof getFeature>[0], icon: NavItem['icon']): NavItem => ({
    href: `#${id}`,
    label: getFeature(id).label,
    icon,
    disabled: true,
    note: getFeature(id).note,
  });

  const base = `/twin/${code}`;
  const nav: NavItem[] = twinOn
    ? [
        { href: base, label: 'Обзор двойника', icon: 'twin' },
        {
          href: `${base}/deviations`,
          label: 'Факт / проект',
          icon: 'deviations',
          ...(fixture ? { count: { value: String(fixture.nearTolerance + fixture.outOfTolerance), tone: 'warning' as const } } : {}),
        },
        { href: `${base}/telemetry`, label: 'Телеметрия', icon: 'telemetry' },
        isFeatureEnabled('alarms')
          ? {
              href: `${base}/alarms`,
              label: 'Аварии',
              icon: 'alarms',
              ...(openTotal ? { count: { value: `▲ ${openTotal}`, tone: counts!.alarm ? ('alarm' as const) : ('warning' as const) } } : {}),
            }
          : locked('alarms', 'alarms'),
        { href: `${base}/ingest`, label: 'Приём данных', icon: 'ingest' },
        { href: `/cabinet/assets/${code}`, label: 'Вернуться в кабинет', icon: 'sheet' },
      ]
    : [
        locked('twin', 'twin'),
        locked('deviations', 'deviations'),
        locked('telemetry', 'telemetry'),
        locked('alarms', 'alarms'),
        { href: `/cabinet/assets/${code}`, label: 'Вернуться в кабинет', icon: 'sheet' },
      ];

  return (
    <AppShell
      sectionTheme="cyanotype"
      sectionTitle="Цифровой двойник"
      navItems={nav}
      assets={assets}
      currentCode={code}
      switcherSection="twin"
      switcherLabel="ОБЪЕКТ"
      headerCells={headerCells}
      {...(headerAside ? { headerAside } : {})}
      footerCells={footerCells}
      user={user}
    >
      {children}
    </AppShell>
  );
}
