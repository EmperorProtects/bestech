import Link from 'next/link';
import { STAGE_LABELS } from '@bestech/tokens';
import { Frame } from '@bestech/ui-kit';
import type { Asset } from '@/api/types';
import { toleranceColor } from '@/lib/format';

const W = 820;
const H = 470;

/** Схематичная карта размещения объектов. Не географическая карта, а схема. */
export function AssetMap({ assets }: { assets: Asset[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 22, alignItems: 'start' }}>
      <Frame as="figure" style={{ margin: 0 }}>
        <div style={{ padding: '9px 14px', borderBottom: '1px solid var(--bst-line)', fontFamily: 'var(--bst-font-mono)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--bst-text-mute)' }}>
          РАЗМЕЩЕНИЕ ОБЪЕКТОВ · СХЕМА · {assets.length} ПОЗИЦИИ
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{ display: 'block' }} role="img" aria-label="Схема размещения объектов организации">
          <rect x="0" y="0" width={W} height={H} fill="var(--bst-surface)" />
          <g stroke="var(--bst-line)" strokeWidth="1">
            {Array.from({ length: 7 }, (_, i) => (
              <path key={`h${i}`} d={`M0 ${60 * (i + 1)}H${W}`} />
            ))}
            {Array.from({ length: 13 }, (_, i) => (
              <path key={`v${i}`} d={`M${60 * (i + 1)} 0V${H}`} />
            ))}
          </g>
          <path
            d="M120 300 200 180 340 120 470 150 590 110 700 200 740 330 600 400 420 380 260 420Z"
            fill="var(--bst-accent-tint)"
            stroke="var(--bst-accent-400)"
            strokeWidth="1.4"
          />
          <path d="M340 120 400 250 470 150M400 250 590 110M400 250 420 380" stroke="var(--bst-accent-300)" strokeWidth="1" strokeDasharray="5 4" fill="none" />

          {assets.map((a) => {
            const x = a.map.x * W;
            const y = a.map.y * H;
            const color = a.alarm ? 'var(--bst-alarm)' : toleranceColor(a.remarks.state);
            const flip = x > W * 0.6;
            return (
              <g key={a.code}>
                <circle cx={x} cy={y} r="8" fill="var(--bst-bg)" stroke={color} strokeWidth="2" />
                <circle cx={x} cy={y} r="2.6" fill={color} />
                <rect x={flip ? x - 236 : x + 14} y={y + 6} width="222" height="44" fill="var(--bst-bg)" stroke={color} />
                <text x={flip ? x - 226 : x + 24} y={y + 24} fontFamily="var(--bst-font-mono)" fontSize="11" fill="var(--bst-text)">
                  {a.code} · {a.shortName}
                </text>
                <text x={flip ? x - 226 : x + 24} y={y + 40} fontFamily="var(--bst-font-mono)" fontSize="10" fill={color}>
                  {a.alarm ? '▲ авария' : '●'} {STAGE_LABELS[a.stage].toLowerCase()} · {a.progress} %
                </text>
              </g>
            );
          })}
          <text x={W - 120} y={H - 20} fontFamily="var(--bst-font-mono)" fontSize="9" fill="var(--bst-text-mute)">
            М 1:5 000 000
          </text>
        </svg>
      </Frame>

      <div>
        <div className="bst-eyebrow" style={{ marginBottom: 10 }}>
          ◭ ОБЪЕКТЫ НА СХЕМЕ
        </div>
        <div style={{ display: 'grid', borderTop: '1px solid var(--bst-line)' }}>
          {assets.map((a) => (
            <Link
              key={a.code}
              href={`/cabinet/assets/${a.code}`}
              style={{ display: 'grid', gridTemplateColumns: '16px minmax(0, 1fr)', gap: 10, padding: '11px 0', borderBottom: '1px solid var(--bst-line)', color: 'var(--bst-text)' }}
            >
              <span className="bst-mono" style={{ fontSize: 11, color: toleranceColor(a.sensors.state) }} aria-hidden="true">
                {a.alarm ? '▲' : '●'}
              </span>
              <span>
                <span style={{ display: 'block', fontFamily: 'var(--bst-font-heading)', fontSize: 16, textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1.15 }}>
                  {a.name}
                </span>
                <span style={{ display: 'block', fontFamily: 'var(--bst-font-mono)', fontSize: 10.5, color: 'var(--bst-text-mute)', marginTop: 2 }}>
                  {a.code} · {a.region} · {STAGE_LABELS[a.stage]}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
