export interface ChartSeries {
  id: string;
  label: string;
  values: number[];
  color?: string;
  dashed?: boolean;
  /** Отметить последнюю точку кружком (текущее значение). */
  marker?: boolean;
}

export interface ChartThreshold {
  value: number;
  label: string;
  color?: string;
}

export interface LineChartProps {
  series: ChartSeries[];
  xLabels: string[];
  /** Подписи по вертикали: значение → подпись. */
  yTicks: number[];
  min?: number;
  max: number;
  thresholds?: ChartThreshold[];
  showThresholds?: boolean;
  height?: number;
  unit?: string;
}

const PAD = { left: 54, right: 18, top: 18, bottom: 38 };

/** Линейный график в линейной стилистике: пороговые линии пунктиром, без заливок. */
export function LineChart({
  series,
  xLabels,
  yTicks,
  min = 0,
  max,
  thresholds = [],
  showThresholds = true,
  height = 240,
  unit,
}: LineChartProps) {
  const w = 880;
  const plotW = w - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const yOf = (v: number) => PAD.top + plotH - ((v - min) / (max - min)) * plotH;
  const xOf = (i: number, n: number) => PAD.left + (n <= 1 ? 0 : (plotW * i) / (n - 1));

  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height="auto" style={{ display: 'block' }} role="img" aria-label={series.map((s) => s.label).join(', ')}>
      <path d={`M${PAD.left} ${PAD.top}V${PAD.top + plotH}M${PAD.left} ${PAD.top + plotH}H${w - PAD.right}`} stroke="var(--bst-line-strong)" strokeWidth="1" fill="none" />
      {yTicks.map((t) => (
        <g key={`t-${t}`}>
          <path d={`M${PAD.left} ${yOf(t)}H${w - PAD.right}`} stroke="var(--bst-line)" strokeDasharray="2 5" />
          <text x={PAD.left - 12} y={yOf(t) + 3} textAnchor="end" fontFamily="var(--bst-font-mono)" fontSize="9" fill="var(--bst-text-mute)">
            {t}
          </text>
        </g>
      ))}
      {showThresholds
        ? thresholds.map((th) => (
            <g key={`th-${th.label}`}>
              <path d={`M${PAD.left} ${yOf(th.value)}H${w - PAD.right}`} stroke={th.color ?? 'var(--bst-alarm)'} strokeWidth="1.1" strokeDasharray="6 3" />
              <text x={PAD.left + 6} y={yOf(th.value) - 6} fontFamily="var(--bst-font-mono)" fontSize="9" fill={th.color ?? 'var(--bst-alarm)'}>
                {th.label}
              </text>
            </g>
          ))
        : null}
      {series.map((s) => {
        const pts = s.values.map((v, i) => `${xOf(i, s.values.length)},${yOf(v)}`).join(' ');
        const last = s.values[s.values.length - 1];
        return (
          <g key={s.id}>
            <polyline points={pts} fill="none" stroke={s.color ?? 'var(--bst-accent)'} strokeWidth={s.dashed ? 1.3 : 2} strokeDasharray={s.dashed ? '5 4' : undefined} />
            {s.marker && last !== undefined ? (
              <circle cx={xOf(s.values.length - 1, s.values.length)} cy={yOf(last)} r="4" fill="var(--bst-bg)" stroke={s.color ?? 'var(--bst-accent)'} strokeWidth="2" />
            ) : null}
          </g>
        );
      })}
      {xLabels.map((l, i) => (
        <text
          key={`x-${l}`}
          x={xOf(i, xLabels.length)}
          y={height - 14}
          textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}
          fontFamily="var(--bst-font-mono)"
          fontSize="9"
          fill="var(--bst-text-mute)"
        >
          {l}
        </text>
      ))}
      {unit ? (
        <text x={PAD.left} y={12} fontFamily="var(--bst-font-mono)" fontSize="9" fill="var(--bst-text-mute)">
          {unit}
        </text>
      ) : null}
    </svg>
  );
}

export interface BarChartProps {
  bars: { label: string; value: number; highlight?: boolean }[];
  max: number;
  threshold?: ChartThreshold;
  showThresholds?: boolean;
  height?: number;
  unit?: string;
}

export function BarChart({ bars, max, threshold, showThresholds = true, height = 240, unit }: BarChartProps) {
  const w = 560;
  const plotW = w - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const yOf = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const slot = plotW / bars.length;
  const barW = Math.min(44, slot * 0.54);

  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height="auto" style={{ display: 'block' }} role="img" aria-label={unit ?? 'Диаграмма'}>
      <path d={`M${PAD.left} ${PAD.top}V${PAD.top + plotH}M${PAD.left} ${PAD.top + plotH}H${w - PAD.right}`} stroke="var(--bst-line-strong)" fill="none" />
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <path d={`M${PAD.left} ${yOf(max * f)}H${w - PAD.right}`} stroke="var(--bst-line)" strokeDasharray="2 5" />
          <text x={PAD.left - 10} y={yOf(max * f) + 3} textAnchor="end" fontFamily="var(--bst-font-mono)" fontSize="9" fill="var(--bst-text-mute)">
            {Math.round(max * f)}
          </text>
        </g>
      ))}
      {showThresholds && threshold ? (
        <g>
          <path d={`M${PAD.left} ${yOf(threshold.value)}H${w - PAD.right}`} stroke={threshold.color ?? 'var(--bst-alarm)'} strokeWidth="1.1" strokeDasharray="6 3" />
          <text x={PAD.left + 6} y={yOf(threshold.value) - 6} fontFamily="var(--bst-font-mono)" fontSize="9" fill={threshold.color ?? 'var(--bst-alarm)'}>
            {threshold.label}
          </text>
        </g>
      ) : null}
      {bars.map((b, i) => {
        const cx = PAD.left + slot * i + slot / 2;
        const y = yOf(b.value);
        return (
          <g key={b.label}>
            <rect
              x={cx - barW / 2}
              y={y}
              width={barW}
              height={PAD.top + plotH - y}
              fill={b.highlight ? 'var(--bst-alarm-tint)' : 'var(--bst-accent-tint)'}
              stroke={b.highlight ? 'var(--bst-alarm)' : 'var(--bst-accent)'}
              strokeWidth={b.highlight ? 1.6 : 1}
            />
            <text x={cx} y={y - 7} textAnchor="middle" fontFamily="var(--bst-font-mono)" fontSize="9.5" fill={b.highlight ? 'var(--bst-alarm)' : 'var(--bst-text)'}>
              {b.value}
            </text>
            <text x={cx} y={height - 16} textAnchor="middle" fontFamily="var(--bst-font-mono)" fontSize="9" fill="var(--bst-text-mute)">
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export interface SparklineProps {
  values: number[];
  color?: string;
  threshold?: number;
  width?: number;
  height?: number;
}

/** Компактная динамика параметра для панели детали. */
export function Sparkline({ values, color = 'var(--bst-accent)', threshold, width = 430, height = 140 }: SparklineProps) {
  const max = Math.max(...values, threshold ?? 0) * 1.15 || 1;
  const yOf = (v: number) => height - 22 - (v / max) * (height - 44);
  const xOf = (i: number) => 38 + ((width - 56) * i) / Math.max(1, values.length - 1);
  const last = values[values.length - 1] ?? 0;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="auto" style={{ display: 'block', border: '1px solid var(--bst-line)' }} aria-hidden="true">
      <path d={`M38 12V${height - 22}M38 ${height - 22}H${width - 12}`} stroke="var(--bst-line-strong)" fill="none" />
      {threshold !== undefined ? (
        <>
          <path d={`M38 ${yOf(threshold)}H${width - 12}`} stroke={color} strokeWidth="1.1" strokeDasharray="6 3" />
          <text x={42} y={yOf(threshold) - 6} fontFamily="var(--bst-font-mono)" fontSize="8.5" fill={color}>
            ПОРОГ {threshold}
          </text>
        </>
      ) : null}
      <polyline points={values.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' ')} fill="none" stroke="var(--bst-accent)" strokeWidth="1.9" />
      <circle cx={xOf(values.length - 1)} cy={yOf(last)} r="4.5" fill="var(--bst-bg)" stroke={color} strokeWidth="2" />
    </svg>
  );
}
