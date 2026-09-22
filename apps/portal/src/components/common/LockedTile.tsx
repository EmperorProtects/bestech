import { Lock } from 'lucide-react';
import { STAGE_LABELS } from '@bestech/tokens';
import { Frame } from '@bestech/ui-kit';
import { IN_DEVELOPMENT_LABEL, getFeature, type FeatureId } from '@/lib/stages';

/**
 * Плитка показателя, который считается по данным закрытой стадии. Место в сетке
 * сохраняется — заказчик видит полный состав листа и то, чего пока нет.
 */
export function LockedTile({ feature, label }: { feature: FeatureId; label?: string }) {
  const f = getFeature(feature);

  return (
    <div title={f.note}>
      <Frame padded fill="surface" style={{ opacity: 0.62 }}>
        <div className="bst-kpi__label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Lock size={12} strokeWidth={1.5} aria-hidden="true" />
          {label ?? f.label}
        </div>
        <div className="bst-mono" style={{ fontSize: 22, lineHeight: 1.1, margin: '10px 0 4px', color: 'var(--bst-text-mute)' }}>
          —
        </div>
        <div className="bst-mono" style={{ fontSize: 10, color: 'var(--bst-text-mute)' }}>
          {IN_DEVELOPMENT_LABEL}
          {f.stage ? ` · стадия «${STAGE_LABELS[f.stage]}»` : ''}
        </div>
      </Frame>
    </div>
  );
}
