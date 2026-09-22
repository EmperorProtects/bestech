'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EmptyState } from '@bestech/ui-kit';
import type { LiveTwin } from '@/lib/twin/live';
import { LIVE_PERIODS } from '@/lib/twin/shared';
import { useTwinStore } from '@/store/twin';
import { TelemetryPanel } from './TelemetryPanel';
import { TwinOverview } from './TwinOverview';
import { refreshLive, useLiveTwin } from './useLiveTwin';

/** Индикатор в шапке: поток идёт, сколько аварий открыто. */
export function LiveBadge({ code, initial }: { code: string; initial: LiveTwin }) {
  const live = useLiveTwin(code, '24h', initial);
  const open = live.alarms.filter((a) => !a.closedLabel);
  const critical = open.filter((a) => a.level === 'alarm').length;
  const fresh = live.stats.lastPacketAgoS !== null && live.stats.lastPacketAgoS < 15;

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span className="bst-mono" style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 6, color: fresh ? 'var(--bst-ok)' : 'var(--bst-text-mute)' }}>
        <span className={fresh ? 'live-dot' : undefined} aria-hidden="true">
          ●
        </span>
        {fresh ? `LIVE · ${live.stats.lastPacketLabel}` : 'ПОТОК НЕ ИДЁТ'}
      </span>
      {critical > 0 ? (
        <span className="bst-stamp bst-stamp--lg" style={{ color: 'var(--bst-alarm)' }}>
          <span aria-hidden="true">▲</span>
          {critical} АВАРИЯ
        </span>
      ) : open.length > 0 ? (
        <span className="bst-stamp bst-stamp--lg" style={{ color: 'var(--bst-warn)' }}>
          <span aria-hidden="true">▲</span>
          {open.length} ПРЕДУПР.
        </span>
      ) : (
        <span className="bst-stamp bst-stamp--lg" style={{ color: 'var(--bst-ok)' }}>
          <span aria-hidden="true">●</span>
          БЕЗ АВАРИЙ
        </span>
      )}
    </span>
  );
}

/** Полоса новой аварии: появляется на любом экране двойника, пока аварию не квитировали. */
export function AlarmBanner({ code, live, canAct }: { code: string; live: LiveTwin; canAct: boolean }) {
  const [pending, setPending] = useState(false);
  const alarm = live.alarms.find((a) => !a.closedLabel && !a.ackLabel && a.level !== 'warning');
  if (!alarm) return null;

  const color = alarm.level === 'alarm' ? 'var(--bst-alarm)' : 'var(--bst-offline)';

  async function ack() {
    if (!alarm) return;
    setPending(true);
    try {
      await fetch(`/api/twin/${encodeURIComponent(code)}/alarms/${alarm.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ack' }),
      });
      refreshLive(code);
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      role="alert"
      className="alarm-banner"
      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px', borderBottom: `1.5px solid ${color}`, background: 'var(--bst-alarm-tint)', flexWrap: 'wrap' }}
    >
      <span className="bst-stamp" style={{ color }}>
        <span aria-hidden="true">{alarm.level === 'alarm' ? '▲' : '✕'}</span>
        {alarm.code}
      </span>
      <span style={{ fontSize: 14 }}>{alarm.title}</span>
      <span className="bst-mono" style={{ fontSize: 11, color: 'var(--bst-text-soft)' }}>
        {alarm.message} · {alarm.openedLabel.slice(-8)}
      </span>
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        <Link href={`/twin/${encodeURIComponent(code)}/alarms?alarm=${alarm.id}`} className="bst-btn bst-btn--sm">
          Открыть инцидент
        </Link>
        {canAct ? (
          <button type="button" className="bst-btn bst-btn--sm bst-btn--primary" onClick={ack} disabled={pending}>
            Квитировать
          </button>
        ) : null}
      </span>
    </div>
  );
}

/** Строка-подсказка, пока от устройств не пришло ни одного пакета. */
function NoDataHint({ code }: { code: string }) {
  return (
    <div className="bst-mono" style={{ padding: '10px 16px', borderBottom: '1px solid var(--bst-line)', fontSize: 11, color: 'var(--bst-warn)' }}>
      ▲ Пакетов от датчиков ещё не было. Подключите шлюз или запустите эмулятор на вкладке{' '}
      <Link href={`/twin/${encodeURIComponent(code)}/ingest`}>«Приём данных»</Link>.
    </div>
  );
}

/** C1 в живом режиме: модель и список датчиков обновляются по мере прихода пакетов. */
export function LiveOverview({ code, initial, canAct }: { code: string; initial: LiveTwin; canAct: boolean }) {
  const live = useLiveTwin(code, '24h', initial);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <AlarmBanner code={code} live={live} canAct={canAct} />
      {live.hasData ? null : <NoDataHint code={code} />}
      <TwinOverview code={code} sensors={live.sensors} summary={live.summary} />
    </div>
  );
}

/** C3 в живом режиме: окна в минутах, графики строятся из принятых показаний. */
export function LiveTelemetry({ code, initial, canAct }: { code: string; initial: LiveTwin; canAct: boolean }) {
  const period = useTwinStore((s) => s.period);
  const setPeriod = useTwinStore((s) => s.setPeriod);
  const live = useLiveTwin(code, period, initial);

  // В живом режиме открываем самое короткое окно — в нём видно, как приходят пакеты.
  useEffect(() => {
    setPeriod('24h');
  }, [setPeriod]);

  return (
    <>
      <AlarmBanner code={code} live={live} canAct={canAct} />
      {live.hasData ? null : <NoDataHint code={code} />}
      {live.charts.length ? (
        <TelemetryPanel
          charts={live.charts}
          sensors={live.sensors}
          periods={LIVE_PERIODS.map((p) => ({ value: p.value, label: p.label, range: live.stats.range }))}
          pollNote={`${live.stats.packetsPerMin} пакетов в минуту · обновление каждые 2 с`}
          forecastLabel="прогноз по тренду"
        />
      ) : (
        <div className="page">
          <EmptyState title="Графиков пока нет" note="Датчики объекта не прислали показаний за выбранное окно." />
        </div>
      )}
    </>
  );
}
