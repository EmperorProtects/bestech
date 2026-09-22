import type { ReactNode } from 'react';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import type { ThemeName } from '@bestech/tokens';
import { SheetStrip } from '@bestech/ui-kit';
import { ThemeController } from '@/components/theme/ThemeController';
import { ViewControls } from '@/components/theme/ViewControls';
import { SidebarNav, type NavItem } from './SidebarNav';
import { AssetSwitcher } from './AssetSwitcher';
import { signOut } from '@/app/login/actions';
import type { Asset } from '@/api/types';
import type { SessionUser } from '@/lib/session';

export interface AppShellProps {
  /** Тема раздела по умолчанию: кабинет — «Бумага», двойник — «Цианотипия». */
  sectionTheme: ThemeName;
  sectionTitle: string;
  navItems: NavItem[];
  assets: Asset[];
  currentCode?: string;
  switcherSection: 'cabinet' | 'twin';
  switcherLabel: string;
  /** Полоса штампа в шапке. */
  headerCells: { k: string; v: ReactNode }[];
  headerAside?: ReactNode;
  footerCells: { k: string; v: ReactNode }[];
  user: SessionUser;
  tabs?: ReactNode;
  children: ReactNode;
}

/** Общая оболочка кабинета и двойника: сайдбар, штамп-шапка, подвал-штамп. */
export function AppShell({
  sectionTheme,
  sectionTitle,
  navItems,
  assets,
  currentCode,
  switcherSection,
  switcherLabel,
  headerCells,
  headerAside,
  footerCells,
  user,
  tabs,
  children,
}: AppShellProps) {
  return (
    <div className="app">
      <ThemeController sectionTheme={sectionTheme} />

      <aside className="app__aside">
        <div style={{ padding: '16px 16px 14px', borderBottom: '1px solid var(--bst-line)' }}>
          <Link href="/cabinet/assets" style={{ fontFamily: 'var(--bst-font-heading)', fontSize: 18, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--bst-text)' }}>
            BESTECH
          </Link>
          <div style={{ fontFamily: 'var(--bst-font-mono)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--bst-text-mute)', textTransform: 'uppercase' }}>
            {sectionTitle}
          </div>
        </div>

        <AssetSwitcher assets={assets} currentCode={currentCode} section={switcherSection} label={switcherLabel} />
        <SidebarNav items={navItems} />

        <div style={{ marginTop: 'auto', padding: 12, borderTop: '1px solid var(--bst-line)', display: 'grid', gap: 14 }}>
          <ViewControls />
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span
              style={{
                width: 28,
                height: 28,
                border: '1px solid var(--bst-line)',
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'var(--bst-font-mono)',
                fontSize: 11,
                flex: 'none',
              }}
            >
              {user.initials}
            </span>
            <span style={{ lineHeight: 1.2, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13 }}>{user.name}</span>
              <span
                style={{
                  display: 'block',
                  fontFamily: 'var(--bst-font-mono)',
                  fontSize: 10,
                  color: 'var(--bst-text-mute)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={`${user.position} · ${user.orgName}`}
              >
                {user.position || user.orgName}
              </span>
            </span>
            <form action={signOut} style={{ marginLeft: 'auto' }}>
              <button type="submit" className="bst-btn bst-btn--ghost bst-btn--sm bst-btn--icon" aria-label="Выйти из кабинета" title="Выйти">
                <LogOut size={14} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="app__main">
        <header className="app__header">
          <SheetStrip cells={headerCells} />
          {headerAside ? <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px' }}>{headerAside}</div> : null}
        </header>
        {tabs}
        {children}
        <footer className="app__footer">
          {footerCells.map((c) => (
            <div key={c.k}>
              <div className="app__footer-k">{c.k}</div>
              <div>{c.v}</div>
            </div>
          ))}
        </footer>
      </div>
    </div>
  );
}
