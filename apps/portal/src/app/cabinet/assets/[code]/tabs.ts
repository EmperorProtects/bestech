import type { Asset } from '@/api/types';
import type { AssetTab } from '@/components/asset/AssetTabs';
import { getFeature, isFeatureEnabled } from '@/lib/stages';
import { getLinkedProject } from '@/lib/workspace';

/**
 * Вкладки листа объекта. Состав один и тот же на всех объектах — закрытые
 * стадии видны, но неактивны, чтобы заказчик понимал полный объём портала.
 */
export function assetTabs(asset: Asset, openRemarks: number): AssetTab[] {
  const base = `/cabinet/assets/${asset.code}`;

  /** Вкладка раздела, закрытого флагом стадии. */
  const locked = (id: Parameters<typeof getFeature>[0], label?: string): AssetTab => ({
    href: '#',
    label: label ?? getFeature(id).label,
    disabled: true,
    note: getFeature(id).note,
  });

  return [
    { href: base, label: 'Обзор' },
    {
      href: `${base}/inputs`,
      label: 'Исходные данные',
      ...(asset.remarks.count ? { badge: { value: `▲ ${asset.remarks.count}`, tone: 'warn' as const } } : {}),
    },
    {
      href: `${base}/documents`,
      label: 'Документация',
      ...(openRemarks ? { badge: { value: `▲ ${openRemarks}`, tone: 'warn' as const } } : {}),
    },
    ...(isFeatureEnabled('workspace') && getLinkedProject(asset.code) ? [{ href: `${base}/workspace`, label: 'Мастерская' }] : []),
    locked('progress', 'Ход СМР'),
    isFeatureEnabled('twin')
      ? { href: `/twin/${asset.code}`, label: 'Двойник' }
      : locked('twin', 'Двойник'),
    locked('executive', 'Исполнительная'),
    locked('operation', 'Эксплуатация'),
    locked('finance'),
    locked('team'),
  ];
}
