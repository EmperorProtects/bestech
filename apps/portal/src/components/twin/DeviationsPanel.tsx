'use client';

import { useEffect, useMemo } from 'react';
import { ButtonLink, Sparkline, ToleranceStamp } from '@bestech/ui-kit';
import type { Deviation } from '@/api/types';
import { useTwinStore } from '@/store/twin';
import { toleranceColor } from '@/lib/format';

const DISCIPLINES = ['ВСЕ', 'ГП', 'КЖ', 'КМ', 'ОВ', 'ВК', 'ЭОМ'];

/** C2. Таблица факт / проект: фильтры, выбор строки подсвечивает элемент в модели. */
export function DeviationsPanel({ code, deviations }: { code: string; deviations: Deviation[] }) {
  const { discipline, level, onlyDeviations, selectedDeviationId } = useTwinStore();
  const { setDiscipline, setLevel, setOnlyDeviations, selectDeviation } = useTwinStore();

  const levels = useMemo(() => ['ВСЕ', ...Array.from(new Set(deviations.map((d) => d.level)))], [deviations]);

  const visible = useMemo(
    () =>
      deviations.filter(
        (d) =>
          (discipline === 'ВСЕ' || d.discipline === discipline) &&
          (level === 'ВСЕ' || d.level === level) &&
          (!onlyDeviations || d.state !== 'ok'),
      ),
    [deviations, discipline, level, onlyDeviations],
  );

  useEffect(() => {
    if (selectedDeviationId && deviations.some((d) => d.id === selectedDeviationId)) return;
    const worst = deviations.find((d) => d.state === 'alarm') ?? deviations.find((d) => d.state === 'warning') ?? deviations[0];
    if (worst) selectDeviation(worst.id);
  }, [deviations, selectedDeviationId, selectDeviation]);

  const selected = deviations.find((d) => d.id === selectedDeviationId) ?? visible[0] ?? deviations[0];
  const labelRight = (selected?.x ?? 0) < 240;
  const lx = labelRight ? (selected?.x ?? 0) + 60 : (selected?.x ?? 0) - 60;
  const ly = (selected?.y ?? 0) < 120 ? (selected?.y ?? 0) + 60 : (selected?.y ?? 0) - 50;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 20px', borderBottom: '1px solid var(--bst-line)', flexWrap: 'wrap', fontFamily: 'var(--bst-font-mono)', fontSize: 11 }}>
        <span style={{ color: 'var(--bst-text-mute)', letterSpacing: '0.1em' }}>РАЗДЕЛ</span>
        <div className="bst-seg">
          {DISCIPLINES.map((d) => (
            <button key={d} type="button" className="bst-seg__opt" data-active={d === discipline} onClick={() => setDiscipline(d)}>
              {d}
            </button>
          ))}
        </div>
        <span style={{ color: 'var(--bst-text-mute)', letterSpacing: '0.1em', marginLeft: 10 }}>УРОВЕНЬ</span>
        <div className="bst-seg">
          {levels.map((l) => (
            <button key={l} type="button" className="bst-seg__opt" data-active={l === level} onClick={() => setLevel(l)}>
              {l}
            </button>
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, marginLeft: 12, cursor: 'pointer', color: 'var(--bst-accent-ink)' }}>
          <input type="checkbox" checked={onlyDeviations} onChange={(e) => setOnlyDeviations(e.target.checked)} />
          только отклонения
        </label>
        <span style={{ marginLeft: 'auto', color: 'var(--bst-text-mute)' }}>
          ПОКАЗАНО: {visible.length} из {deviations.length}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 420px', flex: 1, minHeight: 0 }}>
        <section style={{ borderRight: '1px solid var(--bst-line)', overflow: 'auto' }}>
          <table className="bst-table bst-table--sticky">
            <thead>
              <tr>
                <th style={{ width: 38 }}>№</th>
                <th style={{ width: 58 }}>Разд.</th>
                <th>Параметр</th>
                <th style={{ width: 88 }}>Элемент</th>
                <th style={{ width: 96, textAlign: 'right' }}>Проект</th>
                <th style={{ width: 96, textAlign: 'right' }}>Факт</th>
                <th style={{ width: 80, textAlign: 'right' }}>Δ</th>
                <th style={{ width: 90, textAlign: 'right' }}>Допуск</th>
                <th style={{ width: 150 }}>Состояние</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((d, i) => (
                <tr
                  key={d.id}
                  data-selected={d.id === selected?.id ? 'true' : undefined}
                  onClick={() => selectDeviation(d.id)}
                  style={{ cursor: 'pointer', borderLeft: `2px solid ${d.id === selected?.id ? 'var(--bst-text)' : 'transparent'}` }}
                >
                  <td className="bst-mono" style={{ fontSize: 11, color: 'var(--bst-text-mute)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </td>
                  <td>
                    <span className="bst-mono" style={{ fontSize: 10, border: '1px solid var(--bst-line-strong)', padding: '1px 6px', color: 'var(--bst-accent-ink)' }}>
                      {d.discipline}
                    </span>
                  </td>
                  <td style={{ fontSize: 13 }}>{d.parameter}</td>
                  <td className="bst-mono" style={{ fontSize: 11, color: 'var(--bst-text-mute)' }}>
                    {d.element}
                  </td>
                  <td className="bst-num" style={{ fontSize: 12, color: 'var(--bst-text-mute)' }}>
                    {d.design}
                  </td>
                  <td className="bst-num" style={{ fontSize: 12 }}>
                    {d.actual}
                  </td>
                  <td className="bst-num" style={{ fontSize: 12, color: toleranceColor(d.state) }}>
                    {d.delta}
                  </td>
                  <td className="bst-num" style={{ fontSize: 12, color: 'var(--bst-text-mute)' }}>
                    {d.tolerance}
                  </td>
                  <td>
                    <ToleranceStamp status={d.state} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <aside style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'auto' }}>
          <div style={{ padding: '9px 14px', borderBottom: '1px solid var(--bst-line)', fontFamily: 'var(--bst-font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--bst-text-mute)', display: 'flex', gap: 8 }}>
            ◭ ЭЛЕМЕНТ В МОДЕЛИ
            <span style={{ marginLeft: 'auto', color: 'var(--bst-text)' }}>
              {selected ? `${selected.element} · ${selected.level}` : '—'}
            </span>
          </div>

          {selected ? (
            <>
              <div style={{ background: 'var(--bst-raised)', borderBottom: '1px solid var(--bst-line)' }}>
                <svg viewBox="0 0 420 300" width="100%" height="auto" style={{ display: 'block' }} role="img" aria-label="Каркасная модель с выделенным элементом">
                  <g transform="matrix(9,5.2,-9,5.2,210,110)" stroke="var(--bst-grid)" strokeWidth="0.14" fill="none">
                    <path d="M0 -1V11M4 -1V11M8 -1V11M12 -1V11M16 -1V11M20 -1V11" />
                    <path d="M-1 0H21M-1 4H21M-1 8H21" />
                  </g>
                  <g transform="matrix(9,5.2,-9,5.2,210,110)" stroke="var(--bst-accent-700)" strokeWidth="0.16" fill="none">
                    <path d="M0 0H20V10H0Z" />
                  </g>
                  <g fontFamily="var(--bst-font-mono)" fontSize="9" fill="var(--bst-text-mute)" textAnchor="middle">
                    <text x="228" y="103">1</text>
                    <text x="264" y="124">2</text>
                    <text x="300" y="145">3</text>
                    <text x="336" y="166">4</text>
                    <text x="372" y="187">5</text>
                    <text x="192" y="103">А</text>
                    <text x="156" y="124">Б</text>
                    <text x="120" y="145">В</text>
                  </g>
                  <polygon points="165,44 345,148 300,208 120,104" fill="var(--bst-bg)" stroke="var(--bst-accent-700)" strokeWidth="0.9" />
                  <polygon points="210,52 390,156 345,148 165,44" fill="var(--bst-surface)" stroke="var(--bst-accent)" strokeWidth="1" />
                  <g transform="matrix(9,5.2,0,-11,210,110)" stroke="var(--bst-accent)" strokeWidth="0.12" fill="none">
                    <path d="M0 0H20V5H0Z" strokeWidth="0.15" />
                    <path d="M4 0V5M8 0V5M12 0V5M16 0V5" />
                  </g>
                  <g transform="matrix(-9,5.2,0,-11,210,110)" stroke="var(--bst-accent)" strokeWidth="0.14" fill="none">
                    <path d="M0 0H10V5L5 8.5L0 5Z" />
                  </g>
                  <path d="M165 44 345 148" stroke="var(--bst-text)" strokeWidth="1.1" />

                  <path d={selected.path} stroke={toleranceColor(selected.state)} strokeWidth="4" fill="none" opacity="0.9" />
                  <circle cx={selected.x} cy={selected.y} r="16" fill="none" stroke={toleranceColor(selected.state)} strokeWidth="1" strokeDasharray="4 3" />
                  <path d={`M${selected.x} ${selected.y} L${lx} ${ly}`} stroke={toleranceColor(selected.state)} strokeWidth="0.8" strokeDasharray="3 2" />
                  <rect x={labelRight ? lx : lx - 126} y={ly - 13} width="126" height="26" fill="var(--bst-bg)" stroke={toleranceColor(selected.state)} />
                  <text x={(labelRight ? lx : lx - 126) + 7} y={ly - 1} fontFamily="var(--bst-font-mono)" fontSize="9" fill={toleranceColor(selected.state)}>
                    {selected.state === 'ok' ? '● В ДОПУСКЕ' : selected.state === 'alarm' ? '▲ ВНЕ ДОПУСКА' : '▲ У ГРАНИЦЫ'}
                  </text>
                  <text x={(labelRight ? lx : lx - 126) + 7} y={ly + 10} fontFamily="var(--bst-font-mono)" fontSize="9" fill="var(--bst-text)">
                    {selected.element} · {selected.actual}
                  </text>
                </svg>
              </div>

              <div style={{ padding: 16, borderBottom: '1px solid var(--bst-line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                  <span className="bst-mono" style={{ fontSize: 10, border: '1px solid var(--bst-line)', padding: '2px 7px' }}>
                    {selected.discipline}
                  </span>
                  <span style={{ fontFamily: 'var(--bst-font-heading)', fontSize: 19, textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1.1 }}>{selected.parameter}</span>
                </div>
                <div className="bst-titleblock" style={{ minWidth: 0 }}>
                  <div className="bst-titleblock__k">ПРОЕКТ</div>
                  <div className="bst-titleblock__v">{selected.design}</div>
                  <div className="bst-titleblock__k">ФАКТ</div>
                  <div className="bst-titleblock__v">{selected.actual}</div>
                  <div className="bst-titleblock__k">Δ / ДОПУСК</div>
                  <div className="bst-titleblock__v" style={{ color: toleranceColor(selected.state) }}>
                    {selected.delta} при допуске {selected.tolerance}
                  </div>
                  <div className="bst-titleblock__k">ИСТОЧНИК</div>
                  <div className="bst-titleblock__v">{selected.source}</div>
                  <div className="bst-titleblock__k">НОРМА</div>
                  <div className="bst-titleblock__v">{selected.norm}</div>
                </div>
              </div>

              <div style={{ padding: 16 }}>
                <div className="bst-kpi__label" style={{ marginBottom: 10 }}>
                  ◭ История измерений
                </div>
                <Sparkline values={selected.series} threshold={selected.thresholdValue} color={toleranceColor(selected.state)} />
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <ButtonLink href={`/twin/${code}/telemetry`} block size="sm">
                    Телеметрия
                  </ButtonLink>
                  <ButtonLink href={`/twin/${code}`} variant="primary" block size="sm">
                    Показать на обзоре
                  </ButtonLink>
                </div>
              </div>
            </>
          ) : null}
        </aside>
      </div>
    </>
  );
}
