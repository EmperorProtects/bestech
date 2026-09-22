'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bot, Play, Square } from 'lucide-react';
import { Frame, ScheduleTable, SectionEyebrow } from '@bestech/ui-kit';
import type { ClaudeWebStatus, JobStatus, Preset, PresetId, WorkspaceJob } from '@/lib/workspace-jobs';
import type { BridgeStatus, PhaseStatus, ProjectPhase } from '@/lib/workspace';

type JobSummary = Omit<WorkspaceJob, 'log' | 'prompt'>;

export interface WorkspacePanelProps {
  assetCode: string;
  shifr: string;
  workspaceDir: string;
  claude: ClaudeWebStatus;
  bridge: BridgeStatus;
  model: { path: string; size: string; mtime: string } | null;
  album: { path: string; sheets: number; mtime: string } | null;
  rpzPath: string | null;
  /** Этапы «Проекта по ТЗ»; null — проект собран без файла этапов. */
  phases: ProjectPhase[] | null;
  /** Сообщение после создания проекта, например «задание не запущено». */
  notice?: string;
  inputs: string[];
  presets: Preset[];
  jobs: JobSummary[];
  canRun: boolean;
  initialJobId?: string;
}

const PHASE: Record<PhaseStatus, { label: string; glyph: string; color: string }> = {
  done: { label: 'ГОТОВО', glyph: '●', color: 'var(--bst-ok)' },
  in_progress: { label: 'В РАБОТЕ', glyph: '○', color: 'var(--bst-accent-ink)' },
  blocked: { label: 'НУЖНО РЕШЕНИЕ', glyph: '▲', color: 'var(--bst-warn)' },
  todo: { label: 'ОЖИДАЕТ', glyph: '', color: 'var(--bst-text-mute)' },
};

const STATUS: Record<JobStatus, { label: string; glyph: string; color: string }> = {
  running: { label: 'ИДЁТ', glyph: '○', color: 'var(--bst-accent-ink)' },
  done: { label: 'ВЫПОЛНЕНО', glyph: '●', color: 'var(--bst-ok)' },
  error: { label: 'ОШИБКА', glyph: '▲', color: 'var(--bst-alarm)' },
  stopped: { label: 'ОСТАНОВЛЕНО', glyph: '✕', color: 'var(--bst-offline)' },
};

function Stamp({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="bst-stamp" style={{ color: ok ? 'var(--bst-ok)' : 'var(--bst-offline)' }}>
      <span aria-hidden="true">{ok ? '●' : '✕'}</span>
      {label}
    </span>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '92px minmax(0, 1fr)', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--bst-line)' }}>
      <span className="bst-mono" style={{ fontSize: 10, color: 'var(--bst-text-mute)' }}>
        {k}
      </span>
      <span className="bst-mono" style={{ fontSize: 11, overflowWrap: 'anywhere' }}>
        {v}
      </span>
    </div>
  );
}

function when(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Панель мастерской: состояние Claude Code и Revit, запуск заданий под скиллы
 * и живой журнал выполнения. Токен сервера мастерской сюда не попадает —
 * браузер общается только с API портала.
 */
export function WorkspacePanel(props: WorkspacePanelProps) {
  const { assetCode, shifr, claude, bridge, presets, canRun } = props;
  const router = useRouter();

  const [jobs, setJobs] = useState<JobSummary[]>(props.jobs);
  const [selectedId, setSelectedId] = useState<string | null>(props.initialJobId ?? props.jobs[0]?.id ?? null);
  const [job, setJob] = useState<WorkspaceJob | null>(null);
  const phasesStarted = Boolean(props.phases?.some((p) => p.status !== 'todo'));
  // Нет модели или проект идёт по этапам без альбома — по умолчанию предлагаем его вести дальше.
  const [preset, setPreset] = useState<PresetId>(!props.model || (props.phases && !props.album) ? 'project' : 'verify');
  const [extra, setExtra] = useState('');
  const [continueSession, setContinueSession] = useState(phasesStarted && props.jobs.length > 0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);

  const running = jobs.some((j) => j.status === 'running');
  const current = presets.find((p) => p.id === preset);

  const refreshList = useCallback(async () => {
    const res = await fetch(`/api/workspace/jobs?asset=${encodeURIComponent(assetCode)}`, { cache: 'no-store' });
    if (res.ok) setJobs(((await res.json()) as { jobs: JobSummary[] }).jobs);
  }, [assetCode]);

  // Опрос выбранного задания, пока оно идёт.
  useEffect(() => {
    if (!selectedId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      const res = await fetch(`/api/workspace/jobs/${selectedId}`, { cache: 'no-store' });
      if (!alive || !res.ok) return;
      const next = ((await res.json()) as { job: WorkspaceJob }).job;
      setJob((prev) => {
        if (prev?.status === 'running' && next.status !== 'running') {
          void refreshList();
          router.refresh(); // альбом и исходные данные могли обновиться
        }
        return next;
      });
      if (next.status === 'running') timer = setTimeout(tick, 1500);
    };
    void tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [selectedId, refreshList, router]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [job?.log]);

  async function start() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch('/api/workspace/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset: assetCode, preset, extra, continueSession }),
      });
      const data = (await res.json()) as { job?: WorkspaceJob; error?: string };
      if (!res.ok || !data.job) {
        setError(data.error ?? `Ошибка ${res.status}`);
        return;
      }
      setExtra('');
      setSelectedId(data.job.id);
      await refreshList();
    } finally {
      setPending(false);
    }
  }

  async function stop() {
    if (!job) return;
    await fetch(`/api/workspace/jobs/${job.id}`, { method: 'DELETE' });
    await refreshList();
  }

  const blocked = !canRun ? 'Запуск доступен проектировщикам' : !claude.online ? 'Сервер мастерской не запущен' : running ? 'Идёт другое задание' : null;

  return (
    <div className="page">
      {props.notice ? (
        <p role="status" className="bst-mono" style={{ margin: 0, fontSize: 12, color: 'var(--bst-warn)' }}>
          ▲ {props.notice}
        </p>
      ) : null}

      {props.phases ? (
        <div>
          <SectionEyebrow aside={`${props.phases.filter((p) => p.status === 'done').length} из ${props.phases.length} этапов`}>
            ХОД ПРОЕКТА ПО ТЗ
          </SectionEyebrow>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginTop: 12, borderTop: '1px solid var(--bst-line)' }}>
            {props.phases.map((ph, i) => (
              <div
                key={ph.id}
                title={ph.comment ?? ph.note}
                style={{ padding: '10px 10px 12px', borderBottom: `2px solid ${ph.status === 'todo' ? 'var(--bst-line)' : PHASE[ph.status].color}` }}
              >
                <div className="bst-mono" style={{ fontSize: 10, color: PHASE[ph.status].color }}>
                  {String(i + 1).padStart(2, '0')} · {PHASE[ph.status].glyph ? `${PHASE[ph.status].glyph} ` : ''}{PHASE[ph.status].label}
                </div>
                <div style={{ fontSize: 13, marginTop: 4 }}>{ph.label}</div>
                <div className="bst-mono" style={{ fontSize: 10, color: 'var(--bst-text-mute)', marginTop: 3 }}>
                  {ph.comment ?? ph.note}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid-4">
        <Frame padded>
          <div className="bst-kpi__label" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Bot size={13} strokeWidth={1.5} aria-hidden="true" /> Claude Code
          </div>
          <div style={{ margin: '10px 0' }}>
            <Stamp ok={claude.online && !claude.error} label={claude.online ? (claude.error ? 'ТОКЕН НЕ ПОДОШЁЛ' : 'НА СВЯЗИ') : 'НЕ ЗАПУЩЕН'} />
          </div>
          <Row k="СЕРВЕР" v={claude.url} />
          <Row k="ПРАВА" v={claude.permissionMode ?? '—'} />
          {claude.error ? (
            <p className="bst-mono" style={{ fontSize: 10, color: 'var(--bst-text-mute)', margin: '8px 0 0' }}>
              {claude.error}
            </p>
          ) : null}
        </Frame>

        <Frame padded>
          <div className="bst-kpi__label">Revit · мост</div>
          <div style={{ margin: '10px 0' }}>
            <Stamp ok={bridge.alive} label={bridge.alive ? 'REVIT ЗАПУЩЕН' : bridge.present ? 'REVIT НЕ ЗАПУЩЕН' : 'МОСТ НЕ НАЙДЕН'} />
          </div>
          <Row k="ВЕРСИЯ" v={bridge.revitVersion ?? '—'} />
          <Row k="PID" v={bridge.pid ?? '—'} />
          <p className="bst-mono" style={{ fontSize: 10, color: 'var(--bst-text-mute)', margin: '8px 0 0' }}>
            задания с Revit без запущенного Revit завершатся ошибкой
          </p>
        </Frame>

        <Frame padded>
          <div className="bst-kpi__label">Модель</div>
          <div className="bst-mono" style={{ fontSize: 20, margin: '8px 0' }}>
            {props.model ? props.model.size : '—'}
          </div>
          <Row k="ФАЙЛ" v={props.model?.path ?? `${shifr}.rvt не найден`} />
          <Row k="ИЗМЕНЕНА" v={props.model?.mtime ?? '—'} />
        </Frame>

        <Frame padded>
          <div className="bst-kpi__label">Альбом</div>
          <div className="bst-mono" style={{ fontSize: 20, margin: '8px 0' }}>
            {props.album ? `${props.album.sheets} л.` : 'не выпущен'}
          </div>
          <Row k="ФАЙЛ" v={props.album?.path ?? '—'} />
          <Row k="ВЫПУЩЕН" v={props.album?.mtime ?? '—'} />
          {props.album ? (
            <Link href={`/cabinet/assets/${assetCode}/documents`} className="bst-btn bst-btn--sm" style={{ marginTop: 10 }}>
              Открыть чертежи
            </Link>
          ) : null}
        </Frame>
      </div>

      <div className="split">
        <div style={{ display: 'grid', gap: 22, alignContent: 'start' }}>
          <div>
            <SectionEyebrow aside={props.workspaceDir}>ЗАДАНИЕ В МАСТЕРСКУЮ · {shifr}</SectionEyebrow>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8, marginTop: 14 }}>
              {presets.map((p) => {
                const active = p.id === preset;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPreset(p.id)}
                    aria-pressed={active}
                    style={{
                      textAlign: 'left',
                      font: 'inherit',
                      color: 'inherit',
                      cursor: 'pointer',
                      padding: '10px 12px',
                      border: `1px solid ${active ? 'var(--bst-accent)' : 'var(--bst-line)'}`,
                      background: active ? 'var(--bst-accent-tint)' : 'transparent',
                    }}
                  >
                    <span style={{ display: 'block', fontSize: 13.5 }}>{p.label}</span>
                    <span className="bst-mono" style={{ display: 'block', fontSize: 10, color: 'var(--bst-text-mute)', marginTop: 3 }}>
                      {p.skill ? `скилл ${p.skill}` : 'без скилла'} · {p.writes ? 'меняет файлы' : 'только чтение'}
                    </span>
                  </button>
                );
              })}
            </div>

            <p style={{ fontSize: 13, color: 'var(--bst-text-soft)', margin: '12px 0 8px' }}>{current?.note}</p>

            <textarea
              className="bst-input"
              rows={4}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder={preset === 'custom' ? 'Опишите задачу для Claude в мастерской' : 'Уточнения к заданию (необязательно)'}
              aria-label="Текст задания"
              style={{ resize: 'vertical', fontFamily: 'var(--bst-font-body)' }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="bst-btn bst-btn--primary"
                onClick={start}
                disabled={Boolean(blocked) || pending}
                title={blocked ?? undefined}
                style={{ position: 'relative' }}
              >
                <i className="bst-corner bst-corner--tl" aria-hidden="true" />
                <i className="bst-corner bst-corner--tr" aria-hidden="true" />
                <i className="bst-corner bst-corner--bl" aria-hidden="true" />
                <i className="bst-corner bst-corner--br" aria-hidden="true" />
                <Play size={14} strokeWidth={1.5} aria-hidden="true" />
                {pending ? 'Запускаем…' : preset === 'project' && phasesStarted ? 'Продолжить проект' : 'Запустить в мастерской'}
              </button>
              <label className="bst-mono" style={{ fontSize: 11, display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={continueSession} onChange={(e) => setContinueSession(e.target.checked)} />
                продолжить прошлую сессию Claude
              </label>
              {blocked ? (
                <span className="bst-mono" style={{ fontSize: 11, color: 'var(--bst-text-mute)' }}>
                  {blocked}
                </span>
              ) : null}
            </div>
            {current?.writes && canRun ? (
              <p className="bst-mono" style={{ fontSize: 10, color: 'var(--bst-warn)', margin: '8px 0 0' }}>
                ▲ задание меняет модель и файлы мастерской — права задаёт сервер мастерской ({claude.permissionMode ?? 'не известны'})
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="bst-mono" style={{ fontSize: 11, color: 'var(--bst-alarm)', margin: '8px 0 0' }}>
                ▲ {error}
              </p>
            ) : null}
          </div>

          <div>
            <SectionEyebrow aside={job ? `${STATUS[job.status].label.toLowerCase()} · ${when(job.startedAt)}` : undefined}>ЖУРНАЛ ЗАДАНИЯ</SectionEyebrow>
            {job ? (
              <div style={{ marginTop: 12 }}>
                <pre
                  ref={logRef}
                  className="bst-mono"
                  style={{
                    margin: 0,
                    padding: 12,
                    minHeight: 180,
                    maxHeight: 420,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    fontSize: 11.5,
                    lineHeight: 1.5,
                    border: '1px solid var(--bst-line)',
                    background: 'var(--bst-surface)',
                  }}
                >
                  {job.log || (job.status === 'running' ? 'Claude запускается в мастерской…' : 'Журнал пуст')}
                </pre>
                {job.result && job.status !== 'running' ? (
                  <Frame padded style={{ marginTop: 12 }}>
                    <div className="bst-kpi__label" style={{ color: STATUS[job.status].color }}>
                      {STATUS[job.status].glyph} Итог
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.5, marginTop: 8 }}>{job.result}</div>
                  </Frame>
                ) : null}
                {job.status === 'running' && canRun ? (
                  <button type="button" className="bst-btn" onClick={stop} style={{ marginTop: 10 }}>
                    <Square size={13} strokeWidth={1.5} aria-hidden="true" /> Остановить
                  </button>
                ) : null}
                <details style={{ marginTop: 10 }}>
                  <summary className="bst-mono" style={{ fontSize: 11, cursor: 'pointer', color: 'var(--bst-text-mute)' }}>
                    текст задания для Claude
                  </summary>
                  <pre className="bst-mono" style={{ whiteSpace: 'pre-wrap', fontSize: 11, color: 'var(--bst-text-soft)' }}>
                    {job.prompt}
                  </pre>
                </details>
              </div>
            ) : (
              <p className="bst-mono" style={{ fontSize: 12, color: 'var(--bst-text-mute)' }}>
                Заданий по объекту ещё не было.
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 22, alignContent: 'start' }}>
          <div>
            <SectionEyebrow rule={false}>ИСТОРИЯ ЗАДАНИЙ</SectionEyebrow>
            <div style={{ marginTop: 12 }}>
              {jobs.length > 0 ? (
                <ScheduleTable
                  rows={jobs}
                  rowKey={(r) => r.id}
                  selectedKey={selectedId}
                  onRowClick={(r) => setSelectedId(r.id)}
                  numbered={false}
                  columns={[
                    {
                      id: 'what',
                      header: 'Задание',
                      cell: (r) => (
                        <span>
                          <span style={{ display: 'block', fontSize: 13 }}>{presets.find((p) => p.id === r.preset)?.label ?? r.preset}</span>
                          <span className="bst-mono" style={{ fontSize: 10, color: 'var(--bst-text-mute)' }}>
                            {when(r.startedAt)} · {r.userName ?? '—'}
                            {r.costUsd !== null ? ` · $${r.costUsd.toFixed(2)}` : ''}
                          </span>
                        </span>
                      ),
                    },
                    {
                      id: 'status',
                      header: 'Статус',
                      width: 120,
                      cell: (r) => (
                        <span className="bst-stamp" style={{ color: STATUS[r.status].color }}>
                          <span aria-hidden="true">{STATUS[r.status].glyph}</span>
                          {STATUS[r.status].label}
                        </span>
                      ),
                    },
                  ]}
                />
              ) : (
                <p className="bst-mono" style={{ fontSize: 12, color: 'var(--bst-text-mute)' }}>
                  пусто
                </p>
              )}
            </div>
          </div>

          <div>
            <SectionEyebrow rule={false}>ИСХОДНЫЕ ДАННЫЕ В МАСТЕРСКОЙ</SectionEyebrow>
            <div style={{ display: 'grid', borderTop: '1px solid var(--bst-line)', marginTop: 12 }}>
              {props.inputs.map((f) => (
                <div key={f} className="bst-mono" style={{ fontSize: 11, padding: '7px 0', borderBottom: '1px solid var(--bst-line)', overflowWrap: 'anywhere' }}>
                  {f}
                </div>
              ))}
              {props.inputs.length === 0 ? (
                <div className="bst-mono" style={{ fontSize: 11, padding: '8px 0', color: 'var(--bst-text-mute)' }}>
                  файлов с шифром {shifr} нет
                </div>
              ) : null}
            </div>
            <p style={{ fontSize: 12, color: 'var(--bst-text-soft)', marginTop: 8 }}>
              Файлы, загруженные на вкладке{' '}
              <Link href={`/cabinet/assets/${assetCode}/inputs`}>«Исходные данные»</Link>, копируются сюда с префиксом шифра — Claude
              видит их в следующем задании.
            </p>
            {props.rpzPath ? <Row k="РПЗ" v={props.rpzPath} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
