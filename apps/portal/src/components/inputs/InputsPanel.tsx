'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Download, Upload } from 'lucide-react';
import { AiNotice, DimensionLine, Dropzone, Frame, ScheduleTable, SectionEyebrow } from '@bestech/ui-kit';
import type { Completeness, InputDoc, InputDocState } from '@/api/types';
import { uploadInputFiles, requestMissingDocs, type UploadState } from '@/app/cabinet/assets/[code]/inputs/actions';
import { toleranceColor } from '@/lib/format';

const STATE_LABEL: Record<InputDocState, { label: string; glyph: string; color: string }> = {
  accepted: { label: 'ПРИНЯТО', glyph: '●', color: 'var(--bst-ok)' },
  review: { label: 'НА ПРОВЕРКЕ', glyph: '●', color: 'var(--bst-accent-ink)' },
  missing: { label: 'НЕ ЗАГРУЖЕНО', glyph: '▲', color: 'var(--bst-alarm)' },
  requested: { label: 'ЗАПРОШЕНО', glyph: '○', color: 'var(--bst-offline)' },
};

function SubmitNotice({ state }: { state: UploadState }) {
  const { pending } = useFormStatus();

  if (pending) {
    return (
      <p className="bst-mono" style={{ fontSize: 11, color: 'var(--bst-accent-ink)', margin: '10px 0 0' }}>
        ○ Загружаем файлы…
      </p>
    );
  }
  if (state.error) {
    return (
      <p role="alert" className="bst-mono" style={{ fontSize: 11, color: 'var(--bst-alarm)', margin: '10px 0 0' }}>
        ▲ {state.error}
      </p>
    );
  }
  if (state.uploaded?.length) {
    return (
      <p role="status" className="bst-mono" style={{ fontSize: 11, color: 'var(--bst-ok)', margin: '10px 0 0' }}>
        ● Принято на проверку: {state.uploaded.join(', ')}
      </p>
    );
  }
  return null;
}

function RequestButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="bst-btn bst-btn--primary bst-btn--block" disabled={disabled || pending} style={{ position: 'relative' }}>
      <i className="bst-corner bst-corner--tl" aria-hidden="true" />
      <i className="bst-corner bst-corner--tr" aria-hidden="true" />
      <i className="bst-corner bst-corner--bl" aria-hidden="true" />
      <i className="bst-corner bst-corner--br" aria-hidden="true" />
      {disabled ? 'Все документы запрошены' : pending ? 'Отправляем…' : 'Запросить недостающее у заказчика'}
    </button>
  );
}

/** B4. Загрузка задания, АПЗ и ТУ + проверка комплектности. */
export function InputsPanel({ assetCode, docs, completeness }: { assetCode: string; docs: InputDoc[]; completeness?: Completeness }) {
  const [state, action] = useFormState<UploadState, FormData>(uploadInputFiles, {});
  const [over, setOver] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Когда файлы пришли перетаскиванием, кладём их в тот же input и отправляем
  // форму: так загрузка идёт единственным путём — через server action.
  function submitFiles(files: File[]) {
    if (files.length === 0 || !inputRef.current) return;
    const transfer = new DataTransfer();
    for (const f of files) transfer.items.add(f);
    inputRef.current.files = transfer.files;
    formRef.current?.requestSubmit();
  }

  useEffect(() => {
    if (state.uploaded?.length && inputRef.current) inputRef.current.value = '';
  }, [state.uploaded]);

  const accepted = docs.filter((d) => d.state === 'accepted').length;
  const missing = docs.filter((d) => d.state === 'missing').length;

  return (
    <div className="split">
      <div>
        <SectionEyebrow aside={`${accepted} из ${docs.length} принято`}>ИСХОДНЫЕ ДАННЫЕ · ЗАГРУЗКА НА ЛИСТ</SectionEyebrow>

        <form ref={formRef} action={action} style={{ margin: '16px 0 22px' }}>
          <input type="hidden" name="assetCode" value={assetCode} />
          <input
            ref={inputRef}
            type="file"
            name="files"
            multiple
            style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
            onChange={() => formRef.current?.requestSubmit()}
          />

          <Dropzone
            title="Перетащите задание, АПЗ и ТУ на лист"
            hint="PDF · DWG · IFC · XLSX · DOCX — до 200 МБ на файл"
            over={over}
            onOverChange={setOver}
            onFiles={submitFiles}
            action={
              <button type="button" className="bst-btn bst-btn--subtle" onClick={() => inputRef.current?.click()}>
                <Upload size={14} strokeWidth={1.5} aria-hidden="true" />
                Выбрать файлы
              </button>
            }
          />
          <SubmitNotice state={state} />
        </form>

        <ScheduleTable
          rows={docs}
          rowKey={(r) => r.id}
          columns={[
            { id: 'code', header: 'Код', width: 78, cell: (r) => <span className="bst-badge">{r.code}</span> },
            { id: 'title', header: 'Документ', cell: (r) => r.title },
            {
              id: 'file',
              header: 'Файл',
              width: 190,
              cell: (r) =>
                r.fileId ? (
                  <a href={`/api/files/${r.fileId}`} className="bst-mono" style={{ fontSize: 11 }} download>
                    <Download size={12} strokeWidth={1.5} aria-hidden="true" style={{ verticalAlign: -2, marginRight: 4 }} />
                    {r.file}
                  </a>
                ) : (
                  <span className="bst-mono" style={{ fontSize: 11, color: 'var(--bst-text-mute)' }}>
                    {r.file ?? '—'}
                  </span>
                ),
            },
            {
              id: 'date',
              header: 'Загружен',
              width: 104,
              cell: (r) => (
                <span className="bst-mono" style={{ fontSize: 11 }}>
                  {r.date ?? '—'}
                </span>
              ),
            },
            {
              id: 'state',
              header: 'Статус',
              width: 148,
              cell: (r) => {
                const s = STATE_LABEL[r.state];
                return (
                  <span className="bst-stamp" style={{ color: s.color }}>
                    <span aria-hidden="true">{s.glyph}</span>
                    {s.label}
                  </span>
                );
              },
            },
            {
              id: 'upload',
              header: '',
              width: 118,
              cell: (r) => <RowUpload assetCode={assetCode} docId={r.id} replace={r.state !== 'missing' && r.state !== 'requested'} />,
            },
          ]}
        />
      </div>

      {completeness ? (
        <Frame padded>
          <AiNotice text="Проверка комплектности" />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '12px 0 10px' }}>
            <span className="bst-mono" style={{ fontSize: 30, lineHeight: 1 }}>
              {completeness.percent}
            </span>
            <span className="bst-mono" style={{ fontSize: 13, color: 'var(--bst-text-mute)' }}>
              % комплектности
            </span>
          </div>
          <DimensionLine value={completeness.percent / 100} arrow={false} />

          <div className="bst-kpi__label" style={{ margin: '18px 0 8px' }}>
            Чего не хватает
          </div>
          <div style={{ display: 'grid', borderTop: '1px solid var(--bst-line)' }}>
            {completeness.missing.map((m) => (
              <div key={m.id} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--bst-line)' }}>
                <span className="bst-mono" style={{ fontSize: 11, color: toleranceColor(m.severity) }} aria-hidden="true">
                  {m.severity === 'ok' ? '●' : '▲'}
                </span>
                <div>
                  <div style={{ fontSize: 13.5 }}>{m.title}</div>
                  <div className="bst-mono" style={{ fontSize: 10, color: 'var(--bst-text-mute)' }}>
                    {m.note}
                  </div>
                </div>
              </div>
            ))}
            {completeness.missing.length === 0 ? (
              <div style={{ padding: '12px 0', fontSize: 13.5, color: 'var(--bst-ok)' }}>● Комплект исходных данных полный</div>
            ) : null}
          </div>

          <form action={requestMissingDocs.bind(null, assetCode)} style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--bst-line)', display: 'grid', gap: 10 }}>
            <AiNotice />
            <RequestButton disabled={missing === 0} />
          </form>
        </Frame>
      ) : null}
    </div>
  );
}

/** Кнопка загрузки в конкретную строку ведомости. */
function RowUpload({ assetCode, docId, replace }: { assetCode: string; docId: string; replace: boolean }) {
  const [, action] = useFormState<UploadState, FormData>(uploadInputFiles, {});
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form ref={formRef} action={action}>
      <input type="hidden" name="assetCode" value={assetCode} />
      <input type="hidden" name="docId" value={docId} />
      <input
        ref={inputRef}
        type="file"
        name="files"
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        onChange={() => formRef.current?.requestSubmit()}
      />
      <button type="button" className="bst-btn bst-btn--sm" onClick={() => inputRef.current?.click()}>
        {replace ? 'Заменить' : 'Загрузить'}
      </button>
    </form>
  );
}
