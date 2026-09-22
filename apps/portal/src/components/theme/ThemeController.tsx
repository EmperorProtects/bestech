'use client';

import { useEffect } from 'react';
import type { ThemeName } from '@bestech/tokens';
import { useUiStore } from '@/store/ui';

/**
 * Вешает data-theme и data-density на <html>. Раздел задаёт тему по умолчанию
 * (двойник — «Цианотипия»), пользовательский выбор её перебивает.
 */
export function ThemeController({ sectionTheme }: { sectionTheme: ThemeName }) {
  const theme = useUiStore((s) => s.theme);
  const density = useUiStore((s) => s.density);
  const follow = useUiStore((s) => s.followSectionTheme);
  const effective = follow ? sectionTheme : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = effective;
    root.dataset.density = density;
  }, [effective, density]);

  return null;
}
