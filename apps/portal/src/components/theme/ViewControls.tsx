'use client';

import { Moon, Sun } from 'lucide-react';
import { Segmented } from '@bestech/ui-kit';
import { DENSITY_LABELS, THEME_LABELS } from '@bestech/tokens';
import { useUiStore } from '@/store/ui';

/** Переключатели темы и плотности — живут в подвале сайдбара. */
export function ViewControls() {
  const theme = useUiStore((s) => s.theme);
  const density = useUiStore((s) => s.density);
  const follow = useUiStore((s) => s.followSectionTheme);
  const setTheme = useUiStore((s) => s.setTheme);
  const setDensity = useUiStore((s) => s.setDensity);
  const setFollow = useUiStore((s) => s.setFollowSectionTheme);

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontFamily: 'var(--bst-font-mono)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--bst-text-mute)' }}>ТЕМА</span>
        <Segmented
          ariaLabel="Тема интерфейса"
          value={follow ? 'auto' : theme}
          onChange={(v) => (v === 'auto' ? setFollow(true) : setTheme(v as 'paper' | 'cyanotype'))}
          options={[
            { value: 'auto', label: 'ПО РАЗДЕЛУ' },
            { value: 'paper', label: THEME_LABELS.paper.toUpperCase() },
            { value: 'cyanotype', label: THEME_LABELS.cyanotype.toUpperCase() },
          ]}
        />
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontFamily: 'var(--bst-font-mono)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--bst-text-mute)' }}>ПЛОТНОСТЬ</span>
        <Segmented
          ariaLabel="Плотность интерфейса"
          value={density}
          onChange={setDensity}
          options={[
            { value: 'comfortable', label: DENSITY_LABELS.comfortable.toUpperCase() },
            { value: 'compact', label: DENSITY_LABELS.compact.toUpperCase() },
          ]}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--bst-font-mono)', fontSize: 10, color: 'var(--bst-text-mute)' }}>
        {theme === 'paper' ? <Sun size={13} strokeWidth={1.5} aria-hidden="true" /> : <Moon size={13} strokeWidth={1.5} aria-hidden="true" />}
        {follow ? 'тема следует разделу' : `выбрана вручную: ${THEME_LABELS[theme].toLowerCase()}`}
      </div>
    </div>
  );
}
