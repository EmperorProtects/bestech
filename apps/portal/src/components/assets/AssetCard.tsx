import Link from 'next/link';
import { STAGE_LABELS } from '@bestech/tokens';
import { ButtonLink, DimensionLine, Frame } from '@bestech/ui-kit';
import type { Asset } from '@/api/types';
import { toleranceColor } from '@/lib/format';
import { IN_DEVELOPMENT_LABEL, isStageEnabled } from '@/lib/stages';
import { AssetFigure } from './AssetFigure';

const STAGE_COLOR: Record<Asset['stage'], string> = {
  design: 'var(--bst-accent-ink)',
  construction: 'var(--bst-warn)',
  operation: 'var(--bst-ok)',
};

const TOLERANCE_GLYPH = { ok: '●', warning: '▲', alarm: '▲', offline: '○' } as const;

/** Показатель, который считается по данным закрытой стадии. */
function LockedMetric({ label }: { label: string }) {
  return (
    <div style={{ opacity: 0.55 }}>
      <div className="bst-kpi__label">{label}</div>
      <div className="bst-mono" style={{ fontSize: 15, color: 'var(--bst-text-mute)' }}>
        —
      </div>
      <div style={{ fontSize: 12, color: 'var(--bst-text-soft)', marginTop: 2 }}>{IN_DEVELOPMENT_LABEL}</div>
    </div>
  );
}

/** Карточка объекта: стадия, документация, срок, замечания. */
export function AssetCard({ asset }: { asset: Asset }) {
  const constructionOpen = isStageEnabled('construction');
  const stageOpen = isStageEnabled(asset.stage);

  return (
    <Frame as="article" padded style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 28, alignItems: 'start' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--bst-font-mono)', fontSize: 11, color: 'var(--bst-text-mute)', flexWrap: 'wrap' }}>
          <span>{asset.code}</span>
          <span style={{ width: 1, height: 11, background: 'var(--bst-line)' }} />
          <span>{asset.region}</span>
          <span className="bst-stamp" style={{ color: STAGE_COLOR[asset.stage], marginLeft: 4 }}>
            {STAGE_LABELS[asset.stage]}
          </span>
          {stageOpen ? null : (
            <span className="bst-stamp" style={{ color: 'var(--bst-text-mute)' }} title={`Функции стадии «${STAGE_LABELS[asset.stage]}» ещё не подключены`}>
              стадия {IN_DEVELOPMENT_LABEL}
            </span>
          )}
        </div>

        <h2 className="bst-h" style={{ fontSize: 25, margin: '8px 0 4px', lineHeight: 1.08 }}>
          <Link href={`/cabinet/assets/${asset.code}`} style={{ color: 'var(--bst-text)' }}>
            {asset.name}
          </Link>
        </h2>
        <div style={{ fontFamily: 'var(--bst-font-mono)', fontSize: 11, color: 'var(--bst-text-mute)', marginBottom: 14 }}>
          ГИП {asset.chief} · {asset.area} · {asset.capacity}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 18, borderTop: '1px solid var(--bst-line)', paddingTop: 12 }}>
          <div>
            <div className="bst-kpi__label">Разделов ПД</div>
            <div className="bst-mono" style={{ fontSize: 15 }}>
              {asset.sectionsLabel}
            </div>
            <div style={{ fontSize: 12, color: 'var(--bst-text-soft)', marginTop: 2 }}>стадия «{STAGE_LABELS.design}»</div>
          </div>
          <div>
            <div className="bst-kpi__label">Следующий срок</div>
            <div className="bst-mono" style={{ fontSize: 15 }}>
              {asset.deadline.date}
            </div>
            <div style={{ fontSize: 12, color: 'var(--bst-text-soft)', marginTop: 2 }}>{asset.deadline.note}</div>
          </div>
          <div>
            <div className="bst-kpi__label">Замечания</div>
            <div className="bst-mono" style={{ fontSize: 15, color: toleranceColor(asset.remarks.state), display: 'flex', gap: 6 }}>
              <span aria-hidden="true">{TOLERANCE_GLYPH[asset.remarks.state]}</span>
              {asset.remarks.label}
            </div>
            <div style={{ fontSize: 12, color: 'var(--bst-text-soft)', marginTop: 2 }}>{asset.remarks.note}</div>
          </div>
          {constructionOpen ? (
            <div>
              <div className="bst-kpi__label">Готовность СМР</div>
              <div className="bst-mono" style={{ fontSize: 20 }}>
                {asset.progress} %
              </div>
              <DimensionLine value={asset.progress / 100} plan={asset.plannedProgress / 100} height={8} arrow={false} />
            </div>
          ) : (
            <LockedMetric label="Готовность СМР" />
          )}
        </div>
      </div>

      <div style={{ borderLeft: '1px solid var(--bst-line)', paddingLeft: 22 }}>
        <div className="bst-kpi__label" style={{ marginBottom: 8 }}>
          Схема объекта
        </div>
        <div className="bst-axisgrid" style={{ border: '1px solid var(--bst-line)' }}>
          <AssetFigure kind={asset.figure} />
        </div>
        <div style={{ display: 'grid', marginTop: 12, borderTop: '1px solid var(--bst-line)', fontFamily: 'var(--bst-font-mono)', fontSize: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--bst-line)' }}>
            <span style={{ color: 'var(--bst-text-mute)' }}>ДОГОВОР</span>
            <span>{asset.contract}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
            <span style={{ color: 'var(--bst-text-mute)' }}>ОБНОВЛЕНО</span>
            <span>{asset.updated}</span>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          <ButtonLink href={`/cabinet/assets/${asset.code}`} block>
            Открыть лист объекта
          </ButtonLink>
          <ButtonLink href={`/cabinet/assets/${asset.code}/documents`} variant="subtle" block>
            Чертежи и документация
          </ButtonLink>
        </div>
      </div>
    </Frame>
  );
}
