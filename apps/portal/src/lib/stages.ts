/**
 * Доступность стадий и функций портала — единственный источник истины.
 *
 * В прототипе работает стадия «Проектирование»: приём исходных данных
 * (загрузка файлов) и выдача рабочей документации (просмотр и скачивание
 * чертежей). Всё, что относится к стадиям «Строительство» и «Эксплуатация» —
 * цифровой двойник, телеметрия, сравнение «факт / проект», аварии,
 * исполнительная документация, эксплуатация и обслуживание — помечено
 * «в разработке»: пункты меню и вкладки видны, но неактивны, маршруты
 * отдают экран-заглушку.
 *
 * Чтобы включить стадию, достаточно перевести её в ENABLED_STAGES: разметка,
 * маршруты и компоненты этих разделов уже написаны и ждут флага.
 */

import type { Stage } from '@bestech/tokens';

const STAGE_IDS: readonly string[] = ['design', 'construction', 'operation'];

/**
 * Стадии в работе. По умолчанию — только проектирование. Для демо-стенда двойника
 * в apps/portal/.env.local: NEXT_PUBLIC_BESTECH_ENABLED_STAGES=design,construction.
 * Префикс NEXT_PUBLIC_ нужен потому, что флаг читают и клиентские компоненты.
 */
export const ENABLED_STAGES: readonly Stage[] = (() => {
  const parsed = (process.env.NEXT_PUBLIC_BESTECH_ENABLED_STAGES ?? 'design')
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is Stage => STAGE_IDS.includes(s));
  return parsed.length ? parsed : ['design'];
})();

export function isStageEnabled(stage: Stage): boolean {
  return ENABLED_STAGES.includes(stage);
}

/** Подпись для неактивного пункта — один текст на всё приложение. */
export const IN_DEVELOPMENT_LABEL = 'в разработке';

export type FeatureId =
  | 'assets'
  | 'assetSheet'
  | 'inputs'
  | 'documents'
  | 'drawings'
  | 'workspace'
  | 'twin'
  | 'deviations'
  | 'telemetry'
  | 'alarms'
  | 'progress'
  | 'survey'
  | 'executive'
  | 'operation'
  | 'maintenance'
  | 'finance'
  | 'team'
  | 'ai';

export interface Feature {
  id: FeatureId;
  label: string;
  /** Стадия жизненного цикла, к которой относится функция; null — сквозная. */
  stage: Stage | null;
  /** Почему функция закрыта — показывается на экране-заглушке. */
  note: string;
  /** Принудительно выключить сквозную функцию, не привязанную к стадии. */
  disabled?: boolean;
}

const FEATURES: Record<FeatureId, Feature> = {
  assets: { id: 'assets', label: 'Мои объекты', stage: null, note: '' },
  assetSheet: { id: 'assetSheet', label: 'Лист объекта', stage: null, note: '' },
  inputs: { id: 'inputs', label: 'Исходные данные', stage: 'design', note: '' },
  documents: { id: 'documents', label: 'Документация', stage: 'design', note: '' },
  drawings: { id: 'drawings', label: 'Чертежи', stage: 'design', note: '' },
  workspace: { id: 'workspace', label: 'Мастерская', stage: 'design', note: '' },

  twin: {
    id: 'twin',
    label: 'Цифровой двойник',
    stage: 'construction',
    note: 'Двойник ведётся по данным стройплощадки: съёмка БПЛА, лазерное сканирование, датчики. Раздел откроется вместе со стадией «Строительство».',
  },
  deviations: {
    id: 'deviations',
    label: 'Факт / проект',
    stage: 'construction',
    note: 'Сравнение исполнительной геометрии с проектной моделью требует данных обмеров — раздел откроется вместе со стадией «Строительство».',
  },
  telemetry: {
    id: 'telemetry',
    label: 'Телеметрия',
    stage: 'construction',
    note: 'Приём пакетов с датчиков температуры бетона, осадок и нагрузок подключается на стадии «Строительство».',
  },
  alarms: {
    id: 'alarms',
    label: 'Аварии',
    stage: 'construction',
    note: 'Очередь аварийных событий работает поверх телеметрии — откроется вместе со стадией «Строительство».',
  },
  progress: {
    id: 'progress',
    label: 'Ход СМР',
    stage: 'construction',
    disabled: true,
    note: 'Учёт хода строительно-монтажных работ — в следующем релизе стадии «Строительство».',
  },
  survey: {
    id: 'survey',
    label: 'БПЛА и сканирование',
    stage: 'construction',
    disabled: true,
    note: 'Облёты БПЛА и лазерное сканирование — в следующем релизе стадии «Строительство».',
  },
  executive: {
    id: 'executive',
    label: 'Исполнительная документация',
    stage: 'construction',
    disabled: true,
    note: 'Акты освидетельствования и исполнительные схемы — в следующем релизе стадии «Строительство».',
  },

  operation: {
    id: 'operation',
    label: 'Эксплуатация',
    stage: 'operation',
    note: 'Паспорт объекта, показания приборов учёта и журнал инцидентов ведутся после ввода в эксплуатацию.',
  },
  maintenance: {
    id: 'maintenance',
    label: 'Обслуживание',
    stage: 'operation',
    note: 'Планово-предупредительные ремонты и заявки подрядчикам ведутся на стадии «Эксплуатация».',
  },

  finance: { id: 'finance', label: 'Финансы', stage: null, disabled: true, note: 'Сметы, акты и платежи по этапам — в следующем релизе.' },
  team: { id: 'team', label: 'Команда', stage: null, disabled: true, note: 'Роли, доступы и делегирование — в следующем релизе.' },
  ai: { id: 'ai', label: 'ИИ-сервисы', stage: null, disabled: true, note: 'Ассистент, оценка стоимости и нормоконтроль — в следующем релизе.' },
};

export function getFeature(id: FeatureId): Feature {
  return FEATURES[id];
}

export function isFeatureEnabled(id: FeatureId): boolean {
  const f = FEATURES[id];
  if (f.disabled) return false;
  return f.stage === null || isStageEnabled(f.stage);
}

/** Причина, по которой функция закрыта, либо null — если она доступна. */
export function featureBlockReason(id: FeatureId): string | null {
  return isFeatureEnabled(id) ? null : FEATURES[id].note;
}
