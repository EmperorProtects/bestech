'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import type { Asset } from '@/api/types';

export interface AssetSwitcherProps {
  assets: Asset[];
  currentCode?: string;
  /** Куда вести ссылку выбранного объекта: кабинет или двойник. */
  section: 'cabinet' | 'twin';
  label: string;
}

/** Переключатель объекта в шапке сайдбара. */
export function AssetSwitcher({ assets, currentCode, section, label }: AssetSwitcherProps) {
  const [open, setOpen] = useState(false);
  const current = assets.find((a) => a.code === currentCode) ?? assets[0];
  const href = (code: string) => (section === 'twin' ? `/twin/${code}` : `/cabinet/assets/${code}`);

  return (
    <div style={{ padding: 12, borderBottom: '1px solid var(--bst-line)', position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: '100%',
          textAlign: 'left',
          border: '1px solid var(--bst-line)',
          borderRadius: 'var(--bst-radius-1)',
          background: 'transparent',
          color: 'inherit',
          padding: '8px 10px',
          cursor: 'pointer',
          font: 'inherit',
        }}
      >
        <span style={{ display: 'block', fontFamily: 'var(--bst-font-mono)', fontSize: 10, color: 'var(--bst-text-mute)' }}>
          {label}
          {current ? ` · ${current.code}` : ''}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--bst-font-heading)', fontSize: 15, textTransform: 'uppercase', lineHeight: 1.15 }}>
            {current ? current.shortName : 'Объект не выбран'}
          </span>
          <ChevronDown size={14} strokeWidth={1.5} style={{ marginLeft: 'auto', flex: 'none' }} aria-hidden="true" />
        </span>
      </button>

      {open ? (
        <ul
          style={{
            listStyle: 'none',
            margin: '6px 0 0',
            padding: 0,
            position: 'absolute',
            left: 12,
            right: 12,
            border: '1px solid var(--bst-line-strong)',
            background: 'var(--bst-bg)',
            zIndex: 5,
          }}
        >
          {assets.map((a) => (
            <li key={a.code} style={{ borderBottom: '1px solid var(--bst-line)' }}>
              <Link
                href={href(a.code)}
                onClick={() => setOpen(false)}
                style={{ display: 'block', padding: '8px 10px', color: 'var(--bst-text)' }}
              >
                <span style={{ display: 'block', fontFamily: 'var(--bst-font-mono)', fontSize: 10, color: 'var(--bst-text-mute)' }}>{a.code}</span>
                <span style={{ fontSize: 13.5 }}>{a.shortName}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
