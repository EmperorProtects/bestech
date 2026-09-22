import Link from 'next/link';
import { STAGE_LABELS, type Stage } from '@bestech/tokens';
import { Frame, SectionEyebrow, TitleBlock } from '@bestech/ui-kit';
import { IN_DEVELOPMENT_LABEL, getFeature, isStageEnabled, type FeatureId } from '@/lib/stages';

export interface UnderDevelopmentProps {
  feature: FeatureId;
  /** Куда вернуться к работающим разделам объекта. */
  assetCode?: string;
}

const STAGE_NOTE: Record<Stage, string> = {
  design: 'Стадия в работе.',
  construction: 'Стадия ещё не подключена: нет приёма данных со стройплощадки.',
  operation: 'Стадия ещё не подключена: объект не введён в эксплуатацию в системе.',
};

/**
 * Экран-заглушка для разделов, закрытых флагом стадии. Показывает, к какой
 * стадии относится функция, почему она недоступна и куда идти сейчас.
 */
export function UnderDevelopment({ feature, assetCode }: UnderDevelopmentProps) {
  const f = getFeature(feature);
  const stage: Stage | null = f.stage;

  return (
    <div className="page">
      <Frame padded>
        <SectionEyebrow rule={false}>РАЗДЕЛ {IN_DEVELOPMENT_LABEL.toUpperCase()}</SectionEyebrow>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 28, alignItems: 'start', marginTop: 12 }}>
          <div style={{ maxWidth: 620 }}>
            <h1 className="bst-h" style={{ fontSize: 32, lineHeight: 1.05, margin: '0 0 10px' }}>
              {f.label}
            </h1>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--bst-text-soft)', margin: '0 0 8px' }}>{f.note}</p>
            {stage ? (
              <p className="bst-mono" style={{ fontSize: 11, color: 'var(--bst-text-mute)', margin: 0 }}>
                {isStageEnabled(stage) ? 'Стадия в работе — этот раздел выйдет в следующем релизе.' : STAGE_NOTE[stage]}
              </p>
            ) : null}

            <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid var(--bst-line)' }}>
              <div className="bst-kpi__label" style={{ marginBottom: 10 }}>
                Что доступно сейчас
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {assetCode ? (
                  <>
                    <Link href={`/cabinet/assets/${assetCode}`} className="bst-btn">
                      Лист объекта
                    </Link>
                    <Link href={`/cabinet/assets/${assetCode}/inputs`} className="bst-btn">
                      Исходные данные — загрузка файлов
                    </Link>
                    <Link href={`/cabinet/assets/${assetCode}/documents`} className="bst-btn bst-btn--primary">
                      Документация — чертежи
                    </Link>
                  </>
                ) : (
                  <Link href="/cabinet/assets" className="bst-btn bst-btn--primary">
                    К списку объектов
                  </Link>
                )}
              </div>
            </div>
          </div>

          <TitleBlock
            minWidth={320}
            rows={[
              { k: 'СТАТУС', v: IN_DEVELOPMENT_LABEL.toUpperCase() },
              { k: 'СТАДИЯ', v: stage ? STAGE_LABELS[stage] : 'сквозная функция' },
              { k: 'ЗАВИСИТ ОТ', v: stage === 'construction' ? 'данных стройплощадки' : stage === 'operation' ? 'ввода в эксплуатацию' : 'следующего релиза' },
              { k: 'ВКЛЮЧЕНИЕ', v: 'флаг lib/stages.ts' },
            ]}
          />
        </div>
      </Frame>
    </div>
  );
}
