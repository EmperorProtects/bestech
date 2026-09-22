import Link from 'next/link';
import type { AssetEvent } from '@/api/types';
import { toleranceColor } from '@/lib/format';
import { IN_DEVELOPMENT_LABEL, isFeatureEnabled } from '@/lib/stages';

const GLYPH = { ok: '●', warning: '▲', alarm: '▲', offline: '✕', info: '●' } as const;

/** Ведёт ли действие в раздел, закрытый флагом стадии. */
function isLocked(href: string): boolean {
  return href.startsWith('/twin') && !isFeatureEnabled('twin');
}

/** Лента событий объекта: раздел выдан, замечание, авария датчика. */
export function EventFeed({ events }: { events: AssetEvent[] }) {
  return (
    <div style={{ display: 'grid', borderTop: '1px solid var(--bst-line)' }}>
      {events.map((e) => (
        <div
          key={e.id}
          style={{ display: 'grid', gridTemplateColumns: '120px 20px minmax(0, 1fr) auto', gap: 12, alignItems: 'start', padding: '12px 0', borderBottom: '1px solid var(--bst-line)' }}
        >
          <div className="bst-mono" style={{ fontSize: 11, color: 'var(--bst-text-mute)' }}>
            {e.date}
          </div>
          <div className="bst-mono" style={{ fontSize: 11, color: e.severity === 'info' ? 'var(--bst-accent-ink)' : toleranceColor(e.severity) }} aria-hidden="true">
            {GLYPH[e.severity]}
          </div>
          <div>
            <div style={{ fontSize: 14 }}>{e.title}</div>
            <div className="bst-mono" style={{ fontSize: 10.5, color: 'var(--bst-text-mute)', marginTop: 2 }}>
              {e.meta}
            </div>
          </div>
          {e.href && e.action ? (
            isLocked(e.href) ? (
              <span className="bst-mono" style={{ fontSize: 10.5, whiteSpace: 'nowrap', color: 'var(--bst-text-mute)' }} title={`${e.action} — ${IN_DEVELOPMENT_LABEL}`}>
                {IN_DEVELOPMENT_LABEL}
              </span>
            ) : (
              <Link href={e.href} className="bst-mono" style={{ fontSize: 10.5, whiteSpace: 'nowrap' }}>
                {e.action} →
              </Link>
            )
          ) : (
            <span />
          )}
        </div>
      ))}
    </div>
  );
}
