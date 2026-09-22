'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Frame, Segmented, SectionEyebrow, Sparkline } from '@bestech/ui-kit';
import type { LiveAlarm, LiveTwin } from '@/lib/twin/live';
import { AlarmBanner } from './LiveTwin';
import { refreshLive, useLiveTwin } from './useLiveTwin';

type Filter = 'open' | 'all' | 'closed';

const LEVEL: Record<LiveAlarm['level'], { label: string; glyph: string; color: string }> = {
  alarm: { label: 'КРИТИЧНО', glyph: '▲', color: 'var(--bst-alarm)' },
  warning: { label: 'ПРЕДУПРЕЖДЕНИЕ', glyph: '▲', color: 'var(--bst-warn)' },
  offline: { label: 'НЕТ СВЯЗИ', glyph: '✕', color: 'var(--bst-offline)' },
};

function statusOf(a: LiveAlarm): string {
  if (a.closedLabel) return 'ЗАКРЫТО';
  if (a.ackLabel) return 'КВИТИРОВАНО';
  return 'ОТКРЫТО';
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr)', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--bst-line)' }}>
      <span className="bst-mono" style={{ fontSize: 10, color: 'var(--bst-text-mute)' }}>
        {k}
      </span>
      <span style={{ fontSize: 13 }}>{v}</span>
    </div>
  );
}

/** C5. Очередь аварий: создаются автоматически по телеметрии, квитируются и закрываются здесь. */
export function AlarmsPanel({ code, initial, canAct, initialAlarmId }: { code: string; initial: LiveTwin; canAct: boolean; initialAlarmId?: string }) {
  const live = useLiveTwin(code, '24h', initial);
  const [filter, setFilter] = useState<Filter>('open');
  const [selectedId, setSelectedId] = useState<string | null>(initialAlarmId ?? null);
  const [pending, setPending] = useState(false);

  const visible = useMemo(
    () => live.alarms.filter((a) => (filter === 'all' ? true : filter === 'open' ? !a.closedLabel : Boolean(a.closedLabel))),
    [live.alarms, filter],
  );
  const selected = live.alarms.find((a) => a.id === selectedId) ?? visible[0] ?? null;

  const open = live.alarms.filter((a) => !a.closedLabel);
  const counts = {
    alarm: open.filter((a) => a.level === 'alarm').length,
    warning: open.filter((a) => a.level === 'warning').length,
    offline: open.filter((a) => a.level === 'offline').length,
    closed: live.alarms.filter((a) => a.closedLabel).length,
  };

  async function act(action: 'ack' | 'close') {
    if (!selected) return;
    setPending(true);
    try {
      await fetch(`/api/twin/${encodeURIComponent(code)}/alarms/${selected.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      refreshLive(code);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <AlarmBanner code={code} live={live} canAct={canAct} />
      <div className="page">
        <div className="grid-4">
          {[
            { k: 'Критичных открыто', v: counts.alarm, color: 'var(--bst-alarm)', glyph: '▲' },
            { k: 'Предупреждений', v: counts.warning, color: 'var(--bst-warn)', glyph: '▲' },
            { k: 'Датчиков без связи', v: counts.offline, color: 'var(--bst-offline)', glyph: '✕' },
            { k: 'Закрыто за сутки', v: counts.closed, color: 'var(--bst-ok)', glyph: '●' },
          ].map((t) => (
            <Frame key={t.k} padded>
              <div className="bst-kpi__label">{t.k}</div>
              <div className="bst-mono" style={{ fontSize: 30, lineHeight: 1.2, color: t.v ? t.color : 'var(--bst-text-mute)' }}>
                {t.v ? `${t.glyph} ${t.v}` : '0'}
              </div>
            </Frame>
          ))}
        </div>

        <div className="split" style={{ gridTemplateColumns: 'minmax(0, 1fr) 460px' }}>
          <div>
            <SectionEyebrow
              aside={
                <Segmented
                  ariaLabel="Фильтр очереди"
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: 'open', label: 'ОТКРЫТЫЕ' },
                    { value: 'all', label: 'ВСЕ' },
                    { value: 'closed', label: 'ЗАКРЫТЫЕ' },
                  ]}
                />
              }
            >
              ОЧЕРЕДЬ АВАРИЙ И ИНЦИДЕНТОВ
            </SectionEyebrow>

            <div style={{ display: 'grid', marginTop: 12, borderTop: '1px solid var(--bst-line)' }}>
              {visible.map((a) => {
                const lv = LEVEL[a.level];
                const active = a.id === selected?.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedId(a.id)}
                    style={{
                      textAlign: 'left',
                      font: 'inherit',
                      color: 'inherit',
                      cursor: 'pointer',
                      border: 0,
                      borderBottom: '1px solid var(--bst-line)',
                      borderLeft: `2px solid ${active ? lv.color : 'transparent'}`,
                      background: active ? 'var(--bst-surface)' : 'transparent',
                      padding: '11px 12px',
                      opacity: a.closedLabel ? 0.62 : 1,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span className="bst-stamp" style={{ color: lv.color }}>
                        <span aria-hidden="true">{lv.glyph}</span>
                        {lv.label}
                      </span>
                      <span className="bst-mono" style={{ fontSize: 11 }}>
                        {a.code}
                      </span>
                      <span className="bst-mono" style={{ fontSize: 10, border: '1px solid var(--bst-line-strong)', padding: '0 5px' }}>
                        {a.discipline}
                      </span>
                      <span className="bst-mono" style={{ fontSize: 10, marginLeft: 'auto', color: 'var(--bst-text-mute)' }}>
                        {statusOf(a)} · {a.openedLabel.slice(-8)}
                      </span>
                    </span>
                    <span style={{ display: 'block', fontSize: 14, marginTop: 6 }}>{a.title}</span>
                    <span className="bst-mono" style={{ display: 'block', fontSize: 11, color: 'var(--bst-text-soft)', marginTop: 3 }}>
                      {a.message}
                    </span>
                  </button>
                );
              })}
              {visible.length === 0 ? (
                <div style={{ padding: '14px 0', fontSize: 14, color: 'var(--bst-ok)' }}>
                  {filter === 'open' ? '● Открытых аварий нет — все параметры в допуске' : 'Записей нет'}
                </div>
              ) : null}
            </div>
          </div>

          {selected ? (
            <Frame padded>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className="bst-stamp bst-stamp--lg" style={{ color: LEVEL[selected.level].color }}>
                  <span aria-hidden="true">{LEVEL[selected.level].glyph}</span>
                  {LEVEL[selected.level].label}
                </span>
                <span className="bst-mono" style={{ fontSize: 12 }}>
                  {selected.code}
                </span>
                <span className="bst-mono" style={{ fontSize: 10, marginLeft: 'auto', color: 'var(--bst-text-mute)' }}>
                  {statusOf(selected)}
                </span>
              </div>
              <h2 className="bst-h" style={{ fontSize: 20, lineHeight: 1.15, margin: '10px 0 6px' }}>
                {selected.title}
              </h2>
              <p style={{ fontSize: 13.5, color: 'var(--bst-text-soft)', margin: '0 0 12px' }}>{selected.message}</p>

              <div style={{ borderTop: '1px solid var(--bst-line)' }}>
                <Row k="ДАТЧИК" v={`${selected.sensorCode} · ${selected.sensorName}`} />
                <Row k="РАЗМЕЩЕНИЕ" v={selected.axis} />
                <Row k="ЗНАЧЕНИЕ" v={<span style={{ color: LEVEL[selected.level].color }}>{selected.value}</span>} />
                <Row k="ПОРОГ" v={selected.threshold} />
                <Row k="ИСТОЧНИК" v="телеметрия · API приёма, инцидент создан автоматически" />
              </div>

              {selected.series.length > 1 ? (
                <div style={{ marginTop: 14 }}>
                  <div className="bst-kpi__label" style={{ marginBottom: 6 }}>
                    Динамика параметра, {selected.unit}
                  </div>
                  <Sparkline
                    values={selected.series}
                    color={LEVEL[selected.level].color}
                    {...(selected.limitValue !== null ? { threshold: selected.limitValue } : {})}
                    height={130}
                  />
                </div>
              ) : null}

              <div className="bst-kpi__label" style={{ margin: '16px 0 6px' }}>
                История инцидента
              </div>
              <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                <div>
                  <span className="bst-mono" style={{ fontSize: 10, color: 'var(--bst-text-mute)' }}>
                    {selected.openedLabel} ·{' '}
                  </span>
                  <span style={{ color: LEVEL[selected.level].color }}>{LEVEL[selected.level].glyph}</span> создан автоматически: {selected.message}
                  <span className="bst-mono" style={{ fontSize: 10, color: 'var(--bst-text-mute)' }}>
                    {' '}
                    · платформа BESTECH
                  </span>
                </div>
                {selected.ackLabel ? (
                  <div>
                    <span className="bst-mono" style={{ fontSize: 10, color: 'var(--bst-text-mute)' }}>
                      {selected.ackLabel} ·{' '}
                    </span>
                    ● квитирован · {selected.ackBy}
                  </div>
                ) : null}
                {selected.closedLabel ? (
                  <div>
                    <span className="bst-mono" style={{ fontSize: 10, color: 'var(--bst-text-mute)' }}>
                      {selected.closedLabel} ·{' '}
                    </span>
                    <span style={{ color: 'var(--bst-ok)' }}>●</span> закрыт: {selected.closeNote}
                  </div>
                ) : null}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--bst-line)' }}>
                {canAct && !selected.closedLabel && !selected.ackLabel ? (
                  <button type="button" className="bst-btn bst-btn--primary bst-btn--sm" onClick={() => act('ack')} disabled={pending}>
                    Квитировать
                  </button>
                ) : null}
                {canAct && !selected.closedLabel ? (
                  <button type="button" className="bst-btn bst-btn--sm" onClick={() => act('close')} disabled={pending}>
                    Закрыть инцидент
                  </button>
                ) : null}
                <Link href={`/twin/${encodeURIComponent(code)}`} className="bst-btn bst-btn--sm">
                  Показать на модели
                </Link>
                <Link href={`/twin/${encodeURIComponent(code)}/telemetry`} className="bst-btn bst-btn--sm">
                  Телеметрия
                </Link>
              </div>
            </Frame>
          ) : null}
        </div>
      </div>
    </>
  );
}
