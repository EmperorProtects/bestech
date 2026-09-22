import { redirect } from 'next/navigation';
import { Frame, SectionEyebrow, TitleBlock } from '@bestech/ui-kit';
import { LoginForm } from '@/components/auth/LoginForm';
import { getCurrentUser, listDemoAccounts } from '@/lib/session';
import { ENABLED_STAGES } from '@/lib/stages';
import { STAGE_LABELS } from '@bestech/tokens';

export const metadata = { title: 'Вход — BESTECH' };

/** Вход в кабинет. Единственный маршрут, доступный без сессии. */
export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  if (getCurrentUser()) redirect('/cabinet/assets');

  const accounts = listDemoAccounts();
  const next = searchParams.next?.startsWith('/') ? searchParams.next : '/cabinet/assets';
  const demoPassword = process.env.BESTECH_DEMO_PASSWORD ?? 'bestech2026';

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        alignItems: 'stretch',
      }}
      className="login"
    >
      <section style={{ display: 'grid', placeItems: 'center', padding: 40 }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ fontFamily: 'var(--bst-font-heading)', fontSize: 26, fontWeight: 700, letterSpacing: '0.22em' }}>BESTECH</div>
          <div className="bst-mono" style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--bst-text-mute)', textTransform: 'uppercase', marginBottom: 26 }}>
            Кабинет заказчика · информационная модель объекта
          </div>

          <Frame padded>
            <SectionEyebrow rule={false}>ВХОД В КАБИНЕТ</SectionEyebrow>
            <div style={{ marginTop: 16 }}>
              <LoginForm next={next} defaultEmail={accounts[0]?.email ?? ''} />
            </div>
          </Frame>

          <div style={{ marginTop: 18 }}>
            <div className="bst-kpi__label" style={{ marginBottom: 8 }}>
              Демонстрационные учётные записи
            </div>
            <div style={{ display: 'grid', borderTop: '1px solid var(--bst-line)' }}>
              {accounts.map((a) => (
                <div
                  key={a.email}
                  style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--bst-line)' }}
                >
                  <span className="bst-mono" style={{ fontSize: 11 }}>
                    {a.email}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--bst-text-soft)' }}>{a.position || a.name}</span>
                </div>
              ))}
            </div>
            <div className="bst-mono" style={{ fontSize: 11, color: 'var(--bst-text-mute)', marginTop: 10 }}>
              Пароль для всех: <span style={{ color: 'var(--bst-text)' }}>{demoPassword}</span>
            </div>
          </div>
        </div>
      </section>

      <aside
        className="login__aside"
        style={{
          borderLeft: '1px solid var(--bst-line)',
          background: 'var(--bst-surface)',
          display: 'grid',
          placeItems: 'center',
          padding: 40,
        }}
      >
        <div style={{ width: '100%', maxWidth: 420, display: 'grid', gap: 22 }}>
          <div>
            <SectionEyebrow rule={false}>СОСТАВ ПРОТОТИПА</SectionEyebrow>
            <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--bst-text-soft)', marginTop: 10 }}>
              В работе стадия «{STAGE_LABELS.design}»: приём исходных данных с загрузкой файлов и выдача рабочей
              документации — просмотр листов, замечания нормоконтроля, скачивание чертежей и комплекта.
            </p>
          </div>

          <TitleBlock
            minWidth={0}
            rows={[
              { k: 'СТАДИИ В РАБОТЕ', v: ENABLED_STAGES.map((s) => STAGE_LABELS[s]).join(', ') },
              { k: 'В РАЗРАБОТКЕ', v: `${STAGE_LABELS.construction}, ${STAGE_LABELS.operation}` },
              { k: 'ХРАНЕНИЕ', v: 'SQLite · файлы на диске' },
              { k: 'ДОСТУП', v: 'Сессия 14 суток, httpOnly' },
            ]}
          />

          <p className="bst-mono" style={{ fontSize: 11, color: 'var(--bst-text-mute)', lineHeight: 1.6, margin: 0 }}>
            Разделы цифрового двойника, телеметрии, сравнения «факт / проект» и эксплуатации видны в навигации,
            но помечены «в разработке» — они откроются вместе со своими стадиями.
          </p>
        </div>
      </aside>
    </main>
  );
}
