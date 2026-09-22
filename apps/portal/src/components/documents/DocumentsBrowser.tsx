'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, FileDown } from 'lucide-react';
import { DOC_STATUS, type DocStatus } from '@bestech/tokens';
import { Frame, ScheduleTable, SectionEyebrow, Segmented, StatusStamp } from '@bestech/ui-kit';
import type { DocSection, DocSheet, SheetRemark } from '@/api/types';

type Filter = 'all' | 'issued' | 'review' | 'remarks';

const FILTER_STATUS: Record<Exclude<Filter, 'all'>, DocStatus> = {
  issued: 'issued',
  review: 'review',
  remarks: 'remarks',
};

export interface DocumentsBrowserProps {
  assetCode: string;
  sections: DocSection[];
  sheets: DocSheet[];
  openRemarks: SheetRemark[];
}

/**
 * B5. Ведомость разделов ПД и листы выбранного раздела.
 * Отсюда заказчик получает чертежи: лист открывается в просмотрщике,
 * скачивается поштучно или комплектом выбранных разделов одним архивом.
 */
export function DocumentsBrowser({ assetCode, sections, sheets, openRemarks }: DocumentsBrowserProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [activeSection, setActiveSection] = useState<string>(sections[0]?.code ?? '');

  const visible = useMemo(
    () => (filter === 'all' ? sections : sections.filter((s) => s.status === FILTER_STATUS[filter])),
    [sections, filter],
  );

  const selectedCodes = useMemo(() => visible.filter((s) => selected[s.code]).map((s) => s.code), [visible, selected]);
  const activeSheets = useMemo(() => sheets.filter((s) => s.sectionCode === activeSection), [sheets, activeSection]);
  const active = sections.find((s) => s.code === activeSection);

  const totals = useMemo(() => {
    const by = (status: DocStatus) => sections.filter((s) => s.status === status).length;
    const totalSheets = sections.reduce((n, s) => n + s.sheetsCount, 0);
    const issuedSheets = sections.filter((s) => s.status === 'issued').reduce((n, s) => n + s.sheetsCount, 0);
    return {
      issued: by('issued'),
      review: by('review'),
      remarks: by('remarks'),
      progress: by('progress'),
      totalSheets,
      readiness: totalSheets === 0 ? 0 : Math.round((issuedSheets / totalSheets) * 100),
    };
  }, [sections]);

  const allChecked = visible.length > 0 && visible.every((s) => selected[s.code]);
  const bundleHref = `/api/assets/${assetCode}/bundle${selectedCodes.length ? `?sections=${encodeURIComponent(selectedCodes.join(','))}` : ''}`;

  function toggleAll() {
    setSelected((prev) => {
      const next = { ...prev };
      for (const s of visible) next[s.code] = !allChecked;
      return next;
    });
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px', borderBottom: '1px solid var(--bst-line)', flexWrap: 'wrap' }}>
        <Segmented
          ariaLabel="Фильтр по статусу раздела"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'ВСЕ' },
            { value: 'issued', label: 'ВЫДАНО' },
            { value: 'review', label: 'НА ПРОВЕРКЕ' },
            { value: 'remarks', label: 'ЗАМЕЧАНИЯ' },
          ]}
        />
        <span className="bst-mono" style={{ fontSize: 11, color: 'var(--bst-text-mute)' }}>
          {selectedCodes.length > 0 ? `ВЫБРАНО РАЗДЕЛОВ: ${selectedCodes.length}` : `РАЗДЕЛОВ: ${visible.length}`}
        </span>
        <div style={{ marginLeft: 'auto' }}>
          <a href={bundleHref} className="bst-btn bst-btn--primary" style={{ position: 'relative' }} download>
            <i className="bst-corner bst-corner--tl" aria-hidden="true" />
            <i className="bst-corner bst-corner--tr" aria-hidden="true" />
            <i className="bst-corner bst-corner--bl" aria-hidden="true" />
            <i className="bst-corner bst-corner--br" aria-hidden="true" />
            <Download size={14} strokeWidth={1.5} aria-hidden="true" />
            {selectedCodes.length > 0 ? `Скачать выбранное (${selectedCodes.length})` : 'Скачать весь комплект'}
          </a>
        </div>
      </div>

      <div className="page">
        <div className="split">
          <div style={{ display: 'grid', gap: 26 }}>
            <div>
              <SectionEyebrow aside={`${totals.totalSheets} листов`}>ВЕДОМОСТЬ РАЗДЕЛОВ ПД</SectionEyebrow>
              <div style={{ marginTop: 14 }}>
                <ScheduleTable
                  rows={visible}
                  rowKey={(r) => r.code}
                  selectedKey={activeSection}
                  onRowClick={(r) => setActiveSection(r.code)}
                  columns={[
                    {
                      id: 'pick',
                      header: (
                        <input
                          type="checkbox"
                          aria-label="Выбрать все разделы"
                          checked={allChecked}
                          onChange={toggleAll}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ),
                      width: 34,
                      cell: (r) => (
                        <input
                          type="checkbox"
                          aria-label={`Выбрать раздел ${r.code}`}
                          checked={!!selected[r.code]}
                          onChange={() => setSelected((p) => ({ ...p, [r.code]: !p[r.code] }))}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ),
                    },
                    { id: 'code', header: 'Разд.', width: 60, cell: (r) => <span className="bst-badge">{r.code}</span> },
                    { id: 'name', header: 'Наименование раздела', cell: (r) => r.name },
                    { id: 'sheets', header: 'Листов', width: 70, align: 'right', cell: (r) => r.sheetsCount },
                    { id: 'ver', header: 'Вер.', width: 52, align: 'right', cell: (r) => r.version },
                    { id: 'author', header: 'Автор', width: 120, cell: (r) => r.author },
                    { id: 'status', header: 'Статус', width: 140, cell: (r) => <StatusStamp status={r.status} /> },
                    {
                      id: 'remarks',
                      header: 'Замеч.',
                      width: 70,
                      align: 'right',
                      cell: (r) =>
                        r.remarksCount > 0 ? (
                          <span className="bst-mono" style={{ color: 'var(--bst-warn)' }}>
                            ▲ {r.remarksCount}
                          </span>
                        ) : (
                          <span className="bst-mono" style={{ color: 'var(--bst-text-mute)' }}>
                            —
                          </span>
                        ),
                    },
                    {
                      id: 'issued',
                      header: 'Выдан',
                      width: 96,
                      cell: (r) => (
                        <span className="bst-mono" style={{ fontSize: 11 }}>
                          {r.issued ?? '—'}
                        </span>
                      ),
                    },
                  ]}
                />
              </div>
            </div>

            <div>
              <SectionEyebrow aside={active ? `${activeSheets.length} из ${active.sheetsCount} листов выпущено` : undefined}>
                ЛИСТЫ РАЗДЕЛА {activeSection} · ВЕРСИЯ {active?.version ?? '—'}
              </SectionEyebrow>
              <div style={{ marginTop: 14 }}>
                {activeSheets.length > 0 ? (
                  <ScheduleTable
                    rows={activeSheets}
                    rowKey={(r) => r.code}
                    columns={[
                      {
                        id: 'code',
                        header: 'Лист',
                        width: 92,
                        cell: (r) => (
                          <Link href={`/cabinet/assets/${assetCode}/documents/${encodeURIComponent(r.code)}`} className="bst-mono" style={{ fontSize: 12 }}>
                            {r.code}
                          </Link>
                        ),
                      },
                      { id: 'name', header: 'Наименование', cell: (r) => r.name },
                      { id: 'format', header: 'Формат', width: 74, cell: (r) => <span className="bst-mono">{r.format}</span> },
                      {
                        id: 'remark',
                        header: 'Замечания',
                        width: 130,
                        cell: (r) =>
                          r.openRemarks > 0 ? (
                            <span className="bst-mono" style={{ fontSize: 11, color: 'var(--bst-warn)' }}>
                              ▲ {r.openRemarks} открыто
                            </span>
                          ) : (
                            <span className="bst-mono" style={{ fontSize: 11, color: 'var(--bst-text-mute)' }}>
                              —
                            </span>
                          ),
                      },
                      {
                        id: 'changed',
                        header: 'Изменён',
                        width: 96,
                        cell: (r) => (
                          <span className="bst-mono" style={{ fontSize: 11 }}>
                            {r.changed}
                          </span>
                        ),
                      },
                      {
                        id: 'get',
                        header: 'Получить',
                        width: 150,
                        cell: (r) => (
                          <span style={{ display: 'flex', gap: 8 }}>
                            <Link href={`/cabinet/assets/${assetCode}/documents/${encodeURIComponent(r.code)}`} className="bst-btn bst-btn--sm">
                              Открыть
                            </Link>
                            <a
                              href={`/api/assets/${assetCode}/sheets/${encodeURIComponent(r.code)}?download=1`}
                              className="bst-btn bst-btn--sm bst-btn--icon"
                              aria-label={`Скачать лист ${r.code}`}
                              title={r.fileName ? `Скачать ${r.fileName}` : 'Скачать лист'}
                              download
                            >
                              <FileDown size={14} strokeWidth={1.5} aria-hidden="true" />
                            </a>
                          </span>
                        ),
                      },
                    ]}
                  />
                ) : (
                  <p className="bst-mono" style={{ fontSize: 12, color: 'var(--bst-text-mute)' }}>
                    В разделе пока нет выпущенных листов.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 20 }}>
            <Frame padded>
              <div className="bst-kpi__label">Комплект ПД</div>
              <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                {(
                  [
                    ['issued', totals.issued],
                    ['review', totals.review],
                    ['remarks', totals.remarks],
                    ['progress', totals.progress],
                  ] as [DocStatus, number][]
                ).map(([status, n]) => (
                  <div key={status} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                    <span className="bst-stamp" style={{ color: DOC_STATUS[status].cssVar }}>
                      <span aria-hidden="true">{DOC_STATUS[status].glyph}</span>
                      {DOC_STATUS[status].label.toUpperCase()}
                    </span>
                    <span className="bst-mono" style={{ fontSize: 13 }}>
                      {n} {n === 1 ? 'раздел' : 'разд.'}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--bst-line)', display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="bst-mono" style={{ fontSize: 28, lineHeight: 1 }}>
                  {totals.readiness}
                </span>
                <span className="bst-mono" style={{ fontSize: 12, color: 'var(--bst-text-mute)' }}>
                  % готовности комплекта по листам
                </span>
              </div>
            </Frame>

            <div>
              <SectionEyebrow rule={false}>ОТКРЫТЫЕ ЗАМЕЧАНИЯ</SectionEyebrow>
              <div style={{ display: 'grid', borderTop: '1px solid var(--bst-line)', marginTop: 12 }}>
                {openRemarks.map((r) => (
                  <Link
                    key={r.id}
                    href={`/cabinet/assets/${assetCode}/documents/${encodeURIComponent(r.sheetCode)}?remark=${encodeURIComponent(r.id)}`}
                    style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--bst-line)', color: 'var(--bst-text)' }}
                  >
                    <span className="bst-mono" style={{ fontSize: 11, color: 'var(--bst-warn)' }} aria-hidden="true">
                      ▲
                    </span>
                    <span>
                      <span style={{ display: 'block', fontSize: 13.5 }}>
                        Лист {r.sheetCode}: {r.text}
                      </span>
                      <span className="bst-mono" style={{ fontSize: 10, color: 'var(--bst-text-mute)' }}>
                        {r.clause} · {r.date}
                      </span>
                    </span>
                  </Link>
                ))}
                {openRemarks.length === 0 ? (
                  <div style={{ padding: '12px 0', fontSize: 13.5, color: 'var(--bst-ok)' }}>● Открытых замечаний нет</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
