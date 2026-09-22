'use client';

import { BarChart, Frame, LineChart, ToleranceStamp } from '@bestech/ui-kit';
import type { Sensor, TelemetryChart } from '@/api/types';
import { useTwinStore } from '@/store/twin';
import { toleranceColor } from '@/lib/format';

const PERIODS = [
  { value: '24h' as const, label: '24 Ч', range: '10.09.2026 09:40 — 11.09.2026 09:40' },
  { value: '7d' as const, label: '7 ДН', range: '04.09.2026 — 11.09.2026' },
  { value: '30d' as const, label: '30 ДН', range: '12.08.2026 — 11.09.2026' },
  { value: 'all' as const, label: 'ВСЁ', range: '01.08.2026 — 11.09.2026' },
];

/** C3. Телеметрия: период, пороговые линии, прогноз, таблица приборов. */
export interface TelemetryPanelProps {
  charts: TelemetryChart[];
  sensors: Sensor[];
  /** Периоды выбора; в живом режиме это окна в минутах. */
  periods?: { value: (typeof PERIODS)[number]['value']; label: string; range: string }[];
  pollNote?: string;
  forecastLabel?: string;
}

export function TelemetryPanel({
  charts,
  sensors,
  periods = PERIODS,
  pollNote = 'опрос каждые 15 мин',
  forecastLabel = 'проектный прогноз',
}: TelemetryPanelProps) {
  const { period, showThresholds, showForecast } = useTwinStore();
  const { setPeriod, setShowThresholds, setShowForecast } = useTwinStore();
  const range = periods.find((p) => p.value === period)?.range ?? '';

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 20px', borderBottom: '1px solid var(--bst-line)', flexWrap: 'wrap', fontFamily: 'var(--bst-font-mono)', fontSize: 11 }}>
        <span style={{ color: 'var(--bst-text-mute)', letterSpacing: '0.1em' }}>ПЕРИОД</span>
        <div className="bst-seg">
          {periods.map((p) => (
            <button key={p.value} type="button" className="bst-seg__opt" data-active={p.value === period} onClick={() => setPeriod(p.value)}>
              {p.label}
            </button>
          ))}
        </div>
        <span style={{ color: 'var(--bst-text-mute)', marginLeft: 6 }}>{range}</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, marginLeft: 'auto', cursor: 'pointer', color: 'var(--bst-accent-ink)' }}>
          <input type="checkbox" checked={showForecast} onChange={(e) => setShowForecast(e.target.checked)} />
          {forecastLabel}
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', color: 'var(--bst-accent-ink)' }}>
          <input type="checkbox" checked={showThresholds} onChange={(e) => setShowThresholds(e.target.checked)} />
          пороговые линии
        </label>
      </div>

      <div className="page">
        {charts.map((chart, index) => (
          <Frame key={chart.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--bst-line)', flexWrap: 'wrap', fontFamily: 'var(--bst-font-mono)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--bst-text-mute)' }}>
              <span>
                ◭ {String(index + 1).padStart(2, '0')} · {chart.title.toUpperCase()}
              </span>
              <ToleranceStamp status={chart.state} />
              <span style={{ marginLeft: 'auto', color: 'var(--bst-text)' }}>{chart.current}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 250px' }}>
              <div style={{ padding: '8px 0' }}>
                {chart.kind === 'bar' && chart.bars ? (
                  <BarChart bars={chart.bars} max={chart.max} threshold={chart.thresholds[0]} showThresholds={showThresholds} unit={chart.unit} />
                ) : (
                  <LineChart
                    series={chart.series.filter((s) => showForecast || s.id !== 'forecast')}
                    xLabels={chart.xLabels}
                    yTicks={chart.yTicks}
                    max={chart.max}
                    thresholds={chart.thresholds}
                    showThresholds={showThresholds}
                    unit={chart.unit}
                  />
                )}
              </div>
              <div style={{ borderLeft: '1px solid var(--bst-line)', padding: 14 }}>
                <div style={{ display: 'grid', gap: 8, fontFamily: 'var(--bst-font-mono)', fontSize: 11 }}>
                  {chart.series.map((s) => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <svg width="20" height="6" aria-hidden="true">
                        <path d="M0 3H20" stroke={s.color} strokeWidth={s.dashed ? 1.4 : 2} strokeDasharray={s.dashed ? '4 3' : undefined} />
                      </svg>
                      <span>{s.label}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--bst-line)', display: 'grid', gap: 7, fontFamily: 'var(--bst-font-mono)', fontSize: 11 }}>
                  {chart.summary.map((s) => (
                    <div key={s.k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ color: 'var(--bst-text-mute)' }}>{s.k}</span>
                      <span>{s.v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, fontFamily: 'var(--bst-font-mono)', fontSize: 10, color: 'var(--bst-text-mute)' }}>{chart.subtitle}</div>
              </div>
            </div>
          </Frame>
        ))}

        <div>
          <div className="bst-eyebrow-row" style={{ marginBottom: 12 }}>
            <span className="bst-eyebrow">◭ ПРИБОРЫ И ПОСЛЕДНИЕ ЗНАЧЕНИЯ</span>
            <span className="bst-eyebrow-row__rule" />
            <span className="bst-eyebrow-row__aside">{pollNote}</span>
          </div>
          <table className="bst-table">
            <thead>
              <tr>
                <th style={{ width: 38 }}>№</th>
                <th style={{ width: 90 }}>Прибор</th>
                <th style={{ width: 58 }}>Разд.</th>
                <th>Параметр и размещение</th>
                <th style={{ width: 120, textAlign: 'right' }}>Значение</th>
                <th style={{ width: 120, textAlign: 'right' }}>Порог</th>
                <th style={{ width: 150 }}>Состояние</th>
                <th style={{ width: 120 }}>Пакет</th>
              </tr>
            </thead>
            <tbody>
              {sensors.map((s, i) => (
                <tr key={s.id}>
                  <td className="bst-mono" style={{ fontSize: 11, color: 'var(--bst-text-mute)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </td>
                  <td className="bst-mono" style={{ fontSize: 11.5 }}>
                    {s.code}
                  </td>
                  <td>
                    <span className="bst-mono" style={{ fontSize: 10, border: '1px solid var(--bst-line-strong)', padding: '1px 6px', color: 'var(--bst-accent-ink)' }}>
                      {s.discipline}
                    </span>
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {s.name} · {s.axis}
                  </td>
                  <td className="bst-num" style={{ fontSize: 12, color: toleranceColor(s.state) }}>
                    {s.value}
                  </td>
                  <td className="bst-num" style={{ fontSize: 12, color: 'var(--bst-text-mute)' }}>
                    {s.limit}
                  </td>
                  <td>
                    <ToleranceStamp status={s.state} />
                  </td>
                  <td className="bst-mono" style={{ fontSize: 11, color: 'var(--bst-text-mute)' }}>
                    {s.seen}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
