import type { ReactNode } from 'react';
import { AlertTriangle, Check, CircleAlert, Upload, X } from 'lucide-react';
import { TOLERANCE, type ToleranceState } from '@bestech/tokens';
import { DimensionLine, Frame } from './frame';

export interface KpiTileProps {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  /** Доля 0…1 для размерной линии. */
  progress?: number;
  plan?: number;
  footLeft?: ReactNode;
  footRight?: ReactNode;
  color?: string;
  children?: ReactNode;
}

/** KPI-плитка: значение моноцифрами и размерная линия вместо полосы прогресса. */
export function KpiTile({ label, value, unit, progress, plan, footLeft, footRight, color, children }: KpiTileProps) {
  return (
    <Frame padded>
      <div className="bst-kpi__label">{label}</div>
      <div className="bst-kpi__value" style={color ? { color } : undefined}>
        {value}
        {unit ? <span className="bst-kpi__unit">{unit}</span> : null}
      </div>
      {progress !== undefined ? <DimensionLine value={progress} plan={plan} color={color ?? 'var(--bst-accent)'} /> : null}
      {footLeft || footRight ? (
        <div className="bst-kpi__foot">
          <span>{footLeft}</span>
          <span>{footRight}</span>
        </div>
      ) : null}
      {children}
    </Frame>
  );
}

export type StepState = 'done' | 'current' | 'todo';

export interface StageStepperProps {
  steps: { key: string; label: string; note: string; state: StepState }[];
}

export function StageStepper({ steps }: StageStepperProps) {
  return (
    <div className="bst-stepper">
      {steps.map((s, i) => (
        <div key={s.key} className="bst-stepper__step" data-state={s.state}>
          <div className="bst-stepper__k">
            {String(i + 1).padStart(2, '0')} · {s.state === 'done' ? 'ЗАВЕРШЕНО' : s.state === 'current' ? 'ТЕКУЩАЯ СТАДИЯ' : 'ОЖИДАЕТ'}
          </div>
          <div className="bst-stepper__t">{s.label}</div>
          <div className="bst-stepper__n">{s.note}</div>
        </div>
      ))}
    </div>
  );
}

const SEVERITY_ICON = {
  ok: Check,
  warning: AlertTriangle,
  alarm: AlertTriangle,
  offline: X,
  info: CircleAlert,
} as const;

export interface AlertProps {
  severity: ToleranceState | 'info';
  title: ReactNode;
  note?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
}

/** Алерт: цвет + иконка + текстовая подпись состояния. */
export function Alert({ severity, title, note, meta, action }: AlertProps) {
  const color = severity === 'info' ? 'var(--bst-accent-ink)' : TOLERANCE[severity].cssVar;
  const tint =
    severity === 'alarm'
      ? 'var(--bst-alarm-tint)'
      : severity === 'warning'
        ? 'var(--bst-warn-tint)'
        : severity === 'ok'
          ? 'var(--bst-ok-tint)'
          : severity === 'offline'
            ? 'var(--bst-offline-tint)'
            : 'var(--bst-accent-tint)';
  const Icon = SEVERITY_ICON[severity];

  return (
    <div className="bst-alert" style={{ borderLeftColor: color, background: tint }}>
      <Icon size={17} strokeWidth={1.5} color={color} style={{ flex: 'none', marginTop: 1 }} aria-hidden="true" />
      <div style={{ minWidth: 0 }}>
        <div className="bst-alert__title" style={{ color }}>
          {title}
        </div>
        {note ? <div className="bst-alert__note">{note}</div> : null}
        {meta ? <div style={{ fontFamily: 'var(--bst-font-mono)', fontSize: 10, color: 'var(--bst-text-mute)', marginTop: 4 }}>{meta}</div> : null}
      </div>
      {action ? <div style={{ marginLeft: 'auto', flex: 'none' }}>{action}</div> : null}
    </div>
  );
}

export interface DropzoneProps {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  onFiles?: (files: File[]) => void;
  /** Файл над зоной — подсветка задаётся атрибутом data-over. */
  over?: boolean;
  onOverChange?: (over: boolean) => void;
}

/** Загрузка «перетащите на лист»: поведение drag&drop задаёт приложение. */
export function Dropzone({ title, hint, action, onFiles, over, onOverChange }: DropzoneProps) {
  return (
    <div
      className="bst-dropzone"
      data-over={over ? 'true' : 'false'}
      onDragOver={(e) => {
        e.preventDefault();
        onOverChange?.(true);
      }}
      onDragLeave={() => onOverChange?.(false)}
      onDrop={(e) => {
        e.preventDefault();
        onOverChange?.(false);
        onFiles?.(Array.from(e.dataTransfer.files));
      }}
    >
      <Upload size={26} strokeWidth={1.5} color="var(--bst-accent-ink)" style={{ margin: '0 auto 8px' }} aria-hidden="true" />
      <div style={{ fontFamily: 'var(--bst-font-heading)', fontSize: 19, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{title}</div>
      <div style={{ fontFamily: 'var(--bst-font-mono)', fontSize: 11, color: 'var(--bst-text-mute)', margin: '6px 0 14px' }}>{hint}</div>
      {action}
    </div>
  );
}

export interface EmptyStateProps {
  title: ReactNode;
  note?: ReactNode;
  action?: ReactNode;
}

/** Пустое состояние с каркасной иллюстрацией — без фотографий и стоков. */
export function EmptyState({ title, note, action }: EmptyStateProps) {
  return (
    <div className="bst-empty">
      <svg width="130" height="78" viewBox="0 0 130 78" fill="none" stroke="var(--bst-accent-400)" strokeWidth="1" style={{ margin: '0 auto 14px' }} aria-hidden="true">
        <path d="M22 50 65 26l43 24-43 24z" />
        <path d="M22 50V30l43-24 43 24v20" />
        <path d="M65 6v20M22 30l43 24 43-24" strokeDasharray="3 3" />
      </svg>
      <h3 className="bst-h" style={{ fontSize: 20 }}>
        {title}
      </h3>
      {note ? <p style={{ fontSize: 14, color: 'var(--bst-text-soft)', margin: '6px 0 16px', maxWidth: '46ch', marginInline: 'auto' }}>{note}</p> : null}
      {action}
    </div>
  );
}

/** Метка ИИ-результата: по требованиям обязательна на каждом сгенерированном блоке. */
export function AiNotice({ text = 'Сгенерировано ИИ — требует проверки инженером' }: { text?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: 'var(--bst-font-mono)',
        fontSize: 10,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--bst-text-mute)',
      }}
    >
      <span style={{ border: '1px solid var(--bst-accent-edge)', color: 'var(--bst-accent-ink)', padding: '1px 5px' }}>ИИ</span>
      {text}
    </div>
  );
}
