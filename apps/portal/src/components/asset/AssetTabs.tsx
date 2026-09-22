'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IN_DEVELOPMENT_LABEL } from '@/lib/stages';

export interface AssetTab {
  href: string;
  label: string;
  badge?: { value: string; tone: 'warn' | 'mute' };
  /** Вкладка закрыта флагом стадии: видна, но не кликается. */
  disabled?: boolean;
  /** Почему вкладка закрыта — подсказка при наведении. */
  note?: string;
}

/** Вкладки листа объекта: Обзор · Исходные данные · Документация · Модель · Двойник · Финансы · Команда. */
export function AssetTabs({ tabs }: { tabs: AssetTab[] }) {
  const pathname = usePathname();

  return (
    <div className="tabs">
      {tabs.map((t) =>
        t.disabled ? (
          <span key={t.label} className="tabs__tab" aria-disabled="true" title={t.note}>
            {t.label}
            <span className="bst-mono" style={{ fontSize: 9, marginLeft: 7, color: 'var(--bst-text-mute)', textTransform: 'none', letterSpacing: 0 }}>
              {IN_DEVELOPMENT_LABEL}
            </span>
          </span>
        ) : (
          <Link key={t.href} href={t.href} className="tabs__tab" aria-current={pathname === t.href ? 'page' : undefined}>
            {t.label}
            {t.badge ? (
              <span
                className="bst-mono"
                style={{ fontSize: 10, marginLeft: 7, color: t.badge.tone === 'warn' ? 'var(--bst-warn)' : 'var(--bst-text-mute)' }}
              >
                {t.badge.value}
              </span>
            ) : null}
          </Link>
        ),
      )}
    </div>
  );
}
