'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Download, Maximize2 } from 'lucide-react';
import { Frame, SectionEyebrow, TitleBlock } from '@bestech/ui-kit';
import type { DocSheet, SheetRemark } from '@/api/types';

export interface SheetViewerProps {
  assetCode: string;
  sheet: DocSheet;
  /** Соседние листы раздела — полоса миниатюр под просмотрщиком. */
  siblings: DocSheet[];
  remarks: SheetRemark[];
  /** Замечание, открытое по ссылке из ведомости. */
  initialRemarkId?: string;
  /** Лист собран порталом из данных БД, исходник ещё не загружен. */
  generated: boolean;
  /** Как показывать источник: вектор портала, страница PDF, текст или файл без просмотра. */
  mode: 'svg' | 'pdf' | 'text' | 'file';
}

const PIN_VIEWBOX = { w: 760, h: 470 };

/**
 * B6. Просмотр листа: сам чертёж, пины замечаний нормоконтроля и переписка
 * по каждому. Чертёж отдаёт маршрут `/api/assets/:code/sheets/:sheet` — он же
 * используется кнопкой скачивания, так что показанное и скачанное совпадают.
 */
export function SheetViewer({ assetCode, sheet, siblings, remarks, initialRemarkId, generated, mode }: SheetViewerProps) {
  const initialIndex = Math.max(0, remarks.findIndex((r) => r.id === initialRemarkId));
  const [active, setActive] = useState(initialIndex);

  const src = `/api/assets/${assetCode}/sheets/${encodeURIComponent(sheet.code)}`;
  const open = remarks.filter((r) => r.status === 'open').length;

  return (
    <div className="page">
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 24, alignItems: 'start' }}>
        <div>
          <SectionEyebrow rule={false}>
            ЛИСТ {sheet.code} · РАЗДЕЛ {sheet.sectionCode}
          </SectionEyebrow>
          <h1 className="bst-h" style={{ fontSize: 30, margin: '8px 0 6px', lineHeight: 1.06 }}>
            {sheet.name}
          </h1>
          <div className="bst-mono" style={{ fontSize: 12, color: 'var(--bst-text-mute)' }}>
            Формат {sheet.format} · изм. {sheet.version} от {sheet.changed} · автор {sheet.sectionAuthor}
          </div>
        </div>

        <TitleBlock
          minWidth={330}
          rows={[
            { k: 'ИСТОЧНИК', v: generated ? 'сформирован порталом' : (sheet.fileName ?? 'загруженный файл') },
            { k: 'ЗАМЕЧАНИЙ', v: open > 0 ? <span style={{ color: 'var(--bst-warn)' }}>▲ {open} открыто</span> : <span style={{ color: 'var(--bst-ok)' }}>● нет</span> },
            { k: 'ФОРМАТ', v: sheet.format },
            { k: 'ИЗМЕНЕНИЕ', v: `${sheet.version} от ${sheet.changed}` },
          ]}
        />
      </div>

      <div className="split">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <a href={`${src}?download=1`} className="bst-btn bst-btn--primary" style={{ position: 'relative' }} download>
              <i className="bst-corner bst-corner--tl" aria-hidden="true" />
              <i className="bst-corner bst-corner--tr" aria-hidden="true" />
              <i className="bst-corner bst-corner--bl" aria-hidden="true" />
              <i className="bst-corner bst-corner--br" aria-hidden="true" />
              <Download size={14} strokeWidth={1.5} aria-hidden="true" />
              {mode === 'pdf' ? 'Скачать альбом PDF' : mode === 'text' ? 'Скачать документ' : 'Скачать лист'}
            </a>
            <a href={src} target="_blank" rel="noreferrer" className="bst-btn">
              <Maximize2 size={14} strokeWidth={1.5} aria-hidden="true" />
              Открыть в полном размере
            </a>
            <a href={`/api/assets/${assetCode}/bundle?sections=${encodeURIComponent(sheet.sectionCode)}`} className="bst-btn" download>
              Скачать раздел {sheet.sectionCode}
            </a>
          </div>

          {mode === 'pdf' || mode === 'text' ? (
            <Frame>
              {/* Альбом из мастерской — один PDF, лист открывается своей страницей. */}
              <iframe
                title={`Лист ${sheet.code}. ${sheet.name}`}
                src={mode === 'pdf' ? `${src}#page=${sheet.position}&view=Fit` : src}
                style={{ display: 'block', width: '100%', height: 'min(78vh, 760px)', border: 0, background: '#fbfaf7' }}
              />
            </Frame>
          ) : mode === 'file' ? (
            <Frame padded>
              <p style={{ margin: 0, fontSize: 14 }}>Файл «{sheet.fileName}» браузер не показывает — скачайте его и откройте в САПР.</p>
            </Frame>
          ) : (
          <Frame>
            <div style={{ position: 'relative', background: '#fbfaf7' }}>
              {/* Чертёж и слой пинов растянуты по одной области, поэтому пины
                  держатся своих мест при любом размере окна. */}
              {/* next/image здесь не подходит: лист — вектор из закрытого сессией
                  маршрута, растрировать и кешировать его на CDN нечего и нельзя. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Лист ${sheet.code}. ${sheet.name}`} style={{ display: 'block', width: '100%' }} />
              <svg
                viewBox={`0 0 ${PIN_VIEWBOX.w} ${PIN_VIEWBOX.h}`}
                preserveAspectRatio="none"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                role="group"
                aria-label="Замечания нормоконтроля на листе"
              >
                {remarks.map((r, i) => {
                  const color = r.status === 'open' ? 'var(--bst-warn)' : 'var(--bst-ok)';
                  return (
                    <g key={r.id} onClick={() => setActive(i)} style={{ cursor: 'pointer' }}>
                      {i === active ? <circle cx={r.x} cy={r.y} r={20} fill={color} opacity={0.16} /> : null}
                      <circle cx={r.x} cy={r.y} r={i === active ? 13 : 11} fill="#fbfaf7" stroke={color} strokeWidth={1.6} />
                      <text x={r.x} y={r.y + 4} textAnchor="middle" fontSize={12} fill={color} fontFamily="var(--bst-font-mono)">
                        {r.number}
                      </text>
                      <title>{`Замечание ${r.number}: ${r.text}`}</title>
                    </g>
                  );
                })}
              </svg>
            </div>
          </Frame>
          )}

          {siblings.length > 1 ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 14, overflowX: 'auto', paddingBottom: 4 }}>
              {siblings.map((s) => {
                const current = s.code === sheet.code;
                return (
                  <Link
                    key={s.code}
                    href={`/cabinet/assets/${assetCode}/documents/${encodeURIComponent(s.code)}`}
                    className="bst-mono"
                    style={{
                      flex: 'none',
                      padding: '7px 11px',
                      fontSize: 11,
                      border: `1px solid ${current ? 'var(--bst-accent)' : 'var(--bst-line)'}`,
                      background: current ? 'var(--bst-accent-tint)' : 'transparent',
                      color: current ? 'var(--bst-accent-ink)' : 'var(--bst-text-soft)',
                    }}
                    aria-current={current ? 'page' : undefined}
                  >
                    {s.code}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>

        <div>
          <SectionEyebrow rule={false}>ЗАМЕЧАНИЯ НОРМОКОНТРОЛЯ</SectionEyebrow>
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            {remarks.map((r, i) => {
              const openState = r.status === 'open';
              const color = openState ? 'var(--bst-warn)' : 'var(--bst-ok)';
              const isActive = i === active;
              return (
                <div
                  key={r.id}
                  style={{
                    border: '1px solid var(--bst-line)',
                    borderLeft: `2px solid ${isActive ? color : 'transparent'}`,
                    background: isActive ? 'var(--bst-accent-tint)' : 'transparent',
                    padding: '11px 13px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    aria-expanded={isActive}
                    style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}
                  >
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, justifyContent: 'space-between' }}>
                      <span className="bst-stamp" style={{ color }}>
                        <span aria-hidden="true">{openState ? '▲' : '●'}</span>
                        {openState ? 'ОТКРЫТО' : 'ЗАКРЫТО'} · {r.number}
                      </span>
                      <span className="bst-mono" style={{ fontSize: 10, color: 'var(--bst-text-mute)' }}>
                        {r.date}
                      </span>
                    </span>
                    <span style={{ display: 'block', fontSize: 13.5, marginTop: 7, lineHeight: 1.45 }}>{r.text}</span>
                    <span className="bst-mono" style={{ display: 'block', fontSize: 10, color: 'var(--bst-text-mute)', marginTop: 5 }}>
                      {r.clause} · {r.locus}
                    </span>
                  </button>

                  {isActive && r.thread.length > 0 ? (
                    <div style={{ display: 'grid', gap: 10, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--bst-line)' }}>
                      {r.thread.map((m) => (
                        <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '26px minmax(0, 1fr)', gap: 9 }}>
                          <span
                            className="bst-mono"
                            style={{ width: 26, height: 26, border: '1px solid var(--bst-line)', display: 'grid', placeItems: 'center', fontSize: 10 }}
                          >
                            {m.initials}
                          </span>
                          <span>
                            <span className="bst-mono" style={{ display: 'block', fontSize: 10, color: 'var(--bst-text-mute)' }}>
                              {m.author} · {m.role} · {m.createdAt}
                            </span>
                            <span style={{ display: 'block', fontSize: 13, lineHeight: 1.45, marginTop: 3 }}>{m.text}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {remarks.length === 0 ? (
              <p style={{ fontSize: 13.5, color: 'var(--bst-ok)', margin: 0 }}>● Замечаний по листу нет — лист принят нормоконтролем.</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
