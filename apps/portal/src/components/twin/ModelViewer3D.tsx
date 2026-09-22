'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Sensor } from '@/api/types';
import { AXES_X, AXES_Z, BUILDING, TRUSS_OF_SENSOR, roofHeightAt, sensorPosition } from '@/lib/twin/model3d';
import { ModelViewer, type ModelViewerProps } from './ModelViewer';

/* ── Палитра из токенов темы ──────────────────────────────────────────────── */

interface Palette {
  line: THREE.Color;
  lineSoft: THREE.Color;
  grid: THREE.Color;
  ok: THREE.Color;
  warning: THREE.Color;
  alarm: THREE.Color;
  offline: THREE.Color;
}

/** Любой CSS-цвет токена (hex, rgb, oklch) → THREE.Color через нормализацию canvas. */
function cssColor(variable: string, fallback: string): THREE.Color {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || fallback;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return new THREE.Color(fallback);
  ctx.fillStyle = fallback;
  ctx.fillStyle = raw;
  const normalized = String(ctx.fillStyle).replace(/^rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)$/, 'rgb($1,$2,$3)');
  return new THREE.Color(normalized);
}

function readPalette(): Palette {
  return {
    line: cssColor('--bst-accent', '#9cc7f2'),
    lineSoft: cssColor('--bst-accent-700', '#4a6a8f'),
    grid: cssColor('--bst-grid', '#2c3e55'),
    ok: cssColor('--bst-ok', '#7fc49a'),
    warning: cssColor('--bst-warn', '#e3b865'),
    alarm: cssColor('--bst-alarm', '#e8837a'),
    offline: cssColor('--bst-offline', '#b7b7ba'),
  };
}

const stateColor = (p: Palette, state: Sensor['state']) =>
  state === 'alarm' ? p.alarm : state === 'warning' ? p.warning : state === 'offline' ? p.offline : p.ok;

/* ── Геометрия каркаса: только линии, как на чертеже ─────────────────────── */

type Seg = [number, number, number, number, number, number];

function lineObject(segments: Seg[], color: THREE.Color, opacity = 1, dashed = false): THREE.LineSegments {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(segments.flat(), 3));
  const material = dashed
    ? new THREE.LineDashedMaterial({ color, dashSize: 0.9, gapSize: 0.5, transparent: opacity < 1, opacity })
    : new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  const lines = new THREE.LineSegments(geometry, material);
  if (dashed) lines.computeLineDistances();
  return lines;
}

function trussSegments(x: number): Seg[] {
  const { eave, span } = BUILDING;
  const out: Seg[] = [[x, eave, 0, x, eave, span]];
  const nodes = [0, 3, 6, 9, 12, 15, 18];
  for (let i = 0; i < nodes.length - 1; i += 1) {
    const z1 = nodes[i]!;
    const z2 = nodes[i + 1]!;
    out.push([x, roofHeightAt(z1), z1, x, roofHeightAt(z2), z2]); // верхний пояс
    out.push([x, eave, z2, x, roofHeightAt(z2), z2]); // стойка
    out.push([x, eave, z1, x, roofHeightAt(z2), z2]); // раскос
  }
  return out;
}

interface Structure {
  group: THREE.Group;
  trusses: Map<string, THREE.LineBasicMaterial>;
  dispose: () => void;
}

function buildStructure(p: Palette): Structure {
  const group = new THREE.Group();
  const { length, span, bay, eave, ridge } = BUILDING;

  // Сетка осей — пунктиром, с запасом за контур
  const axes: Seg[] = [];
  for (let i = 0; i <= length / bay; i += 1) axes.push([i * bay, 0, -3, i * bay, 0, span + 3]);
  for (let j = 0; j <= span / bay; j += 1) axes.push([-3, 0, j * bay, length + 3, 0, j * bay]);
  group.add(lineObject(axes, p.lineSoft, 0.8, true));

  // Площадка вокруг — едва заметная сетка
  const ground = new THREE.GridHelper(96, 48, p.grid, p.grid);
  ground.position.set(length / 2, -0.02, span / 2);
  (ground.material as THREE.Material).transparent = true;
  (ground.material as THREE.Material).opacity = 0.35;
  group.add(ground);

  // Плита и кровля — лёгкая заливка, чтобы читался объём
  const fill = new THREE.MeshBasicMaterial({ color: p.line, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false });
  const slab = new THREE.Mesh(new THREE.PlaneGeometry(length, span).rotateX(-Math.PI / 2).translate(length / 2, 0, span / 2), fill);
  group.add(slab);
  const roofGeo = new THREE.BufferGeometry();
  roofGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [0, eave, 0, length, eave, 0, length, ridge, span / 2, 0, eave, 0, length, ridge, span / 2, 0, ridge, span / 2,
        0, eave, span, 0, ridge, span / 2, length, ridge, span / 2, 0, eave, span, length, ridge, span / 2, length, eave, span],
      3,
    ),
  );
  group.add(new THREE.Mesh(roofGeo, fill));

  // Каркас: колонны по периметру, обвязка, стены, проёмы, прогоны, конёк
  const frame: Seg[] = [
    [0, 0, 0, length, 0, 0], [0, 0, span, length, 0, span], [0, 0, 0, 0, 0, span], [length, 0, 0, length, 0, span],
    [0, eave, 0, length, eave, 0], [0, eave, span, length, eave, span],
    [0, ridge, span / 2, length, ridge, span / 2],
    [0, (eave + ridge) / 2, span / 4, length, (eave + ridge) / 2, span / 4],
    [0, (eave + ridge) / 2, (3 * span) / 4, length, (eave + ridge) / 2, (3 * span) / 4],
  ];
  for (let i = 0; i <= length / bay; i += 1) {
    const x = i * bay;
    frame.push([x, 0, 0, x, eave, 0], [x, 0, span, x, eave, span]);
    if (i < length / bay) {
      // ленточное остекление на продольных стенах
      for (const z of [0, span]) {
        frame.push([x + 0.8, 3.4, z, x + bay - 0.8, 3.4, z], [x + 0.8, 4.8, z, x + bay - 0.8, 4.8, z]);
      }
    }
  }
  for (let j = 0; j <= span / bay; j += 1) {
    frame.push([0, 0, j * bay, 0, eave, j * bay], [length, 0, j * bay, length, eave, j * bay]);
  }
  for (const gx of [6, 18, 30]) {
    // ворота в стене по оси А
    frame.push([gx - 1.6, 0, 0, gx - 1.6, 3.8, 0], [gx + 1.6, 0, 0, gx + 1.6, 3.8, 0], [gx - 1.6, 3.8, 0, gx + 1.6, 3.8, 0]);
  }
  group.add(lineObject(frame, p.line, 0.95));

  // Фермы: у датчиков нагрузки — отдельный материал, чтобы красить по состоянию
  const named = new Map<number, string>(Object.entries(TRUSS_OF_SENSOR).map(([code, x]) => [x, code]));
  const plain: Seg[] = [];
  const trusses = new Map<string, THREE.LineBasicMaterial>();
  for (let i = 0; i <= length / bay; i += 1) {
    const x = i * bay;
    const code = named.get(x);
    if (code) {
      const obj = lineObject(trussSegments(x), p.line);
      trusses.set(code, obj.material as THREE.LineBasicMaterial);
      group.add(obj);
    } else {
      plain.push(...trussSegments(x));
    }
  }
  group.add(lineObject(plain, p.lineSoft, 0.9));

  // Марки осей
  const addAxisLabel = (text: string, x: number, z: number) => {
    const el = document.createElement('div');
    el.className = 'tw3d-axis';
    el.textContent = text;
    const obj = new CSS2DObject(el);
    obj.position.set(x, 0, z);
    group.add(obj);
  };
  AXES_X.forEach((a, i) => addAxisLabel(a, i * bay, -4.2));
  AXES_Z.forEach((a, j) => addAxisLabel(a, -4.2, j * bay));

  return {
    group,
    trusses,
    dispose: () => {
      group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose?.();
      });
      // Метки осей удаляем явно: CSS2DObject убирает свой элемент из DOM по событию removed.
      group.children.filter((c) => c instanceof CSS2DObject).forEach((c) => group.remove(c));
    },
  };
}

/* ── Движок сцены ─────────────────────────────────────────────────────────── */

type View = 'iso' | 'top' | 'side';

interface Marker {
  group: THREE.Group;
  core: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  halo: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  stem: THREE.LineSegments | null;
  label: CSS2DObject;
  code: HTMLElement;
  value: HTMLElement;
  state: Sensor['state'];
}

interface Engine {
  setSensors: (sensors: Sensor[], selectedId: string | null) => void;
  focus: (id: string) => void;
  setView: (view: View) => void;
  setAutoRotate: (on: boolean) => void;
  dispose: () => void;
}

function createEngine(mount: HTMLDivElement, onPick: (id: string) => void): Engine {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', display: 'block', outline: 'none' });
  mount.appendChild(renderer.domElement);

  const labels = new CSS2DRenderer();
  Object.assign(labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
  mount.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 600);
  const center = new THREE.Vector3(BUILDING.length / 2, 3.5, BUILDING.span / 2);
  const views: Record<View, THREE.Vector3> = {
    iso: new THREE.Vector3(-22, 30, -26),
    top: new THREE.Vector3(BUILDING.length / 2 + 0.01, 66, BUILDING.span / 2 + 0.01),
    side: new THREE.Vector3(BUILDING.length / 2, 9, -48),
  };
  camera.position.copy(views.iso);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(center);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 8;
  controls.maxDistance = 150;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.autoRotateSpeed = 0.7;

  let palette = readPalette();
  let structure = buildStructure(palette);
  scene.add(structure.group);

  const markers = new Map<string, Marker>();
  let sensors: Sensor[] = [];
  let selected: string | null = null;
  let camGoal: THREE.Vector3 | null = null;
  let targetGoal: THREE.Vector3 | null = null;
  controls.addEventListener('start', () => {
    // Пользователь взялся за модель — полёт камеры отменяем.
    camGoal = null;
    targetGoal = null;
  });

  const coreGeo = new THREE.SphereGeometry(0.42, 18, 12);
  const haloGeo = new THREE.SphereGeometry(0.95, 18, 12);

  function createMarker(sensor: Sensor, index: number): Marker {
    const [x, y, z] = sensorPosition(sensor.code, index);
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const core = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: palette.ok, transparent: true }));
    const halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({ color: palette.ok, transparent: true, opacity: 0.16, depthWrite: false }));
    core.userData.sensorId = sensor.id;
    halo.userData.sensorId = sensor.id;
    group.add(core, halo);

    let stem: THREE.LineSegments | null = null;
    if (y > 1.5) {
      stem = lineObject([[0, 0, 0, 0, -y, 0]], palette.lineSoft, 0.6, true);
      group.add(stem);
    }

    const el = document.createElement('div');
    el.className = 'tw3d-label';
    const code = document.createElement('b');
    const value = document.createElement('span');
    el.append(code, value);
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onPick(sensor.id);
    });
    const label = new CSS2DObject(el);
    label.position.set(0, 1.35, 0);
    group.add(label);

    scene.add(group);
    return { group, core, halo, stem, label, code, value, state: sensor.state };
  }

  function removeMarker(m: Marker) {
    scene.remove(m.group);
    m.group.remove(m.label);
    m.core.material.dispose();
    m.halo.material.dispose();
    if (m.stem) {
      m.stem.geometry.dispose();
      (m.stem.material as THREE.Material).dispose();
    }
  }

  function apply() {
    const ids = new Set(sensors.map((s) => s.id));
    for (const [id, m] of markers) {
      if (!ids.has(id)) {
        removeMarker(m);
        markers.delete(id);
      }
    }
    sensors.forEach((s, i) => {
      let m = markers.get(s.id);
      if (!m) {
        m = createMarker(s, i);
        markers.set(s.id, m);
      }
      const color = stateColor(palette, s.state);
      m.state = s.state;
      m.core.material.color.copy(color);
      m.core.material.opacity = s.state === 'offline' ? 0.45 : 1;
      m.halo.material.color.copy(color);
      m.code.textContent = s.code;
      m.value.textContent = s.value;
      m.label.element.dataset.state = s.state;
      m.label.element.dataset.selected = String(s.id === selected);
    });

    // Фермы красятся по состоянию своих датчиков нагрузки
    for (const [code, material] of structure.trusses) {
      const s = sensors.find((x) => x.code === code);
      const color = !s || s.state === 'ok' ? palette.line : stateColor(palette, s.state);
      material.color.copy(color);
    }
  }

  const resize = () => {
    const w = mount.clientWidth || 640;
    const h = mount.clientHeight || 420;
    renderer.setSize(w, h);
    labels.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(mount);
  resize();

  // Смена темы «Бумага» / «Цианотипия» — перечитываем токены и перестраиваем каркас
  const mo = new MutationObserver(() => {
    palette = readPalette();
    scene.remove(structure.group);
    structure.dispose();
    structure = buildStructure(palette);
    scene.add(structure.group);
    apply();
  });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // Клик по датчику (без перетаскивания)
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let down = { x: 0, y: 0 };
  const onDown = (e: PointerEvent) => {
    down = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(
      [...markers.values()].flatMap((m) => [m.core, m.halo]),
      false,
    )[0];
    const id = hit?.object.userData.sensorId as string | undefined;
    if (id) onPick(id);
  };
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);

  const clock = new THREE.Clock();
  let raf = 0;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    const t = clock.getElapsedTime();

    if (camGoal) {
      camera.position.lerp(camGoal, 0.07);
      if (camera.position.distanceTo(camGoal) < 0.05) camGoal = null;
    }
    if (targetGoal) {
      controls.target.lerp(targetGoal, 0.07);
      if (controls.target.distanceTo(targetGoal) < 0.05) targetGoal = null;
    }

    for (const [id, m] of markers) {
      const isSelected = id === selected;
      const pulsing = m.state === 'alarm' || m.state === 'warning';
      const speed = m.state === 'alarm' ? 6 : 3;
      const wave = 0.5 + 0.5 * Math.sin(t * speed);
      m.halo.visible = pulsing || isSelected;
      m.halo.scale.setScalar((isSelected ? 1.3 : 1) + (pulsing ? 0.45 * wave : 0));
      m.halo.material.opacity = pulsing ? 0.1 + 0.22 * wave : 0.18;
    }

    controls.update();
    renderer.render(scene, camera);
    labels.render(scene, camera);
  };
  tick();

  return {
    setSensors(next, selectedId) {
      sensors = next;
      selected = selectedId;
      apply();
    },
    focus(id) {
      const m = markers.get(id);
      if (!m) return;
      const p = m.group.position.clone();
      const offset = camera.position.clone().sub(controls.target);
      offset.setLength(Math.min(38, Math.max(18, offset.length())));
      targetGoal = p;
      camGoal = p.clone().add(offset);
    },
    setView(view) {
      camGoal = views[view].clone();
      targetGoal = center.clone();
    },
    setAutoRotate(on) {
      controls.autoRotate = on;
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      controls.dispose();
      for (const m of markers.values()) removeMarker(m);
      markers.clear();
      scene.remove(structure.group);
      structure.dispose();
      coreGeo.dispose();
      haloGeo.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labels.domElement.remove();
    },
  };
}

/* ── Компонент ────────────────────────────────────────────────────────────── */

const GLYPH = { ok: '●', warning: '▲', alarm: '▲', offline: '✕' } as const;

/**
 * 3D-вьюер двойника: каркас корпуса, датчики по привязке, цвет по состоянию,
 * пульсация при выходе за допуск, подсветка фермы с перегрузом. Модель вращается
 * мышью, датчик выбирается кликом. Без WebGL показывает схему.
 */
export default function ModelViewer3D(props: ModelViewerProps) {
  const { sensors, selectedId, onSelect, scale, legend } = props;
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const onSelectRef = useRef(onSelect);
  const prevSelected = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let engine: Engine;
    try {
      engine = createEngine(mount, (id) => onSelectRef.current(id));
    } catch {
      setFailed(true);
      return;
    }
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setSensors(sensors, selectedId);
  }, [sensors, selectedId]);

  useEffect(() => {
    // Первый автоматический выбор (самый критичный датчик) камеру не двигает — только клики.
    if (selectedId && prevSelected.current && prevSelected.current !== selectedId) engineRef.current?.focus(selectedId);
    prevSelected.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    engineRef.current?.setAutoRotate(autoRotate);
  }, [autoRotate]);

  if (failed) return <ModelViewer {...props} />;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 420 }}>
      <style>{`
        .tw3d-label {
          font-family: var(--bst-font-mono); font-size: 10.5px; line-height: 1.25; white-space: nowrap;
          padding: 2px 6px; border: 1px solid var(--bst-ok); color: var(--bst-text); cursor: pointer; pointer-events: auto;
          background: color-mix(in srgb, var(--bst-bg) 84%, transparent);
        }
        .tw3d-label b { font-weight: 500; margin-right: 6px; color: var(--bst-ok); }
        .tw3d-label[data-state="warning"] { border-color: var(--bst-warn); }
        .tw3d-label[data-state="warning"] b { color: var(--bst-warn); }
        .tw3d-label[data-state="alarm"] { border-color: var(--bst-alarm); background: color-mix(in srgb, var(--bst-alarm) 18%, var(--bst-bg)); }
        .tw3d-label[data-state="alarm"] b { color: var(--bst-alarm); }
        .tw3d-label[data-state="offline"] { border-color: var(--bst-offline); border-style: dashed; opacity: 0.8; }
        .tw3d-label[data-state="offline"] b { color: var(--bst-offline); }
        .tw3d-label[data-selected="true"] { outline: 1px dashed var(--bst-text); outline-offset: 2px; }
        .tw3d-axis { font-family: var(--bst-font-mono); font-size: 11px; color: var(--bst-text-mute); pointer-events: none; }
      `}</style>

      <div ref={mountRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', cursor: 'grab' }} />

      <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {(
          [
            ['iso', 'ИЗОМЕТРИЯ'],
            ['top', 'СВЕРХУ'],
            ['side', 'ФАСАД'],
          ] as const
        ).map(([view, label]) => (
          <button key={view} type="button" className="bst-btn bst-btn--sm" onClick={() => engineRef.current?.setView(view)}>
            {label}
          </button>
        ))}
        <button type="button" className={`bst-btn bst-btn--sm${autoRotate ? ' bst-btn--primary' : ''}`} onClick={() => setAutoRotate((v) => !v)} aria-pressed={autoRotate}>
          ВРАЩЕНИЕ
        </button>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 14,
          bottom: 14,
          padding: '8px 12px',
          border: '1px solid var(--bst-line-strong)',
          background: 'color-mix(in srgb, var(--bst-bg) 88%, transparent)',
          fontFamily: 'var(--bst-font-mono)',
          fontSize: 10.5,
          display: 'grid',
          gridTemplateColumns: 'auto auto',
          gap: '3px 16px',
          pointerEvents: 'none',
        }}
      >
        <span style={{ gridColumn: '1 / -1', color: 'var(--bst-text-mute)', letterSpacing: '0.1em', fontSize: 9.5 }}>УСЛОВНЫЕ ОБОЗНАЧЕНИЯ</span>
        <span style={{ color: 'var(--bst-ok)' }}>{GLYPH.ok} в допуске ({legend.ok})</span>
        <span style={{ color: 'var(--bst-alarm)' }}>{GLYPH.alarm} вне допуска ({legend.alarm})</span>
        <span style={{ color: 'var(--bst-warn)' }}>{GLYPH.warning} у границы ({legend.warning})</span>
        <span style={{ color: 'var(--bst-offline)' }}>{GLYPH.offline} нет связи ({legend.offline})</span>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 14,
          bottom: 14,
          textAlign: 'right',
          fontFamily: 'var(--bst-font-mono)',
          fontSize: 10,
          color: 'var(--bst-text-mute)',
          pointerEvents: 'none',
          lineHeight: 1.5,
        }}
      >
        ЛКМ — вращать · колесо — масштаб · ПКМ — сдвиг
        <br />
        {scale} · каркас 36 × 18 м
      </div>
    </div>
  );
}
