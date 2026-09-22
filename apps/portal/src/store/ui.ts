'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Density, ThemeName } from '@bestech/tokens';

interface UiState {
  theme: ThemeName;
  density: Density;
  /** Тема двойника по умолчанию тёмная; пользователь может переопределить. */
  followSectionTheme: boolean;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
  setDensity: (density: Density) => void;
  toggleDensity: () => void;
  setFollowSectionTheme: (follow: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'paper',
      density: 'comfortable',
      followSectionTheme: true,
      setTheme: (theme) => set({ theme, followSectionTheme: false }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'paper' ? 'cyanotype' : 'paper', followSectionTheme: false })),
      setDensity: (density) => set({ density }),
      toggleDensity: () => set((s) => ({ density: s.density === 'comfortable' ? 'compact' : 'comfortable' })),
      setFollowSectionTheme: (followSectionTheme) => set({ followSectionTheme }),
    }),
    { name: 'bestech.ui' },
  ),
);
