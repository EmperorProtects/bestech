/**
 * Датчики объекта 2026-014 (молочный комплекс) для демо-стенда двойника.
 * Координаты — в системе вьюера модели (viewBox 760×470), пороги — по разделам
 * КЖ, КМ, ВК, ЭОМ. Засеваются в таблицу sensors; дальше портал работает только с БД,
 * и новые датчики добавляются туда же без правки кода.
 */

export const DEMO_ASSET = '2026-014';

/** Ключ демо-шлюза. В реальной эксплуатации ключи выпускаются на каждое устройство. */
export const DEMO_INGEST_KEY = process.env.BESTECH_DEMO_INGEST_KEY ?? 'bst_demo_2026-014_gateway';

export type SensorKind = 'temperature' | 'strength' | 'settlement' | 'load' | 'crack' | 'pressure' | 'power';

export interface SensorSpec {
  code: string;
  discipline: string;
  name: string;
  kind: SensorKind;
  unit: string;
  decimals: number;
  axis: string;
  x: number;
  y: number;
  warnLow?: number;
  warnHigh?: number;
  alarmLow?: number;
  alarmHigh?: number;
  /** Штатный период опроса, с. Датчик без пакетов дольше 4 периодов считается без связи. */
  interval: number;
}

const concrete = { discipline: 'КЖ', kind: 'temperature' as const, unit: '°C', decimals: 1, warnLow: 8, warnHigh: 32, alarmLow: 5, alarmHigh: 35, interval: 5 };
const settlement = { discipline: 'КЖ', kind: 'settlement' as const, name: 'Осадка деформационной марки', unit: 'мм', decimals: 1, warnHigh: 12, alarmHigh: 15, interval: 5 };
const truss = { discipline: 'КМ', kind: 'load' as const, name: 'Нагрузка на ферму покрытия', unit: '%', decimals: 0, warnHigh: 75, alarmHigh: 80, interval: 5 };

export const SENSOR_CATALOG: SensorSpec[] = [
  { ...concrete, code: 'КЖ-1', name: 'Температура бетона, ось А/1', axis: 'ось А/1 · монолит перекрытия +0.000', x: 372.7, y: 160 },
  { ...concrete, code: 'КЖ-3', name: 'Температура бетона, ось Б/4', axis: 'ось Б/4 · монолит перекрытия +0.000', x: 445.5, y: 202 },
  {
    code: 'ПР-3',
    discipline: 'КЖ',
    name: 'Набор прочности бетона, ось Б/4',
    kind: 'strength',
    unit: '% R28',
    decimals: 0,
    axis: 'ось Б/4 · датчик зрелости бетона',
    x: 492,
    y: 238,
    interval: 5,
  },
  { ...settlement, code: 'ГМ-01', axis: 'ось А/1 · марка ГМ-01', x: 214, y: 168 },
  { ...settlement, code: 'ГМ-03', axis: 'ось Б/6 · марка ГМ-03', x: 364, y: 298 },
  { ...settlement, code: 'ГМ-07', axis: 'ось В/2 · марка ГМ-07', x: 275.7, y: 258 },
  { ...truss, code: 'Ф-1', axis: 'оси 1–2 · ферма Ф-1', x: 330, y: 108 },
  { ...truss, code: 'Ф-2', axis: 'оси 4–5 · ферма Ф-2', x: 457.6, y: 181 },
  { ...truss, code: 'Ф-3', axis: 'оси 6–7 · ферма Ф-3', x: 548, y: 226 },
  {
    code: 'ТР-1',
    discipline: 'КЖ',
    name: 'Раскрытие трещины, стена по оси Г',
    kind: 'crack',
    unit: 'мм',
    decimals: 2,
    axis: 'ось Г/3 · трещиномер',
    x: 176,
    y: 212,
    warnHigh: 0.2,
    alarmHigh: 0.3,
    interval: 5,
  },
  {
    code: 'ВК-У2',
    discipline: 'ВК',
    name: 'Давление в узле водоснабжения',
    kind: 'pressure',
    unit: 'МПа',
    decimals: 2,
    axis: 'узел У2 · ввод В1',
    x: 397,
    y: 356,
    warnLow: 0.33,
    warnHigh: 0.57,
    alarmLow: 0.3,
    alarmHigh: 0.6,
    interval: 5,
  },
  {
    code: 'ЭОМ-ТП',
    discipline: 'ЭОМ',
    name: 'Загрузка трансформатора ТП-1',
    kind: 'power',
    unit: '%',
    decimals: 0,
    axis: 'ТП-1 · ось А/1',
    x: 300,
    y: 188,
    warnHigh: 80,
    alarmHigh: 95,
    interval: 5,
  },
];
