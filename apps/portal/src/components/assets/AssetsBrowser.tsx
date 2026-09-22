'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Filter } from 'lucide-react';
import { STAGE_LABELS } from '@bestech/tokens';
import { Input, Segmented, Select } from '@bestech/ui-kit';
import type { Asset, Stage } from '@/api/types';
import { IN_DEVELOPMENT_LABEL } from '@/lib/stages';
import { AssetCard } from './AssetCard';
import { AssetMap } from './AssetMap';

type View = 'list' | 'map';

/** B2 «Мои объекты»: список или схема, поиск и фильтры по стадии и региону. */
export function AssetsBrowser({ assets, canCreate = false }: { assets: Asset[]; canCreate?: boolean }) {
  const [view, setView] = useState<View>('list');
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState<Stage | 'all'>('all');
  const [region, setRegion] = useState('all');

  const regions = useMemo(() => Array.from(new Set(assets.map((a) => a.region))), [assets]);

  const visible = useMemo(
    () =>
      assets.filter((a) => {
        const q = query.trim().toLowerCase();
        const matchQuery = !q || a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q);
        return matchQuery && (stage === 'all' || a.stage === stage) && (region === 'all' || a.region === region);
      }),
    [assets, query, stage, region],
  );

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 24px', borderBottom: '1px solid var(--bst-line)', flexWrap: 'wrap' }}>
        <Input
          type="search"
          placeholder="Поиск по шифру или наименованию"
          aria-label="Поиск объектов"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ maxWidth: 300 }}
        />
        <Select aria-label="Стадия" value={stage} onChange={(e) => setStage(e.target.value as Stage | 'all')} style={{ maxWidth: 190 }}>
          <option value="all">Все стадии</option>
          <option value="design">{STAGE_LABELS.design}</option>
          <option value="construction">{STAGE_LABELS.construction}</option>
          <option value="operation">{STAGE_LABELS.operation}</option>
        </Select>
        <Select aria-label="Регион" value={region} onChange={(e) => setRegion(e.target.value)} style={{ maxWidth: 210 }}>
          <option value="all">Все регионы</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
        <span style={{ fontFamily: 'var(--bst-font-mono)', fontSize: 11, color: 'var(--bst-text-mute)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={14} strokeWidth={1.5} aria-hidden="true" />
          {visible.length} из {assets.length}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Segmented
            ariaLabel="Вид"
            value={view}
            onChange={setView}
            options={[
              { value: 'list', label: 'СПИСОК' },
              { value: 'map', label: 'СХЕМА' },
            ]}
          />
          {canCreate ? (
            <Link href="/cabinet/assets/new" className="bst-btn bst-btn--primary" style={{ position: 'relative' }}>
              <i className="bst-corner bst-corner--tl" aria-hidden="true" />
              <i className="bst-corner bst-corner--tr" aria-hidden="true" />
              <i className="bst-corner bst-corner--bl" aria-hidden="true" />
              <i className="bst-corner bst-corner--br" aria-hidden="true" />
              Новый проект по ТЗ
            </Link>
          ) : (
            <span className="bst-btn" aria-disabled="true" title="Новый проект по ТЗ заводит проектировщик" style={{ opacity: 0.45, cursor: 'not-allowed' }}>
              Добавить объект · {IN_DEVELOPMENT_LABEL}
            </span>
          )}
        </div>
      </div>

      <div className="page">
        {view === 'list' ? (
          <div style={{ display: 'grid', gap: 20 }}>
            {visible.map((a) => (
              <AssetCard key={a.code} asset={a} />
            ))}
          </div>
        ) : (
          <AssetMap assets={visible} />
        )}
      </div>
    </>
  );
}
