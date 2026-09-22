/**
 * Источник истины для тем и семантики. CSS-переменные живут в tokens.css,
 * здесь — только то, что нужно в рантайме (переключение темы, подписи статусов).
 */

export type ThemeName = 'paper' | 'cyanotype';
export type Density = 'comfortable' | 'compact';

export const THEMES: ThemeName[] = ['paper', 'cyanotype'];

export const THEME_LABELS: Record<ThemeName, string> = {
  paper: 'Бумага',
  cyanotype: 'Цианотипия',
};

export const DENSITY_LABELS: Record<Density, string> = {
  comfortable: 'Обычная',
  compact: 'Компактная',
};

/** Состояние параметра относительно проектного допуска. Цвет всегда идёт в паре с глифом и подписью. */
export type ToleranceState = 'ok' | 'warning' | 'alarm' | 'offline';

export const TOLERANCE: Record<ToleranceState, { label: string; glyph: string; cssVar: string }> = {
  ok: { label: 'В допуске', glyph: '●', cssVar: 'var(--bst-ok)' },
  warning: { label: 'У границы допуска', glyph: '▲', cssVar: 'var(--bst-warn)' },
  alarm: { label: 'Вне допуска', glyph: '▲', cssVar: 'var(--bst-alarm)' },
  offline: { label: 'Нет связи', glyph: '✕', cssVar: 'var(--bst-offline)' },
};

/** Штампы статусов документации. */
export type DocStatus = 'issued' | 'review' | 'remarks' | 'progress' | 'void';

export const DOC_STATUS: Record<DocStatus, { label: string; glyph: string; cssVar: string }> = {
  issued: { label: 'Выдано', glyph: '●', cssVar: 'var(--bst-ok)' },
  review: { label: 'На проверке', glyph: '●', cssVar: 'var(--bst-accent-ink)' },
  remarks: { label: 'Замечания', glyph: '▲', cssVar: 'var(--bst-warn)' },
  progress: { label: 'В работе', glyph: '○', cssVar: 'var(--bst-text-mute)' },
  void: { label: 'Аннулировано', glyph: '✕', cssVar: 'var(--bst-offline)' },
};

export type Stage = 'design' | 'construction' | 'operation';

export const STAGE_LABELS: Record<Stage, string> = {
  design: 'Проектирование',
  construction: 'Строительство',
  operation: 'Эксплуатация',
};

/** Коды разделов проектной документации (СПДС). */
export const DISCIPLINES = ['ГП', 'ТХ', 'АР', 'КМ', 'КЖ', 'ОВ', 'ВК', 'ЭОМ', 'СС'] as const;
export type Discipline = (typeof DISCIPLINES)[number];
