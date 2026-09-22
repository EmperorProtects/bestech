'use client';

import { create } from 'zustand';

interface TwinState {
  /** Выбранный датчик на обзоре двойника (C1). */
  selectedSensorId: string | null;
  /** Выбранная строка отклонений (C2) — подсвечивает элемент в модели. */
  selectedDeviationId: string | null;
  /** Фильтры таблицы отклонений. */
  discipline: string;
  level: string;
  onlyDeviations: boolean;
  /** Телеметрия: период и линии. */
  period: '24h' | '7d' | '30d' | 'all';
  showThresholds: boolean;
  showForecast: boolean;
  selectSensor: (id: string | null) => void;
  selectDeviation: (id: string | null) => void;
  setDiscipline: (value: string) => void;
  setLevel: (value: string) => void;
  setOnlyDeviations: (value: boolean) => void;
  setPeriod: (value: TwinState['period']) => void;
  setShowThresholds: (value: boolean) => void;
  setShowForecast: (value: boolean) => void;
}

export const useTwinStore = create<TwinState>((set) => ({
  selectedSensorId: null,
  selectedDeviationId: null,
  discipline: 'ВСЕ',
  level: 'ВСЕ',
  onlyDeviations: true,
  period: '30d',
  showThresholds: true,
  showForecast: true,
  selectSensor: (selectedSensorId) => set({ selectedSensorId }),
  selectDeviation: (selectedDeviationId) => set({ selectedDeviationId }),
  setDiscipline: (discipline) => set({ discipline }),
  setLevel: (level) => set({ level }),
  setOnlyDeviations: (onlyDeviations) => set({ onlyDeviations }),
  setPeriod: (period) => set({ period }),
  setShowThresholds: (showThresholds) => set({ showThresholds }),
  setShowForecast: (showForecast) => set({ showForecast }),
}));
