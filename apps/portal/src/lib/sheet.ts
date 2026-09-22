/**
 * Генератор чертёжного листа в SVG: рамка и основная надпись по ГОСТ 2.104
 * (форма 1), поле чертежа — схематичный план, разрез, фасад или ведомость,
 * в зависимости от наименования листа.
 *
 * Лист генерируется из данных БД, а не берётся из готового файла: так в
 * прототипе работает и просмотр, и скачивание, пока проектировщик не загрузил
 * настоящий PDF или DWG. Если исходник загружен, приоритет у него.
 *
 * Координаты — в миллиметрах листа: A1 841×594, A2 594×420.
 * Линии по ГОСТ 2.303: основная 0.7, тонкая 0.25, осевая штрихпунктирная.
 */

export type SheetKind = 'plan' | 'section' | 'facade' | 'schedule';

export interface SheetSubject {
  code: string;
  name: string;
  format: string;
  version: number;
  changed: string;
}

export interface SheetContext {
  assetCode: string;
  assetName: string;
  stageLabel: string;
  chief: string;
  author: string;
  organization: string;
}

interface Size {
  w: number;
  h: number;
}

const FORMATS: Record<string, Size> = {
  А0: { w: 1189, h: 841 },
  А1: { w: 841, h: 594 },
  А2: { w: 594, h: 420 },
  А3: { w: 420, h: 297 },
  А4: { w: 210, h: 297 },
};

export function sheetSize(format: string): Size {
  return FORMATS[format] ?? FORMATS['А1']!;
}

export function sheetKind(name: string): SheetKind {
  if (/разрез|сечени/i.test(name)) return 'section';
  if (/фасад/i.test(name)) return 'facade';
  if (/ведомость|экспликац|спецификац|общие данные|схема|ведомост/i.test(name)) return 'schedule';
  return 'plan';
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Текст чертёжным шрифтом: узкий, прописной по ГОСТ 2.304 для подписей полей. */
function text(x: number, y: number, value: string, opts: { size?: number; anchor?: 'start' | 'middle' | 'end'; bold?: boolean; fill?: string; rotate?: number } = {}): string {
  const { size = 3.5, anchor = 'start', bold = false, fill = '#1c1c1e', rotate } = opts;
  const transform = rotate ? ` transform="rotate(${rotate} ${x} ${y})"` : '';
  return `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" fill="${fill}"${bold ? ' font-weight="600"' : ''}${transform}>${esc(value)}</text>`;
}

function seg(x1: number, y1: number, x2: number, y2: number, w = 0.25, dash?: string): string {
  return `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="#1c1c1e" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''} fill="none"/>`;
}

/** Псевдоним seg для линий разграфки — читается как «линия таблицы». */
const line = seg;

function rect(x: number, y: number, w: number, h: number, sw = 0.25, fill = 'none'): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="#1c1c1e" stroke-width="${sw}"/>`;
}

/* ── Основная надпись по ГОСТ 2.104, форма 1 (185×55) ────────────────────── */

function titleBlock(size: Size, subject: SheetSubject, ctx: SheetContext): string {
  const w = 185;
  const h = 55;
  const x = size.w - 5 - w;
  const y = size.h - 5 - h;
  // Заливка цветом листа: основная надпись всегда перекрывает поле чертежа,
  // а не просвечивает сквозь размерные цепочки.
  const out: string[] = [rect(x, y, w, h, 0.7, '#fbfaf7')];

  // Вертикальная разбивка: графы 1…9 слева, 4 строки подписей по 5 мм.
  const colLeft = x + 65; // конец блока «Изм. Кол.уч. Лист …»
  const colName = x + 120; // конец графы наименования

  out.push(line(colLeft, y, colLeft, y + 25, 0.7));
  out.push(line(x, y + 25, x + w, y + 25, 0.7));
  out.push(line(colName, y + 25, colName, y + h, 0.7));

  // Левый блок подписей: 5 строк по 5 мм, столбцы 7/10/23/15/10
  const cols = [7, 10, 23, 15, 10];
  let cx = x;
  for (const c of cols.slice(0, -1)) {
    cx += c;
    out.push(line(cx, y, cx, y + 25, 0.25));
  }
  for (let i = 1; i < 5; i += 1) {
    out.push(line(x, y + i * 5, colLeft, y + i * 5, 0.25));
  }

  const heads = ['Изм.', 'Лист', '№ докум.', 'Подп.', 'Дата'];
  let hx = x;
  heads.forEach((headText, i) => {
    const cw = cols[i]!;
    out.push(text(hx + cw / 2, y + 3.6, headText, { size: 2.2, anchor: 'middle' }));
    hx += cw;
  });

  const roles = [
    ['Разраб.', ctx.author, subject.changed],
    ['Пров.', ctx.chief, subject.changed],
    ['Н. контр.', 'Сагинтаев Е.', subject.changed],
    ['ГИП', ctx.chief, subject.changed],
  ];
  roles.forEach((r, i) => {
    const ry = y + 5 + i * 5;
    out.push(text(x + 1.5, ry + 3.6, r[0]!, { size: 2.4 }));
    out.push(text(x + 18, ry + 3.6, r[1]!, { size: 2.4 }));
    out.push(text(x + 48, ry + 3.6, r[2]!, { size: 2.2 }));
  });

  // Графа 1 — наименование изделия и документа
  out.push(text(x + 3, y + 32, ctx.assetName, { size: 4, bold: true }));
  out.push(text(x + 3, y + 38.5, subject.name, { size: 3.2 }));
  out.push(text(x + 3, y + 45, `${ctx.assetCode} · ${subject.code}`, { size: 3 }));
  out.push(text(x + 3, y + 51, `${ctx.organization} · ${ctx.stageLabel}`, { size: 2.4, fill: '#5d5d60' }));

  // Графы 4–7: литера, лист, листов, стадия
  const rows = [
    ['Стадия', ctx.stageLabel === 'Проектирование' ? 'П' : 'Р'],
    ['Лист', subject.code],
    ['Формат', subject.format],
    ['Изм.', String(subject.version)],
  ];
  rows.forEach((r, i) => {
    const ry = y + 25 + i * 7.5;
    out.push(line(colName, ry, x + w, ry, 0.25));
    out.push(text(colName + 2, ry + 5, r[0]!, { size: 2.6, fill: '#5d5d60' }));
    out.push(text(x + w - 2, ry + 5, r[1]!, { size: 3.2, anchor: 'end' }));
  });

  return out.join('');
}

/* ── Поле чертежа ────────────────────────────────────────────────────────── */

interface Field {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Сетка осей с кружками-марками: буквенные по вертикали, цифровые по горизонтали. */
function axisGrid(f: Field, colsCount: number, rowsCount: number): { svg: string; step: { x: number; y: number }; origin: Field } {
  const pad = 22;
  const inner: Field = { x: f.x + pad, y: f.y + pad, w: f.w - pad * 2, h: f.h - pad * 2 };
  const stepX = inner.w / (colsCount - 1);
  const stepY = inner.h / (rowsCount - 1);
  const letters = 'АБВГДЕЖИК';
  const out: string[] = [];

  for (let i = 0; i < colsCount; i += 1) {
    const x = inner.x + i * stepX;
    out.push(seg(x, inner.y - 12, x, inner.y + inner.h + 12, 0.25, '12 3 2 3'));
    out.push(`<circle cx="${x}" cy="${inner.y - 16}" r="4" fill="#fff" stroke="#1c1c1e" stroke-width="0.35"/>`);
    out.push(text(x, inner.y - 14.7, String(i + 1), { size: 3.2, anchor: 'middle' }));
  }
  for (let i = 0; i < rowsCount; i += 1) {
    const y = inner.y + i * stepY;
    out.push(seg(inner.x - 12, y, inner.x + inner.w + 12, y, 0.25, '12 3 2 3'));
    out.push(`<circle cx="${inner.x - 16}" cy="${y}" r="4" fill="#fff" stroke="#1c1c1e" stroke-width="0.35"/>`);
    out.push(text(inner.x - 16, y + 1.2, letters[i] ?? String(i), { size: 3.2, anchor: 'middle' }));
  }

  return { svg: out.join(''), step: { x: stepX, y: stepY }, origin: inner };
}

/** Размерная цепочка по ГОСТ 2.307: выносные линии, засечки под 45°, числа над линией. */
function dimensionChain(x: number, y: number, labels: string[], stepPx: number): string {
  const out: string[] = [];
  let cx = x;
  out.push(seg(x, y, x + labels.length * stepPx, y, 0.35));
  labels.forEach((_, i) => {
    out.push(seg(cx, y - 2, cx, y + 2, 0.35));
    out.push(seg(cx - 1.5, y + 1.5, cx + 1.5, y - 1.5, 0.5));
    out.push(text(cx + stepPx / 2, y - 1.8, labels[i] ?? '', { size: 2.8, anchor: 'middle' }));
    cx += stepPx;
  });
  out.push(seg(cx, y - 2, cx, y + 2, 0.35));
  out.push(seg(cx - 1.5, y + 1.5, cx + 1.5, y - 1.5, 0.5));
  return out.join('');
}

/** Отметка уровня: стрелка-«флажок» с полкой и значением. */
function levelMark(x: number, y: number, value: string): string {
  return [
    seg(x, y, x + 4, y - 4, 0.35),
    seg(x, y, x - 4, y - 4, 0.35),
    seg(x - 4, y - 4, x + 4, y - 4, 0.35),
    seg(x, y - 4, x, y - 9, 0.35),
    seg(x, y - 9, x + 24, y - 9, 0.35),
    text(x + 2, y - 10.5, value, { size: 3 }),
  ].join('');
}

function drawPlan(f: Field, ctx: SheetContext): string {
  const { svg, step, origin } = axisGrid(f, 7, 4);
  const out: string[] = [svg];
  const wall = 1.2;

  // Наружные стены
  out.push(rect(origin.x, origin.y, origin.w, origin.h, wall, '#fff'));
  out.push(rect(origin.x + 2.4, origin.y + 2.4, origin.w - 4.8, origin.h - 4.8, 0.35));

  // Внутренние перегородки по осям
  out.push(line(origin.x + step.x * 2, origin.y, origin.x + step.x * 2, origin.y + origin.h, 0.7));
  out.push(line(origin.x + step.x * 4, origin.y, origin.x + step.x * 4, origin.y + origin.h, 0.7));
  out.push(line(origin.x, origin.y + step.y, origin.x + origin.w, origin.y + step.y, 0.7));

  // Колонны в узлах сетки
  for (let i = 0; i < 7; i += 1) {
    for (let j = 0; j < 4; j += 1) {
      const cx = origin.x + i * step.x;
      const cy = origin.y + j * step.y;
      out.push(rect(cx - 2, cy - 2, 4, 4, 0.35, '#1c1c1e'));
    }
  }

  // Проёмы ворот в наружной стене
  [1, 3, 5].forEach((i) => {
    const gx = origin.x + i * step.x;
    out.push(`<rect x="${gx - 8}" y="${origin.y + origin.h - 1.2}" width="16" height="2.4" fill="#fff"/>`);
    out.push(seg(gx - 8, origin.y + origin.h, gx + 8, origin.y + origin.h, 0.35, '2 1.5'));
  });

  // Номера помещений в кружках и наименования
  const rooms = [
    { i: 1, j: 0.5, n: '1', label: 'Доильный зал' },
    { i: 3, j: 0.5, n: '2', label: 'Молочный блок' },
    { i: 5, j: 0.5, n: '3', label: 'Преддоильная' },
    { i: 1, j: 2, n: '4', label: 'Секция содержания' },
    { i: 3, j: 2, n: '5', label: 'Кормовой стол' },
    { i: 5, j: 2, n: '6', label: 'Венткамера' },
  ];
  for (const r of rooms) {
    const cx = origin.x + r.i * step.x;
    const cy = origin.y + r.j * step.y;
    out.push(`<circle cx="${cx}" cy="${cy}" r="4.5" fill="#fff" stroke="#1c1c1e" stroke-width="0.35"/>`);
    out.push(text(cx, cy + 1.3, r.n, { size: 3.2, anchor: 'middle' }));
    out.push(text(cx, cy + 10, r.label, { size: 2.8, anchor: 'middle', fill: '#5d5d60' }));
  }

  out.push(levelMark(origin.x + step.x * 2, origin.y + step.y * 1.6, '+0.000'));

  const labels = ['6000', '6000', '6000', '6000', '6000', '6000'];
  out.push(dimensionChain(origin.x, origin.y + origin.h + 26, labels, step.x));
  out.push(text(origin.x + origin.w / 2, origin.y + origin.h + 36, `36 000`, { size: 3.2, anchor: 'middle' }));
  out.push(text(f.x + 4, f.y + 8, `${ctx.assetCode} · масштаб 1:200`, { size: 3, fill: '#5d5d60' }));

  return out.join('');
}

function drawSection(f: Field): string {
  const { svg, step, origin } = axisGrid(f, 7, 3);
  const out: string[] = [svg];
  const ground = origin.y + origin.h;

  // Земля со штриховкой откоса
  out.push(seg(origin.x - 20, ground, origin.x + origin.w + 20, ground, 0.9));
  for (let x = origin.x - 18; x < origin.x + origin.w + 20; x += 6) {
    out.push(seg(x, ground, x - 4, ground + 4, 0.25));
  }

  // Колонны и ригели
  for (let i = 0; i < 7; i += 1) {
    const x = origin.x + i * step.x;
    out.push(rect(x - 2.5, origin.y + step.y, 5, origin.h - step.y, 0.7, '#fff'));
  }
  out.push(seg(origin.x, origin.y + step.y, origin.x + origin.w, origin.y + step.y, 0.9));

  // Двускатная кровля
  const ridgeX = origin.x + origin.w / 2;
  out.push(seg(origin.x, origin.y + step.y, ridgeX, origin.y, 0.9));
  out.push(seg(ridgeX, origin.y, origin.x + origin.w, origin.y + step.y, 0.9));
  out.push(text(ridgeX + 6, origin.y + step.y / 2, 'i = 12 %', { size: 2.8, fill: '#5d5d60' }));

  out.push(levelMark(origin.x + step.x, ground, '±0.000'));
  out.push(levelMark(origin.x + step.x * 2, origin.y + step.y, '+3.600'));
  out.push(levelMark(ridgeX, origin.y, '+7.850'));

  const labels = ['6000', '6000', '6000', '6000', '6000', '6000'];
  out.push(dimensionChain(origin.x, ground + 24, labels, step.x));
  return out.join('');
}

function drawFacade(f: Field): string {
  const { svg, step, origin } = axisGrid(f, 7, 3);
  const out: string[] = [svg];
  const ground = origin.y + origin.h;

  out.push(seg(origin.x - 20, ground, origin.x + origin.w + 20, ground, 0.9));
  out.push(rect(origin.x, origin.y + step.y, origin.w, origin.h - step.y, 0.9, '#fff'));

  const ridgeX = origin.x + origin.w / 2;
  out.push(seg(origin.x, origin.y + step.y, ridgeX, origin.y, 0.9));
  out.push(seg(ridgeX, origin.y, origin.x + origin.w, origin.y + step.y, 0.9));

  // Ленточное остекление и ворота
  for (let i = 0; i < 6; i += 1) {
    const x = origin.x + i * step.x + step.x * 0.2;
    out.push(rect(x, origin.y + step.y * 1.35, step.x * 0.6, step.y * 0.38, 0.35));
  }
  [1, 3, 5].forEach((i) => {
    const x = origin.x + i * step.x - step.x * 0.3;
    out.push(rect(x, ground - step.y * 0.62, step.x * 0.6, step.y * 0.62, 0.5));
  });

  out.push(levelMark(origin.x - 6, ground, '±0.000'));
  out.push(levelMark(origin.x + origin.w + 6, origin.y + step.y, '+3.600'));
  out.push(text(origin.x, ground + 16, 'Отделка: сэндвич-панель RAL 9002, цоколь — бетон', { size: 2.8, fill: '#5d5d60' }));
  return out.join('');
}

function drawSchedule(f: Field, subject: SheetSubject, ctx: SheetContext): string {
  const out: string[] = [];
  const x = f.x + 16;
  const y = f.y + 22;
  const w = f.w - 32;
  const rowH = 9;
  const cols = [16, w - 170, 40, 40, 60];
  const heads = ['№', 'Наименование', 'Площ., м²', 'Катег.', 'Примечание'];
  const rows = [
    ['1', 'Доильный зал', '312,4', 'В', 'отм. +0.000'],
    ['2', 'Молочный блок', '148,0', 'Д', 'отм. +0.000'],
    ['3', 'Преддоильная площадка', '96,6', 'Д', 'отм. +0.000'],
    ['4', 'Секция беспривязного содержания', '1 240,8', 'Д', 'отм. +0.000'],
    ['5', 'Кормовой стол', '386,2', 'Д', 'отм. +0.000'],
    ['6', 'Венткамера', '88,4', 'Д', 'отм. +3.600'],
    ['7', 'Электрощитовая', '24,6', 'В', 'отм. +0.000'],
    ['8', 'Помещение персонала', '42,0', 'Д', 'отм. +0.000'],
  ];

  out.push(text(x, y - 6, subject.name.toUpperCase(), { size: 4, bold: true }));
  out.push(rect(x, y, w, rowH * (rows.length + 1), 0.7));

  let cx = x;
  cols.slice(0, -1).forEach((c) => {
    cx += c;
    out.push(line(cx, y, cx, y + rowH * (rows.length + 1), 0.35));
  });
  out.push(line(x, y + rowH, x + w, y + rowH, 0.7));

  cx = x;
  heads.forEach((headText, i) => {
    out.push(text(cx + 2, y + 6, headText, { size: 3, bold: true }));
    cx += cols[i]!;
  });

  rows.forEach((r, i) => {
    const ry = y + rowH * (i + 1);
    if (i > 0) out.push(line(x, ry, x + w, ry, 0.25));
    let rx = x;
    r.forEach((cell, j) => {
      out.push(text(rx + 2, ry + 6, cell, { size: 3 }));
      rx += cols[j]!;
    });
  });

  const foot = y + rowH * (rows.length + 1) + 14;
  out.push(text(x, foot, `Объект: ${ctx.assetName} · ${ctx.assetCode}`, { size: 3, fill: '#5d5d60' }));
  out.push(text(x, foot + 6, `Изменение ${subject.version} от ${subject.changed}`, { size: 3, fill: '#5d5d60' }));
  return out.join('');
}

/* ── Сборка листа ────────────────────────────────────────────────────────── */

export function renderSheetSvg(subject: SheetSubject, ctx: SheetContext): string {
  const size = sheetSize(subject.format);
  const kind = sheetKind(subject.name);

  // Рамка по ГОСТ 2.301: слева 20 мм под подшивку, с остальных сторон по 5 мм.
  const frame: Field = { x: 20, y: 5, w: size.w - 25, h: size.h - 10 };
  // Высота поля оставляет внизу полосу под размерную цепочку и основную надпись.
  const field: Field = { x: frame.x + 6, y: frame.y + 6, w: frame.w - 12, h: frame.h - 6 - 74 };

  const body =
    kind === 'plan' ? drawPlan(field, ctx)
    : kind === 'section' ? drawSection(field)
    : kind === 'facade' ? drawFacade(field)
    : drawSchedule(field, subject, ctx);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size.w} ${size.h}" width="${size.w}mm" height="${size.h}mm" font-family="'IBM Plex Sans', 'Arial Narrow', Arial, sans-serif">`,
    `<rect width="${size.w}" height="${size.h}" fill="#fbfaf7"/>`,
    rect(frame.x, frame.y, frame.w, frame.h, 0.7),
    body,
    titleBlock(size, subject, ctx),
    '</svg>',
  ].join('');
}

/** Имя файла для скачивания: 2026-014_АР-05_изм5.svg */
export function sheetFileName(assetCode: string, subject: SheetSubject, ext: string): string {
  return `${assetCode}_${subject.code}_изм${subject.version}.${ext}`;
}
