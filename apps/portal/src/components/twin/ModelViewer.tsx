'use client';

import type { Sensor } from '@/api/types';
import { toleranceColor } from '@/lib/format';

const GLYPH = { ok: '●', warning: '▲', alarm: '▲', offline: '✕' } as const;

export interface ModelViewerProps {
  sensors: Sensor[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  scale: string;
  legend: { ok: number; warning: number; alarm: number; offline: number };
}

/**
 * Вьюер каркасной модели: сетка осей, аксонометрия, метки датчиков по состоянию.
 * Реальная загрузка IFC подключается сюда же (three.js / web-ifc) вместо SVG-заглушки.
 */
export function ModelViewer({ sensors, selectedId, onSelect, scale, legend }: ModelViewerProps) {
  const selected = sensors.find((s) => s.id === selectedId);

  return (
    <svg viewBox="0 0 760 470" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }} role="img" aria-label="Каркасная модель объекта с датчиками, окрашенными по состоянию">
      <g transform="matrix(12.124,7,-12.124,7,300,160)" stroke="var(--bst-grid)" strokeWidth="0.1" fill="none">
        <path d="M0 -1.5V13.5M4 -1.5V13.5M8 -1.5V13.5M12 -1.5V13.5M16 -1.5V13.5M20 -1.5V13.5M24 -1.5V13.5" />
        <path d="M-1.5 0H25.5M-1.5 4H25.5M-1.5 8H25.5M-1.5 12H25.5" />
      </g>
      <g transform="matrix(12.124,7,-12.124,7,300,160)" stroke="var(--bst-accent-700)" strokeWidth="0.12" fill="none">
        <path d="M0 0H24V12H0Z" />
      </g>
      <g fontFamily="var(--bst-font-mono)" fontSize="10" fill="var(--bst-text-mute)" textAnchor="middle">
        <text x="324" y="149">1</text>
        <text x="373" y="177">2</text>
        <text x="421" y="205">3</text>
        <text x="469" y="233">4</text>
        <text x="518" y="261">5</text>
        <text x="566" y="289">6</text>
        <text x="614" y="317">7</text>
        <text x="276" y="149">А</text>
        <text x="227" y="177">Б</text>
        <text x="179" y="205">В</text>
        <text x="130" y="233">Г</text>
      </g>

      <g transform="matrix(12.124,7,0,-14,154.5,244)" stroke="var(--bst-accent-700)" strokeWidth="0.1" fill="none">
        <path d="M0 0H24V6H0Z" />
        <path d="M4 0V6M8 0V6M12 0V6M16 0V6M20 0V6" strokeDasharray="0.4 0.3" />
      </g>
      <polygon points="227.3,62 518.3,230 445.5,328 154.5,160" fill="var(--bst-raised)" stroke="var(--bst-accent-700)" strokeWidth="1" opacity="0.9" />
      <polygon points="300,76 591,244 518.3,230 227.3,62" fill="var(--bst-surface)" stroke="var(--bst-accent)" strokeWidth="1.1" />
      <g stroke="var(--bst-accent-700)" strokeWidth="0.9">
        <path d="M348.5 104 275.8 90M397 132 324.3 118M445.5 160 372.8 146M494 188 421.3 174M542.5 216 469.8 202" />
      </g>
      <g transform="matrix(12.124,7,0,-14,300,160)" stroke="var(--bst-accent)" strokeWidth="0.1" fill="none">
        <path d="M0 0H24V6H0Z" strokeWidth="0.13" />
        <path d="M4 0V6M8 0V6M12 0V6M16 0V6M20 0V6" />
        <path d="M2 0V3.2H6V0M10 0V3.2H14V0M18 0V3.2H22V0" stroke="var(--bst-accent-700)" strokeWidth="0.08" />
      </g>
      <g transform="matrix(-12.124,7,0,-14,300,160)" stroke="var(--bst-accent)" strokeWidth="0.12" fill="none">
        <path d="M0 0H12V6L6 10L0 6Z" />
      </g>
      <g transform="matrix(-12.124,7,0,-14,591,328)" stroke="var(--bst-accent-700)" strokeWidth="0.1" fill="none">
        <path d="M0 0H12V6L6 10L0 6Z" />
      </g>
      <path d="M227.3 62 518.3 230" stroke="var(--bst-text)" strokeWidth="1.2" />

      {selected ? (
        <rect x={selected.x - 13} y={selected.y - 13} width="26" height="26" fill="none" stroke="var(--bst-text)" strokeWidth="1" strokeDasharray="4 3" />
      ) : null}

      {sensors.map((s) => {
        const color = toleranceColor(s.state);
        const active = s.id === selectedId;
        return (
          <g key={s.id} onClick={() => onSelect(s.id)} style={{ cursor: 'pointer' }} role="button" tabIndex={0} aria-label={`${s.code}: ${s.value}`}>
            <circle cx={s.x} cy={s.y} r={active ? 8.5 : 7} fill="var(--bst-bg)" stroke={color} strokeWidth={active ? 2 : 1.8} strokeDasharray={s.state === 'offline' ? '3 2' : undefined} />
            {s.state === 'ok' ? <circle cx={s.x} cy={s.y} r="2.4" fill={color} /> : null}
            {s.state !== 'ok' && s.state !== 'offline' ? <path d={`M${s.x} ${s.y - 3.5} ${s.x + 3.4} ${s.y + 2.5}h-6.8z`} fill={color} /> : null}
            {s.state === 'offline' ? <path d={`M${s.x - 3.5} ${s.y - 3.5} ${s.x + 3.5} ${s.y + 3.5}M${s.x + 3.5} ${s.y - 3.5} ${s.x - 3.5} ${s.y + 3.5}`} stroke={color} strokeWidth="1.2" /> : null}
            {active ? <circle cx={s.x} cy={s.y} r="14" fill="none" stroke={color} strokeWidth="0.8" strokeDasharray="3 3" /> : null}
            <text x={s.x + 11} y={s.y - 2} fontFamily="var(--bst-font-mono)" fontSize="9.5" fill={color}>
              {s.code}
            </text>
            <text x={s.x + 11} y={s.y + 9} fontFamily="var(--bst-font-mono)" fontSize="9.5" fill="var(--bst-text)">
              {s.value}
            </text>
          </g>
        );
      })}

      <g transform="translate(16,392)">
        <rect x="0" y="0" width="250" height="62" fill="var(--bst-bg)" stroke="var(--bst-line-strong)" />
        <text x="10" y="15" fontFamily="var(--bst-font-mono)" fontSize="9" fill="var(--bst-text-mute)" letterSpacing="1">
          УСЛОВНЫЕ ОБОЗНАЧЕНИЯ
        </text>
        {(
          [
            ['ok', legend.ok, 16, 29, 28, 32, 'в допуске'],
            ['warning', legend.warning, 16, 43, 28, 46, 'у границы'],
            ['alarm', legend.alarm, 146, 29, 158, 32, 'вне допуска'],
            ['offline', legend.offline, 146, 43, 158, 46, 'нет связи'],
          ] as const
        ).map(([state, count, cx, cy, tx, ty, label]) => (
          <g key={state}>
            <circle cx={cx} cy={cy} r="5" fill="none" stroke={toleranceColor(state)} strokeWidth="1.6" strokeDasharray={state === 'offline' ? '3 2' : undefined} />
            <text x={tx} y={ty} fontFamily="var(--bst-font-mono)" fontSize="9" fill="var(--bst-text)">
              {GLYPH[state]} {label} ({count})
            </text>
          </g>
        ))}
      </g>
      <text x="640" y="452" fontFamily="var(--bst-font-mono)" fontSize="9" fill="var(--bst-text-mute)">
        {scale}
      </text>
    </svg>
  );
}
