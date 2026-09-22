'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Field, Frame, Input, SectionEyebrow, Select } from '@bestech/ui-kit';
import { createProject, type NewProjectState } from '@/app/cabinet/assets/new/actions';

const MARKS = ['АР', 'ЭП', 'АС', 'КЖ', 'КМ', 'ОВ', 'ВК', 'ЭОМ', 'ТХ', 'ГП'];
const STAGES = ['ЭП (эскизный проект)', 'П (проект)', 'Р (рабочая документация)'];

function Submit({ startNow }: { startNow: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="bst-btn bst-btn--primary" disabled={pending} style={{ position: 'relative' }}>
      <i className="bst-corner bst-corner--tl" aria-hidden="true" />
      <i className="bst-corner bst-corner--tr" aria-hidden="true" />
      <i className="bst-corner bst-corner--bl" aria-hidden="true" />
      <i className="bst-corner bst-corner--br" aria-hidden="true" />
      {pending ? 'Создаём…' : startNow ? 'Создать и запустить проектирование' : 'Создать проект'}
    </button>
  );
}

export interface NewProjectFormProps {
  nextNumber: string;
  year: number;
  claudeOnline: boolean;
  revitAlive: boolean;
  workspaceDir: string;
  template: string;
  templateFound: boolean;
}

/** Форма нового проекта: ТЗ уходит в мастерскую, проектирование ведёт Claude. */
export function NewProjectForm({ nextNumber, year, claudeOnline, revitAlive, workspaceDir, template, templateFound }: NewProjectFormProps) {
  const [state, action] = useFormState<NewProjectState, FormData>(createProject, {});
  const [mark, setMark] = useState('АР');
  const [shifr, setShifr] = useState(`${nextNumber}-${year}-АР`);
  const [startNow, setStartNow] = useState(claudeOnline);

  function changeMark(next: string) {
    setMark(next);
    setShifr((s) => s.replace(/-[А-ЯЁA-Z]{1,4}$/, `-${next}`));
  }

  return (
    <form action={action} className="split">
      <div style={{ display: 'grid', gap: 16 }}>
        <SectionEyebrow aside={workspaceDir}>НОВЫЙ ПРОЕКТ ПО ТЗ</SectionEyebrow>

        <div style={{ display: 'grid', gridTemplateColumns: '180px 120px minmax(0, 1fr)', gap: 12 }}>
          <Field label="Шифр" htmlFor="shifr" hint="номер-год-марка">
            <Input id="shifr" name="shifr" mono required value={shifr} onChange={(e) => setShifr(e.target.value)} pattern="\d{3}-\d{4}-[А-ЯЁA-Za-z]{1,4}" />
          </Field>
          <Field label="Марка" htmlFor="mark">
            <Select id="mark" value={mark} onChange={(e) => changeMark(e.target.value)}>
              {MARKS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </Field>
          <Field label="Стадия" htmlFor="stage">
            <Select id="stage" name="stage" defaultValue={STAGES[0]}>
              {STAGES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Объект" htmlFor="object" hint="как в штампе: Индивидуальный жилой дом, одноэтажный">
          <Input id="object" name="object" maxLength={200} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
          <Field label="Место строительства" htmlFor="place">
            <Input id="place" name="place" defaultValue="г. Астана, Республика Казахстан" maxLength={200} />
          </Field>
          <Field label="Заказчик" htmlFor="customer">
            <Input id="customer" name="customer" maxLength={200} />
          </Field>
        </div>

        <Field label="Задание" htmlFor="brief" hint="этажность, габариты, состав помещений с площадями, конструкции, кровля, состав выпуска">
          <textarea
            id="brief"
            name="brief"
            className="bst-input"
            rows={12}
            style={{ resize: 'vertical', fontFamily: 'var(--bst-font-body)' }}
            placeholder={'1 этаж, без подвала, габарит в осях не более 12×10 м.\nПомещения: тамбур 3–4 м², холл 10 м², гостиная 25 м², кухня 12 м², 2 спальни по 14 м², санузел 5 м².\nСтены — газобетон 400 мм, кровля двускатная 30°, металлочерепица.\nВыпуск: общие данные, план, разрезы, фасады, спецификация проёмов.'}
          />
        </Field>

        <Field label="Файл ТЗ заказчика" htmlFor="tz" hint="необязательно · MD, TXT встраиваются в ТЗ; PDF, DOCX кладутся рядом">
          <input id="tz" name="tz" type="file" accept=".md,.txt,.pdf,.docx,.doc" className="bst-input" />
        </Field>

        {state.error ? (
          <p role="alert" className="bst-mono" style={{ margin: 0, fontSize: 12, color: 'var(--bst-alarm)' }}>
            ▲ {state.error}
          </p>
        ) : null}

        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <Submit startNow={startNow} />
          <label className="bst-mono" style={{ fontSize: 11, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" name="startNow" checked={startNow} disabled={!claudeOnline} onChange={(e) => setStartNow(e.target.checked)} />
            сразу запустить «Проект по ТЗ» в мастерской
          </label>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
        <Frame padded>
          <div className="bst-kpi__label">Что произойдёт</div>
          <ol style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 13.5, lineHeight: 1.55, display: 'grid', gap: 6 }}>
            <li>ТЗ запишется в «01_Исходные данные\ТЗ_{shifr}.md», файл заказчика — рядом.</li>
            <li>Объект появится в «Моих объектах» со стадией «Проектирование».</li>
            <li>Claude создаст модель из шаблона АР и поведёт её по этапам: геометрия → помещения → нормоконтроль → оформление → листы → альбом.</li>
            <li>После каждого этапа модель сохраняется, ход виден на вкладке «Мастерская». Следующее задание продолжает с первого незакрытого этапа.</li>
          </ol>
        </Frame>

        <Frame padded>
          <div className="bst-kpi__label">Готовность мастерской</div>
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            {[
              { ok: claudeOnline, label: claudeOnline ? 'Claude Code на связи' : 'Сервер Claude не запущен — _web\\start.bat' },
              { ok: revitAlive, label: revitAlive ? 'Revit запущен' : 'Revit не запущен — задание упадёт на создании модели' },
              { ok: templateFound, label: templateFound ? 'Шаблон АР найден' : 'Шаблон АР не найден по пути ниже' },
            ].map((r) => (
              <span key={r.label} className="bst-stamp" style={{ color: r.ok ? 'var(--bst-ok)' : 'var(--bst-warn)', justifySelf: 'start' }}>
                <span aria-hidden="true">{r.ok ? '●' : '▲'}</span>
                {r.label}
              </span>
            ))}
          </div>
          <p className="bst-mono" style={{ fontSize: 10, color: 'var(--bst-text-mute)', margin: '10px 0 0', overflowWrap: 'anywhere' }}>
            {template}
          </p>
          <p style={{ fontSize: 12, color: 'var(--bst-text-soft)', margin: '8px 0 0' }}>
            Проект создаётся и без запущенных инструментов — проектирование можно начать позже с вкладки «Мастерская».
          </p>
        </Frame>
      </div>
    </form>
  );
}
