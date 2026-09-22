'use client';

import { useState } from 'react';
import { Frame, SectionEyebrow } from '@bestech/ui-kit';
import type { LiveTwin } from '@/lib/twin/live';
import { SCENARIOS, type ScenarioId } from '@/lib/twin/shared';
import { formatNumber } from '@/lib/format';
import { AlarmBanner } from './LiveTwin';
import { refreshLive, useLiveTwin } from './useLiveTwin';

export interface IngestPanelProps {
  code: string;
  initial: LiveTwin;
  /** Управлять эмулятором могут технадзор и проектировщик на демо-объекте. */
  canControl: boolean;
  endpoint: string;
  lanEndpoints: string[];
  demoKey: string | null;
}

function Pre({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <pre
        className="bst-mono"
        style={{ margin: 0, padding: '28px 12px 10px', fontSize: 11, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', border: '1px solid var(--bst-line)', background: 'var(--bst-surface)' }}
      >
        {children}
      </pre>
      <button
        type="button"
        className="bst-btn bst-btn--sm bst-btn--ghost"
        style={{ position: 'absolute', top: 4, right: 4 }}
        onClick={() => {
          void navigator.clipboard?.writeText(children).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? 'скопировано' : 'копировать'}
      </button>
    </div>
  );
}

/**
 * Приём данных: журнал входящих пакетов, точка приёма для шлюзов и пульт
 * эмулятора. Экран показывает, что портал принимает поток от устройств, —
 * каждая строка журнала это HTTP-запрос, пришедший на API приёма.
 */
export function IngestPanel({ code, initial, canControl, endpoint, lanEndpoints, demoKey }: IngestPanelProps) {
  const live = useLiveTwin(code, '24h', initial);
  const emulator = live.emulator ?? initial.emulator;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function control(body: { action: 'start' | 'stop' | 'reset' | 'scenario'; scenario?: ScenarioId }) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/twin/${encodeURIComponent(code)}/emulator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `Ошибка ${res.status}`);
    } finally {
      setPending(false);
      refreshLive(code);
    }
  }

  const key = demoKey ?? '<ключ устройства>';
  const sample = JSON.stringify({ device: 'gw-01', readings: [{ sensor: 'Ф-2', value: 72.5 }, { sensor: 'ГМ-07', value: 11.4 }] }, null, 2);
  const curl = [
    `curl -X POST ${endpoint} \\`,
    `  -H "Authorization: Bearer ${key}" \\`,
    '  -H "Content-Type: application/json" \\',
    `  -d '{"device":"gw-01","readings":[{"sensor":"Ф-2","value":72.5}]}'`,
  ].join('\n');
  const powershell = [
    `$body = '{"device":"laptop","readings":[{"sensor":"Ф-2","value":91}]}'`,
    `Invoke-RestMethod -Method Post -Uri '${endpoint}' \``,
    `  -Headers @{ Authorization = 'Bearer ${key}' } \``,
    `  -ContentType 'application/json; charset=utf-8' \``,
    '  -Body ([Text.Encoding]::UTF8.GetBytes($body))',
  ].join('\n');

  const agoLabel = live.stats.lastPacketAgoS === null ? '—' : live.stats.lastPacketAgoS < 2 ? 'только что' : `${live.stats.lastPacketAgoS} с назад`;

  return (
    <>
      <AlarmBanner code={code} live={live} canAct={canControl} />
      <div className="page">
        <div className="grid-4">
          <Frame padded>
            <div className="bst-kpi__label">Пакетов за минуту</div>
            <div className="bst-mono" style={{ fontSize: 30, lineHeight: 1.2, color: live.stats.packetsPerMin ? 'var(--bst-ok)' : 'var(--bst-text-mute)' }}>
              {live.stats.packetsPerMin}
            </div>
            <div className="bst-kpi__foot">
              <span>устройств: {live.stats.devices.length || 0}</span>
              <span>{live.stats.devices.join(', ') || '—'}</span>
            </div>
          </Frame>
          <Frame padded>
            <div className="bst-kpi__label">Показаний принято</div>
            <div className="bst-mono" style={{ fontSize: 30, lineHeight: 1.2 }}>
              {formatNumber(live.stats.readingsTotal)}
            </div>
            <div className="bst-kpi__foot">
              <span>хранится 3 суток</span>
            </div>
          </Frame>
          <Frame padded>
            <div className="bst-kpi__label">Последний пакет</div>
            <div className="bst-mono" style={{ fontSize: 30, lineHeight: 1.2 }}>
              {live.stats.lastPacketLabel}
            </div>
            <div className="bst-kpi__foot">
              <span>{agoLabel}</span>
            </div>
          </Frame>
          <Frame padded>
            <div className="bst-kpi__label">Датчиков на связи</div>
            <div className="bst-mono" style={{ fontSize: 30, lineHeight: 1.2, color: 'var(--bst-ok)' }}>
              {live.summary.sensorsOnline}
              <span style={{ fontSize: 15, color: 'var(--bst-text-mute)' }}>/{live.summary.sensorsTotal}</span>
            </div>
            <div className="bst-kpi__foot">
              <span>{live.summary.offline ? `✕ ${live.summary.offline} без связи` : 'все отвечают'}</span>
            </div>
          </Frame>
        </div>

        <div className="split" style={{ gridTemplateColumns: 'minmax(0, 1fr) 480px' }}>
          <div>
            <SectionEyebrow aside="обновление каждые 2 с">ВХОДЯЩИЕ ПАКЕТЫ · API ПРИЁМА</SectionEyebrow>
            <table className="bst-table" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Время</th>
                  <th>Устройство</th>
                  <th style={{ width: 120 }}>Адрес</th>
                  <th style={{ width: 70, textAlign: 'right' }}>Принято</th>
                  <th style={{ width: 70, textAlign: 'right' }}>Откл.</th>
                  <th style={{ width: 56 }}>Код</th>
                  <th>Примечание</th>
                </tr>
              </thead>
              <tbody>
                {live.packets.map((p) => (
                  <tr key={p.id}>
                    <td className="bst-mono" style={{ fontSize: 11 }}>
                      {p.time}
                    </td>
                    <td className="bst-mono" style={{ fontSize: 11 }}>
                      {p.device}
                    </td>
                    <td className="bst-mono" style={{ fontSize: 11, color: 'var(--bst-text-mute)' }}>
                      {p.remote}
                    </td>
                    <td className="bst-num" style={{ fontSize: 12 }}>
                      {p.accepted}
                    </td>
                    <td className="bst-num" style={{ fontSize: 12, color: p.rejected ? 'var(--bst-warn)' : 'var(--bst-text-mute)' }}>
                      {p.rejected}
                    </td>
                    <td className="bst-mono" style={{ fontSize: 11, color: p.status === 202 ? 'var(--bst-ok)' : 'var(--bst-alarm)' }}>
                      {p.status}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--bst-text-soft)' }}>{p.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {live.packets.length === 0 ? (
              <p className="bst-mono" style={{ fontSize: 12, color: 'var(--bst-text-mute)' }}>
                Пакетов ещё не было. Запустите эмулятор справа или отправьте запрос из примера.
              </p>
            ) : null}
          </div>

          <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
            {canControl && emulator ? (
              <Frame padded>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="bst-kpi__label">Эмулятор датчиков · демо-стенд</div>
                  <span className="bst-stamp" style={{ marginLeft: 'auto', color: emulator.running ? 'var(--bst-ok)' : 'var(--bst-text-mute)' }}>
                    <span aria-hidden="true">{emulator.running ? '●' : '○'}</span>
                    {emulator.running ? `РАБОТАЕТ С ${emulator.startedLabel}` : 'ОСТАНОВЛЕН'}
                  </span>
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--bst-text-soft)', margin: '8px 0 12px' }}>
                  Отдельный процесс-шлюз emulator-01: 12 датчиков объекта, пакет каждые 3 с через тот же API, что и реальный шлюз.
                  При старте досылает буфер за 10 минут.
                </p>

                <div style={{ display: 'flex', gap: 8 }}>
                  {emulator.running ? (
                    <button type="button" className="bst-btn" onClick={() => control({ action: 'stop' })} disabled={pending}>
                      Остановить
                    </button>
                  ) : (
                    <button type="button" className="bst-btn bst-btn--primary" onClick={() => control({ action: 'start' })} disabled={pending || !emulator.available}>
                      Запустить эмулятор
                    </button>
                  )}
                  <button
                    type="button"
                    className="bst-btn bst-btn--ghost"
                    style={{ marginLeft: 'auto' }}
                    disabled={pending}
                    title="Остановить эмулятор и удалить показания, пакеты и аварии объекта"
                    onClick={() => {
                      if (window.confirm('Сбросить демо-данные? Эмулятор остановится, показания, журнал пакетов и аварии объекта будут удалены.')) {
                        void control({ action: 'reset' });
                      }
                    }}
                  >
                    Сбросить демо-данные
                  </button>
                </div>

                <div className="bst-kpi__label" style={{ margin: '14px 0 6px' }}>
                  Сценарии
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {SCENARIOS.map((s) => {
                    const active = emulator.running && emulator.scenario === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={!emulator.running || pending}
                        onClick={() => control({ action: 'scenario', scenario: s.id })}
                        style={{
                          textAlign: 'left',
                          font: 'inherit',
                          color: 'inherit',
                          cursor: emulator.running ? 'pointer' : 'not-allowed',
                          padding: '8px 10px',
                          border: `1px solid ${active ? 'var(--bst-accent)' : 'var(--bst-line)'}`,
                          background: active ? 'var(--bst-accent-tint)' : 'transparent',
                          opacity: emulator.running ? 1 : 0.5,
                        }}
                      >
                        <span style={{ display: 'block', fontSize: 13 }}>{s.label}</span>
                        <span className="bst-mono" style={{ display: 'block', fontSize: 10, color: 'var(--bst-text-mute)' }}>
                          {s.note}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {error ? (
                  <p role="alert" className="bst-mono" style={{ fontSize: 11, color: 'var(--bst-alarm)', margin: '8px 0 0' }}>
                    ▲ {error}
                  </p>
                ) : null}

                <pre
                  className="bst-mono"
                  style={{ margin: '12px 0 0', padding: 10, height: 150, overflow: 'auto', fontSize: 10.5, lineHeight: 1.5, border: '1px solid var(--bst-line)', background: 'var(--bst-surface)' }}
                >
                  {emulator.lines.length ? [...emulator.lines].reverse().join('\n') : 'журнал эмулятора пуст'}
                </pre>
              </Frame>
            ) : null}

            <Frame padded>
              <div className="bst-kpi__label">Точка приёма для шлюзов</div>
              <div className="bst-mono" style={{ fontSize: 12, margin: '10px 0 4px', overflowWrap: 'anywhere' }}>
                POST {endpoint}
              </div>
              {lanEndpoints.length ? (
                <div className="bst-mono" style={{ fontSize: 10.5, color: 'var(--bst-text-mute)', overflowWrap: 'anywhere' }}>
                  из локальной сети: {lanEndpoints.join(' · ')}
                </div>
              ) : null}
              <div style={{ display: 'grid', gap: 4, margin: '10px 0', fontSize: 12.5, color: 'var(--bst-text-soft)' }}>
                <span>
                  Заголовок <span className="bst-mono">Authorization: Bearer</span> — ключ устройства, привязанный к объекту.
                </span>
                <span>
                  Ключ демо-шлюза: <span className="bst-mono" style={{ color: 'var(--bst-text)' }}>{demoKey ?? 'выдаётся на устройство'}</span>
                </span>
                <span>Показания вне допуска открывают аварию, возврат в допуск — закрывает; молчание дольше 4 периодов — «нет связи».</span>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <Pre>{sample}</Pre>
                <Pre>{curl}</Pre>
                <Pre>{powershell}</Pre>
              </div>
              <p className="bst-mono" style={{ fontSize: 10, color: 'var(--bst-text-mute)', margin: '10px 0 0' }}>
                LoRaWAN, MQTT и Modbus подключаются шлюзом, который переводит их пакеты в этот формат.
              </p>
            </Frame>
          </div>
        </div>
      </div>
    </>
  );
}
