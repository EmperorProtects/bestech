'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Button, ButtonLink, DimensionLine, Segmented, ToleranceStamp } from '@bestech/ui-kit';
import type { Sensor, TwinSummary } from '@/api/types';
import { useTwinStore } from '@/store/twin';
import { toleranceColor } from '@/lib/format';
import { ModelViewer } from './ModelViewer';

/** three.js работает только в браузере — вьюер грузится отдельным чанком без SSR. */
const ModelViewer3D = dynamic(() => import('./ModelViewer3D'), {
  ssr: false,
  loading: () => (
    <div className="bst-mono" style={{ display: 'grid', placeItems: 'center', height: '100%', minHeight: 420, fontSize: 11, color: 'var(--bst-text-mute)' }}>
      загрузка 3D-модели…
    </div>
  ),
});

export interface TwinOverviewProps {
  code: string;
  sensors: Sensor[];
  summary: TwinSummary;
}

/** C1. Обзор двойника: вьюер с датчиками, метрики, список последних измерений. */
export function TwinOverview({ code, sensors, summary }: TwinOverviewProps) {
  const selectedId = useTwinStore((s) => s.selectedSensorId);
  const selectSensor = useTwinStore((s) => s.selectSensor);
  const [view, setView] = useState<'3d' | 'scheme'>('3d');

  // По умолчанию выделяем самый критичный датчик — оператор видит проблему сразу.
  useEffect(() => {
    if (selectedId && sensors.some((s) => s.id === selectedId)) return;
    const worst =
      sensors.find((s) => s.state === 'alarm') ??
      sensors.find((s) => s.state === 'warning') ??
      sensors[0];
    if (worst) selectSensor(worst.id);
  }, [sensors, selectedId, selectSensor]);

  const selected = sensors.find((s) => s.id === selectedId) ?? sensors[0];
  const viewerProps = {
    sensors,
    selectedId: selected?.id ?? null,
    onSelect: selectSensor,
    scale: summary.scale,
    legend: { ok: summary.withinTolerance, warning: summary.nearTolerance, alarm: summary.outOfTolerance, offline: summary.offline },
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 352px', flex: 1, minHeight: 0 }}>
      <section style={{ borderRight: '1px solid var(--bst-line)', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--bst-line)', fontFamily: 'var(--bst-font-mono)', fontSize: 11 }}>
          <span style={{ color: 'var(--bst-text-mute)', letterSpacing: '0.12em' }}>◭ МОДЕЛЬ ОБЪЕКТА · КАРКАС</span>
          <Segmented
            ariaLabel="Вид модели"
            value={view}
            onChange={setView}
            options={[
              { value: '3d', label: '3D МОДЕЛЬ' },
              { value: 'scheme', label: 'СХЕМА' },
            ]}
          />
          <span style={{ marginLeft: 'auto', color: 'var(--bst-text-mute)' }}>обновлено {summary.updated}</span>
        </div>

        <div style={{ flex: 1, background: 'var(--bst-raised)', minHeight: 520, position: 'relative' }}>
          {view === '3d' ? <ModelViewer3D {...viewerProps} /> : <ModelViewer {...viewerProps} />}
        </div>

        {selected ? (
          <div style={{ borderTop: '1px solid var(--bst-line)', padding: '14px 16px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 20, alignItems: 'center', background: 'var(--bst-surface)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                <span className="bst-mono" style={{ fontSize: 11, border: '1px solid var(--bst-line)', padding: '2px 7px' }}>
                  {selected.code}
                </span>
                <span style={{ fontFamily: 'var(--bst-font-heading)', fontSize: 19, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{selected.name}</span>
                <ToleranceStamp status={selected.state} />
              </div>
              <div className="bst-mono" style={{ fontSize: 12, color: 'var(--bst-text-mute)' }}>
                {selected.meta}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <ButtonLink href={`/twin/${code}/telemetry`} size="sm">
                История
              </ButtonLink>
              <ButtonLink href={`/twin/${code}/deviations`} variant="primary" size="sm">
                Открыть измерения
              </ButtonLink>
            </div>
          </div>
        ) : null}
      </section>

      <aside style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--bst-line)' }}>
          <div style={{ padding: 'var(--bst-card-pad)', borderRight: '1px solid var(--bst-line)' }}>
            <div className="bst-kpi__label">Готовность СМР</div>
            <div className="bst-mono" style={{ fontSize: 30, lineHeight: 1.15 }}>
              {summary.progress} <span style={{ fontSize: 15, color: 'var(--bst-text-mute)' }}>%</span>
            </div>
            <DimensionLine value={summary.progress / 100} plan={summary.plannedProgress / 100} height={10} arrow={false} />
            <div className="bst-kpi__foot">
              <span>план {summary.plannedProgress}</span>
              <span>факт {summary.progress}</span>
            </div>
          </div>
          <div style={{ padding: 'var(--bst-card-pad)' }}>
            <div className="bst-kpi__label">Датчики на связи</div>
            <div className="bst-mono" style={{ fontSize: 30, lineHeight: 1.15 }}>
              {summary.sensorsOnline}
              <span style={{ fontSize: 15, color: 'var(--bst-text-mute)' }}>/{summary.sensorsTotal}</span>
            </div>
            <DimensionLine value={summary.sensorsOnline / Math.max(1, summary.sensorsTotal)} height={10} color="var(--bst-ok)" arrow={false} />
            <div className="bst-mono" style={{ fontSize: 10, color: 'var(--bst-text-mute)', marginTop: 3 }}>
              {summary.offline ? `${summary.offline} без связи` : 'все приборы отвечают'}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--bst-line)' }}>
          <div style={{ padding: 'var(--bst-card-pad)', borderRight: '1px solid var(--bst-line)' }}>
            <div className="bst-kpi__label">В допуске</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span className="bst-mono" style={{ fontSize: 26, color: 'var(--bst-ok)' }}>
                {summary.withinTolerance}
              </span>
              <span className="bst-mono" style={{ fontSize: 11, color: 'var(--bst-ok)' }}>
                ● норма
              </span>
            </div>
          </div>
          <div style={{ padding: 'var(--bst-card-pad)' }}>
            <div className="bst-kpi__label">Вне допуска</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span className="bst-mono" style={{ fontSize: 26, color: 'var(--bst-alarm)' }}>
                {summary.outOfTolerance}
              </span>
              <span className="bst-mono" style={{ fontSize: 11, color: 'var(--bst-warn)' }}>
                ▲ {summary.nearTolerance} у границы
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--bst-line)', fontFamily: 'var(--bst-font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--bst-text-mute)' }}>
          ◭ ПОСЛЕДНИЕ ИЗМЕРЕНИЯ
          <span style={{ marginLeft: 'auto' }}>{summary.updated.slice(-5)}</span>
        </div>

        <div style={{ display: 'grid' }}>
          {sensors.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => selectSensor(s.id)}
              style={{
                display: 'grid',
                gridTemplateColumns: '22px 68px minmax(0, 1fr) auto',
                gap: 10,
                alignItems: 'center',
                textAlign: 'left',
                background: s.id === selected?.id ? 'var(--bst-surface)' : 'transparent',
                border: 0,
                borderBottom: '1px solid var(--bst-line)',
                borderLeft: `2px solid ${s.id === selected?.id ? 'var(--bst-text)' : 'transparent'}`,
                padding: 'var(--bst-row-pad)',
                cursor: 'pointer',
                font: 'inherit',
                color: 'var(--bst-text)',
              }}
            >
              <span className="bst-mono" style={{ fontSize: 11, color: toleranceColor(s.state) }} aria-hidden="true">
                {s.state === 'ok' ? '●' : s.state === 'offline' ? '✕' : '▲'}
              </span>
              <span className="bst-mono" style={{ fontSize: 11 }}>
                {s.code}
              </span>
              <span style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
              <span className="bst-mono" style={{ fontSize: 12, color: toleranceColor(s.state) }}>
                {s.value}
              </span>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 'auto', padding: '12px 14px', borderTop: '1px solid var(--bst-line)', display: 'flex', gap: 8 }}>
          <ButtonLink href={`/api/twin/${encodeURIComponent(code)}/export`} block size="sm">
            Экспорт CSV
          </ButtonLink>
          <Button block size="sm">
            Настроить пороги
          </Button>
        </div>
      </aside>
    </div>
  );
}
