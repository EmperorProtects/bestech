/**
 * Общие для сервера и браузера константы двойника. Файл без серверных
 * зависимостей: его импортируют клиентские компоненты.
 */

/** Ключи периода совпадают со стором телеметрии; в живом режиме это окна минут, а не дней. */
export type LivePeriod = '24h' | '7d' | '30d' | 'all';

export const LIVE_PERIODS: { value: LivePeriod; label: string; ms: number | null }[] = [
  { value: '24h', label: '5 МИН', ms: 5 * 60_000 },
  { value: '7d', label: '15 МИН', ms: 15 * 60_000 },
  { value: '30d', label: '1 Ч', ms: 60 * 60_000 },
  { value: 'all', label: 'ВСЁ', ms: null },
];

export function isLivePeriod(value: string | null): value is LivePeriod {
  return LIVE_PERIODS.some((p) => p.value === value);
}

/**
 * Как часто экраны двойника опрашивают портал. 2 с — для показа на своей машине;
 * через туннель (ngrok, Cloudflare) ставьте 5000–15000 в NEXT_PUBLIC_BESTECH_LIVE_POLL_MS,
 * иначе одна вкладка делает около 1800 запросов в час.
 */
const pollFromEnv = Number(process.env.NEXT_PUBLIC_BESTECH_LIVE_POLL_MS);
export const LIVE_POLL_MS = Number.isFinite(pollFromEnv) && pollFromEnv >= 1000 ? Math.min(pollFromEnv, 60_000) : 2000;

export type ScenarioId = 'normal' | 'load' | 'settle' | 'heat' | 'offline';

/** Сценарии эмулятора датчиков — для демонстрации реакции портала на события. */
export const SCENARIOS: { id: ScenarioId; label: string; note: string }[] = [
  { id: 'normal', label: 'Всё в норме', note: 'значения возвращаются к рабочим, связь восстанавливается' },
  { id: 'load', label: 'Перегруз фермы Ф-2', note: 'нагрузка растёт до 88 %: предупреждение, затем авария' },
  { id: 'settle', label: 'Осадка марки ГМ-07', note: 'осадка переходит допуск 15 мм' },
  { id: 'heat', label: 'Перегрев бетона КЖ-3', note: 'температура твердеющего бетона выше 35 °C' },
  { id: 'offline', label: 'Обрыв связи ТП-1', note: 'датчик ЭОМ-ТП перестаёт присылать пакеты' },
];

/** Квитировать аварии и управлять эмулятором могут проектировщик и технадзор. */
export function canOperateTwin(role: string): boolean {
  return role === 'engineer' || role === 'supervisor';
}
