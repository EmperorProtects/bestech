'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, Boxes, FileStack, Gauge, HardHat, LayoutGrid, RadioTower, Ruler, ScrollText, SlidersHorizontal, TriangleAlert, Wrench } from 'lucide-react';
import { IN_DEVELOPMENT_LABEL } from '@/lib/stages';

export interface NavItem {
  href: string;
  label: string;
  icon: 'assets' | 'sheet' | 'inputs' | 'docs' | 'twin' | 'deviations' | 'telemetry' | 'alarms' | 'progress' | 'operation' | 'workspace' | 'ingest';
  count?: { value: string; tone: 'ok' | 'warning' | 'alarm' };
  /** Функция закрыта флагом стадии — пункт виден, но неактивен. */
  disabled?: boolean;
  /** Почему пункт закрыт: подсказка при наведении. */
  note?: string;
}

const ICONS = {
  assets: LayoutGrid,
  sheet: ScrollText,
  inputs: FileStack,
  docs: Ruler,
  twin: Boxes,
  deviations: SlidersHorizontal,
  telemetry: Gauge,
  alarms: TriangleAlert,
  progress: HardHat,
  operation: Wrench,
  workspace: Bot,
  ingest: RadioTower,
} as const;

const TONE = {
  ok: 'var(--bst-ok)',
  warning: 'var(--bst-warn)',
  alarm: 'var(--bst-alarm)',
} as const;

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav style={{ padding: '10px 8px', display: 'grid', gap: 2 }}>
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname === item.href;

        if (item.disabled) {
          return (
            <span
              key={item.href}
              className="nav-link"
              aria-disabled="true"
              title={item.note}
              style={{ opacity: 0.45, cursor: 'not-allowed' }}
            >
              <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
              {item.label}
              <span className="nav-link__count" style={{ color: 'var(--bst-text-mute)' }}>
                {IN_DEVELOPMENT_LABEL}
              </span>
            </span>
          );
        }

        return (
          <Link key={item.href} href={item.href} className="nav-link" aria-current={active ? 'page' : undefined}>
            <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
            {item.label}
            {item.count ? (
              <span className="nav-link__count" style={{ color: TONE[item.count.tone] }}>
                {item.count.value}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
