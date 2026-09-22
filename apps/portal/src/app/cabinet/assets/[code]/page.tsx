import { notFound } from 'next/navigation';
import Link from 'next/link';
import { STAGE_LABELS } from '@bestech/tokens';
import { ButtonLink, Frame, KpiTile, SectionEyebrow, StageStepper, TitleBlock, type StepState } from '@bestech/ui-kit';
import { getAsset, getAssetEvents, getCompleteness, getDocSections, getInputDocs, getOpenRemarks, normalizeCode } from '@/api';
import { CabinetShell } from '@/components/shell/CabinetShell';
import { AssetTabs } from '@/components/asset/AssetTabs';
import { EventFeed } from '@/components/asset/EventFeed';
import { LockedTile } from '@/components/common/LockedTile';
import { requireUser } from '@/lib/session';
import { IN_DEVELOPMENT_LABEL, isFeatureEnabled, isStageEnabled } from '@/lib/stages';
import { assetTabs } from './tabs';

export async function generateMetadata({ params }: { params: { code: string } }) {
  return { title: `Объект ${normalizeCode(params.code)} — BESTECH` };
}

const STEP_STATE: Record<string, [StepState, StepState, StepState]> = {
  design: ['current', 'todo', 'todo'],
  construction: ['done', 'current', 'todo'],
  operation: ['done', 'done', 'current'],
};

/** B3. Лист объекта: штамп, три стадии, ключевые метрики, лента событий. */
export default async function AssetOverviewPage({ params }: { params: { code: string } }) {
  const user = requireUser();
  const asset = await getAsset(params.code, user.orgId);
  if (!asset) notFound();

  const [events, docs, completeness, sections, openRemarks] = await Promise.all([
    getAssetEvents(asset.code),
    getInputDocs(asset.code),
    getCompleteness(asset.code),
    getDocSections(asset.code),
    getOpenRemarks(asset.code),
  ]);

  const states = STEP_STATE[asset.stage] ?? STEP_STATE.construction!;
  const acceptedDocs = docs.filter((d) => d.state === 'accepted').length;
  const issuedSections = sections.filter((s) => s.status === 'issued').length;
  const totalSheets = sections.reduce((n, s) => n + s.sheetsCount, 0);
  const availableSheets = sections.reduce((n, s) => n + s.availableSheets, 0);

  /** Примечание к стадии в степпере: закрытые стадии подписаны честно. */
  const stageNote = (stage: 'design' | 'construction' | 'operation', note: string) =>
    isStageEnabled(stage) ? note : `${note} · ${IN_DEVELOPMENT_LABEL}`;

  return (
    <CabinetShell
      currentCode={asset.code}
      headerCells={[
        { k: 'ШИФР', v: asset.code },
        { k: 'СТАДИЯ', v: STAGE_LABELS[asset.stage].toUpperCase() },
        { k: 'ГИП', v: asset.chief },
        { k: 'ОБНОВЛЕНО', v: asset.updated },
        { k: 'ЛИСТ', v: 'B3 / 17' },
      ]}
      headerAside={
        <ButtonLink href={`/cabinet/assets/${asset.code}/documents`} variant="primary" ticks>
          Открыть документацию
        </ButtonLink>
      }
      footerCells={[
        { k: 'ОБЪЕКТ', v: `${asset.code} · ${asset.name}` },
        { k: 'РАЗДЕЛ', v: 'Кабинет · B3' },
        { k: 'СТАДИЯ', v: STAGE_LABELS[asset.stage] },
        { k: 'ПОЛЬЗОВАТЕЛЬ', v: user.name },
        { k: 'ЛИСТ', v: 'B3 / 17' },
      ]}
      tabs={<AssetTabs tabs={assetTabs(asset, openRemarks.length)} />}
    >
      <div className="page">
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 24, alignItems: 'start' }}>
          <div>
            <SectionEyebrow rule={false}>ЛИСТ ОБЪЕКТА · {asset.code}</SectionEyebrow>
            <h1 className="bst-h" style={{ fontSize: 34, margin: '8px 0 6px', lineHeight: 1.04 }}>
              {asset.name}
            </h1>
            <div className="bst-mono" style={{ fontSize: 12, color: 'var(--bst-text-mute)' }}>
              {asset.address} · {asset.area} · {asset.capacity}
            </div>
          </div>
          <TitleBlock
            minWidth={360}
            rows={[
              { k: 'СТАДИЯ', v: STAGE_LABELS[asset.stage].toUpperCase() },
              { k: 'ГИП', v: `${asset.chief} · лиц. ГСЛ №0788280` },
              { k: 'ДОГОВОР', v: asset.contract },
              { k: 'ОБНОВЛЕНО', v: asset.updated },
            ]}
          />
        </div>

        <StageStepper
          steps={[
            { key: 'design', label: STAGE_LABELS.design, note: stageNote('design', asset.sectionsLabel), state: states[0] },
            {
              key: 'construction',
              label: STAGE_LABELS.construction,
              note: stageNote('construction', 'двойник, телеметрия, ход СМР'),
              state: states[1],
            },
            { key: 'operation', label: STAGE_LABELS.operation, note: stageNote('operation', 'паспорт, приборы учёта, ППР'), state: states[2] },
          ]}
        />

        <div className="grid-4">
          <KpiTile
            label="Комплектность исходных данных"
            value={completeness?.percent ?? 0}
            unit="%"
            progress={(completeness?.percent ?? 0) / 100}
            color={(completeness?.percent ?? 0) >= 90 ? 'var(--bst-ok)' : 'var(--bst-warn)'}
            footLeft={`${acceptedDocs} из ${docs.length} принято`}
            footRight={completeness?.missing.length ? `▲ ${completeness.missing.length}` : '●'}
          />
          <KpiTile
            label="Разделы ПД выданы"
            value={issuedSections}
            unit={`/${sections.length}`}
            progress={sections.length ? issuedSections / sections.length : 0}
            footLeft={`${availableSheets} из ${totalSheets} листов доступно`}
            footRight="B5"
          />
          <KpiTile
            label="Замечания нормоконтроля"
            value={openRemarks.length}
            color={openRemarks.length ? 'var(--bst-warn)' : 'var(--bst-ok)'}
            footLeft="открыто"
          >
            <div className="bst-mono" style={{ fontSize: 11, color: 'var(--bst-text-mute)', marginTop: 6 }}>
              {openRemarks.length > 0 ? (
                <>
                  листы {Array.from(new Set(openRemarks.map((r) => r.sheetCode))).join(', ')}
                  <br />
                  ближайший срок ответа 15.09.2026
                </>
              ) : (
                'все замечания закрыты'
              )}
            </div>
          </KpiTile>
          <LockedTile feature="progress" label="Готовность СМР" />
        </div>

        <div className="split">
          <div>
            <SectionEyebrow aside={<Link href={`/cabinet/assets/${asset.code}/documents`}>ВСЯ ДОКУМЕНТАЦИЯ →</Link>}>ЛЕНТА СОБЫТИЙ ОБЪЕКТА</SectionEyebrow>
            <div style={{ marginTop: 14 }}>
              <EventFeed events={events} />
            </div>
          </div>

          <div style={{ display: 'grid', gap: 22 }}>
            <div>
              <SectionEyebrow rule={false}>БЛИЖАЙШИЕ СРОКИ</SectionEyebrow>
              <div style={{ display: 'grid', borderTop: '1px solid var(--bst-line)', marginTop: 12 }}>
                {[
                  { t: asset.deadline.note, d: asset.deadline.date, warn: true },
                  { t: 'Ответ на замечания нормоконтроля', d: '15.09.2026', warn: openRemarks.length > 0 },
                  { t: 'Выпуск разделов ОВ и ВК', d: '30.09.2026', warn: false },
                ].map((r) => (
                  <div key={r.t} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--bst-line)' }}>
                    <span style={{ fontSize: 13.5 }}>{r.t}</span>
                    <span className="bst-mono" style={{ fontSize: 11, color: r.warn ? 'var(--bst-warn)' : undefined }}>
                      {r.d}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionEyebrow rule={false}>КОМАНДА ОБЪЕКТА</SectionEyebrow>
              <div style={{ display: 'grid', borderTop: '1px solid var(--bst-line)', marginTop: 12 }}>
                {[
                  ['ГИП', asset.chief],
                  ...sections.slice(0, 4).map((s) => [s.code, s.author] as [string, string]),
                ].map(([role, person]) => (
                  <div key={role} style={{ display: 'grid', gridTemplateColumns: '84px minmax(0, 1fr)', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--bst-line)' }}>
                    <span className="bst-mono" style={{ fontSize: 10, color: 'var(--bst-text-mute)' }}>
                      {role}
                    </span>
                    <span style={{ fontSize: 13.5 }}>{person}</span>
                  </div>
                ))}
              </div>
            </div>

            {isFeatureEnabled('twin') && asset.hasTwin ? (
              <Frame padded>
                <div className="bst-kpi__label">Цифровой двойник</div>
                <p style={{ fontSize: 13.5, color: 'var(--bst-text-soft)', margin: '8px 0 12px' }}>
                  Модель объекта с датчиками стройплощадки: телеметрия, аварии и приём данных в реальном времени.
                </p>
                <ButtonLink href={`/twin/${asset.code}`} variant="primary" ticks block>
                  Открыть цифровой двойник
                </ButtonLink>
              </Frame>
            ) : (
              <LockedTile feature="twin" />
            )}
          </div>
        </div>
      </div>
    </CabinetShell>
  );
}
