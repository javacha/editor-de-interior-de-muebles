import { useEffect, useMemo, useRef, useState } from 'react';
import type { Design } from '../lib/server/designs';

const disk = new URL('../styles/disk.png', import.meta.url).toString();

type Orientation = 'vertical' | 'horizontal';
type Rect = { x: number; y: number; w: number; h: number };
type Leaf = { type: 'leaf' };
type Split = { type: 'split'; id: string; orientation: Orientation; position: number; first: Node; second: Node };
type Node = Leaf | Split;
type Panel = { id: string; orientation: Orientation; rect: Rect; container: Rect; position: number };

const THICKNESS = 1.8;
const MIN_DIVISION_GAP = 5;
const BASE_ZOOM = 0.5;
const leaf: Leaf = { type: 'leaf' };
const round = (value: number) => Math.round(value * 10) / 10;
const cm = (value: number) => `${round(value).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} cm`;
const id = () => crypto.randomUUID();

function innerRect(design: Design): Rect {
  return { x: THICKNESS, y: THICKNESS, w: design.width - THICKNESS * 2, h: design.height - THICKNESS * 2 };
}

function splitRects(rect: Rect, orientation: Orientation, position: number): [Rect, Rect] {
  if (orientation === 'vertical') {
    return [
      { ...rect, w: position },
      { x: rect.x + position + THICKNESS, y: rect.y, w: rect.w - position - THICKNESS, h: rect.h },
    ];
  }
  return [
    { ...rect, h: position },
    { x: rect.x, y: rect.y + position + THICKNESS, w: rect.w, h: rect.h - position - THICKNESS },
  ];
}

function collectPanels(node: Node, rect: Rect, result: Panel[] = []): Panel[] {
  if (node.type === 'leaf') return result;
  const panelRect = node.orientation === 'vertical'
    ? { x: rect.x + node.position, y: rect.y, w: THICKNESS, h: rect.h }
    : { x: rect.x, y: rect.y + node.position, w: rect.w, h: THICKNESS };
  result.push({ id: node.id, orientation: node.orientation, rect: panelRect, container: rect, position: node.position });
  const [first, second] = splitRects(rect, node.orientation, node.position);
  collectPanels(node.first, first, result);
  collectPanels(node.second, second, result);
  return result;
}

function collectLeaves(node: Node, rect: Rect, result: Rect[] = []): Rect[] {
  if (node.type === 'leaf') { result.push(rect); return result; }
  const [first, second] = splitRects(rect, node.orientation, node.position);
  collectLeaves(node.first, first, result);
  collectLeaves(node.second, second, result);
  return result;
}

function addSplit(node: Node, rect: Rect, target: Rect, orientation: Orientation, position: number): Node {
  if (node.type === 'leaf') {
    const same = [rect.x, rect.y, rect.w, rect.h].every((v, index) => v === [target.x, target.y, target.w, target.h][index]);
    return same ? { type: 'split', id: id(), orientation, position, first: leaf, second: leaf } : node;
  }
  const [firstRect, secondRect] = splitRects(rect, node.orientation, node.position);
  return {
    ...node,
    first: addSplit(node.first, firstRect, target, orientation, position),
    second: addSplit(node.second, secondRect, target, orientation, position),
  };
}

function updateSplit(node: Node, splitId: string, position: number): Node {
  if (node.type === 'leaf') return node;
  if (node.id === splitId) return { ...node, position };
  return { ...node, first: updateSplit(node.first, splitId, position), second: updateSplit(node.second, splitId, position) };
}

function removeSplit(node: Node, splitId: string): Node {
  if (node.type === 'leaf') return node;
  if (node.id === splitId) return leaf;
  return { ...node, first: removeSplit(node.first, splitId), second: removeSplit(node.second, splitId) };
}

function pointIn(rect: Rect, point: { x: number; y: number }) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

function findLeaf(node: Node, rect: Rect, point: { x: number; y: number }): Rect | null {
  if (node.type === 'leaf') return pointIn(rect, point) ? rect : null;
  const [first, second] = splitRects(rect, node.orientation, node.position);
  return findLeaf(node.first, first, point) ?? findLeaf(node.second, second, point);
}

function overlapsOnCrossAxis(a: Panel, b: Panel) {
  if (a.orientation === 'vertical') return a.rect.y < b.rect.y + b.rect.h && b.rect.y < a.rect.y + a.rect.h;
  return a.rect.x < b.rect.x + b.rect.w && b.rect.x < a.rect.x + a.rect.w;
}

function validPosition(orientation: Orientation, target: Rect, proposed: number, panels: Panel[], ignoreId?: string, snapToGrid = true) {
  const max = (orientation === 'vertical' ? target.w : target.h) - THICKNESS;
  const candidate = Math.max(0, Math.min(max, snapToGrid ? Math.round(proposed) : proposed));
  const newRect = orientation === 'vertical'
    ? { x: target.x + candidate, y: target.y, w: THICKNESS, h: target.h }
    : { x: target.x, y: target.y + candidate, w: target.w, h: THICKNESS };
  const relevant = panels.filter((panel) => panel.id !== ignoreId && panel.orientation === orientation && overlapsOnCrossAxis({ ...panel, rect: newRect }, panel));
  for (const panel of relevant) {
    const start = orientation === 'vertical' ? newRect.x : newRect.y;
    const end = start + THICKNESS;
    const otherStart = orientation === 'vertical' ? panel.rect.x : panel.rect.y;
    const otherEnd = otherStart + THICKNESS;
    if (!(end + MIN_DIVISION_GAP <= otherStart || otherEnd + MIN_DIVISION_GAP <= start)) return null;
  }
  return candidate;
}

function nearestAlignmentPosition(orientation: Orientation, container: Rect, current: number, mode: 'left' | 'center' | 'right') {
  const total = orientation === 'vertical' ? container.w : container.h;
  const startGap = current;
  const endGap = total - THICKNESS - current;

  if (mode === 'left') return Math.round(startGap);
  if (mode === 'right') return total - THICKNESS - Math.round(endGap);
  return (total - THICKNESS) / 2;
}

function resolveAlignmentPosition(panel: Panel, proposed: number, mode: 'left' | 'center' | 'right') {
  const total = panel.orientation === 'vertical' ? panel.container.w : panel.container.h;
  const remainder = total - THICKNESS - proposed;
  if (mode === 'left') return Math.round(proposed);
  if (mode === 'right') return total - THICKNESS - Math.round(remainder);
  return (total - THICKNESS) / 2;
}

function Modal({ children }: { children: React.ReactNode }) { return <div className="modal-backdrop"><section className="modal-card">{children}</section></div>; }

function isDesign(value: unknown): value is Design {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Design>;
  return typeof item.name === 'string' && typeof item.width === 'number' && typeof item.height === 'number' && !!item.root && typeof item.root === 'object';
}

export default function FurnitureEditor() {
  const [design, setDesign] = useState<Design | null>(null);
  const [screen, setScreen] = useState<'home' | 'editor'>('home');
  const [showDimensions, setShowDimensions] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [tool, setTool] = useState<Orientation | 'erase' | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(BASE_ZOOM);
  const [showCreate, setShowCreate] = useState(false);
  const [saved, setSaved] = useState<Record<string, Design>>({});
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storageMessage, setStorageMessage] = useState('');
  const [importError, setImportError] = useState('');
  const [dragging, setDragging] = useState<string | null>(null);
  const [alignmentMode, setAlignmentMode] = useState<{ panelId: string; mode: 'left' | 'center' | 'right' } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => { void loadSaved(); }, []);
  const panels = useMemo(() => design ? collectPanels(design.root, innerRect(design)) : [], [design]);
  const leaves = useMemo(() => design ? collectLeaves(design.root, innerRect(design)) : [], [design]);
  const selectedPanel = useMemo(() => (selected ? panels.find((panel) => panel.id === selected) ?? null : null), [panels, selected]);
  const alignmentOptions = selectedPanel?.orientation === 'vertical'
    ? [
        { key: 'left' as const, label: 'Izq.' },
        { key: 'center' as const, label: 'Centro' },
        { key: 'right' as const, label: 'Der.' },
      ]
    : [
        { key: 'left' as const, label: 'Arriba' },
        { key: 'center' as const, label: 'Centro' },
        { key: 'right' as const, label: 'Abajo' },
      ];

  function alignSelected(mode: 'left' | 'center' | 'right') {
    if (!design || !selectedPanel) return;
    const proposed = nearestAlignmentPosition(selectedPanel.orientation, selectedPanel.container, selectedPanel.position, mode);
    const position = validPosition(selectedPanel.orientation, selectedPanel.container, proposed, panels, selectedPanel.id, false);
    if (position === null) return;
    setAlignmentMode({ panelId: selectedPanel.id, mode });
    setDesign({ ...design, root: updateSplit(design.root, selectedPanel.id, position) });
  }

  function create(form: HTMLFormElement) {
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const width = Number(data.get('width'));
    const height = Number(data.get('height'));
    if (!name || !Number.isFinite(width) || !Number.isFinite(height) || width <= THICKNESS * 2 || height <= THICKNESS * 2) return;
    setDesign({ version: 1, id: id(), name, width, height, root: leaf });
    setShowCreate(false); setSelected(null); setZoom(BASE_ZOOM); setScreen('editor');
  }

  function svgPoint(event: React.PointerEvent | React.DragEvent) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
    const transformed = point.matrixTransform(svg.getScreenCTM()?.inverse());
    return { x: transformed.x, y: transformed.y };
  }

  function addAt(orientation: Orientation, point: { x: number; y: number }) {
    if (!design) return;
    const rootRect = innerRect(design);
    const target = findLeaf(design.root, rootRect, point);
    if (!target) return;
    const available = orientation === 'vertical' ? target.w : target.h;
    const position = validPosition(orientation, target, (available - THICKNESS) / 2, panels);
    if (position === null) return;
    setDesign({ ...design, root: addSplit(design.root, rootRect, target, orientation, position) });
  }

  async function loadSaved() {
    setLoadingProjects(true);
    try {
      const response = await fetch('/api/designs');
      if (!response.ok) throw new Error('No se pudieron cargar los proyectos.');
      const data = await response.json() as { designs: Design[] };
      setSaved(Object.fromEntries(data.designs.map((item) => [item.id, item])));
      setStorageMessage('');
    } catch {
      setStorageMessage('No se pudieron cargar los proyectos del servidor. Verificá la conexión y la configuración de Vercel Blob.');
    } finally {
      setLoadingProjects(false);
    }
  }

  async function save() {
    if (!design) return;
    setSaving(true);
    try {
      const response = await fetch('/api/designs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(design),
      });
      if (!response.ok) throw new Error('No se pudo guardar el proyecto.');
      const data = await response.json() as { design: Design };
      setSaved((current) => ({ ...current, [data.design.id]: data.design }));
      setStorageMessage('Proyecto guardado en el servidor.');
    } catch {
      setStorageMessage('No se pudo guardar el proyecto. Verificá la conexión y la configuración de Vercel Blob.');
    } finally {
      setSaving(false);
    }
  }

  function exportJson(item = design) {
    if (!item) return;
    const blob = new Blob([JSON.stringify(item, null, 2)], { type: 'application/json' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
    link.download = `${item.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-') || 'mueble'}.json`;
    link.click(); URL.revokeObjectURL(link.href);
  }

  function openProject(item: Design) {
    setDesign(item); setScreen('editor'); setSelected(null); setZoom(BASE_ZOOM); setTool(null);
  }

  function leaveEditor() {
    if (!design) {
      void loadSaved();
      setScreen('home');
      return;
    }
    const savedVersion = saved[design.id];
    const hasUnsavedChanges = !savedVersion || JSON.stringify(savedVersion) !== JSON.stringify(design);
    if (!hasUnsavedChanges) {
      void loadSaved();
      setScreen('home');
      return;
    }
    const shouldLeave = window.confirm('Tienes cambios sin guardar. ¿Seguro que querés salir del editor?');
    if (!shouldLeave) return;
    void loadSaved();
    setScreen('home');
  }

  async function importProject(file?: File) {
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isDesign(parsed) || parsed.width <= THICKNESS * 2 || parsed.height <= THICKNESS * 2) throw new Error();
      const validId = typeof parsed.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.id);
      openProject({ ...parsed, version: 1, id: validId ? parsed.id : id() });
      setImportError('');
    } catch { setImportError('El archivo no contiene un proyecto válido.'); }
  }

  async function deleteProject(projectId: string) {
    const item = saved[projectId];
    if (!item || !window.confirm(`¿Eliminar “${item.name}”?`)) return;
    try {
      const response = await fetch(`/api/designs/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('No se pudo eliminar el proyecto.');
      setSaved((current) => {
        const next = { ...current };
        delete next[projectId];
        return next;
      });
      setStorageMessage('Proyecto eliminado del servidor.');
    } catch {
      setStorageMessage('No se pudo eliminar el proyecto del servidor.');
    }
  }

  async function renameProject(projectId: string) {
    const item = saved[projectId];
    if (!item) return;
    const name = window.prompt('Nuevo nombre del mueble:', item.name)?.trim();
    if (!name) return;
    const renamed = { ...item, name };
    try {
      const response = await fetch('/api/designs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(renamed),
      });
      if (!response.ok) throw new Error('No se pudo renombrar el proyecto.');
      setSaved((current) => ({ ...current, [projectId]: renamed }));
      setStorageMessage('Nombre actualizado en el servidor.');
      if (design?.id === projectId) setDesign(renamed);
    } catch {
      setStorageMessage('No se pudo renombrar el proyecto en el servidor.');
    }
  }

  // El zoom se ancla al margen superior: alejar la vista no desplaza el mueble hacia abajo.
  const pad = 10;
  const viewBox = design ? `${design.width / 2 - (design.width + pad * 2) / (2 * zoom)} ${-pad} ${(design.width + pad * 2) / zoom} ${(design.height + pad * 2) / zoom}` : '0 0 100 70';
  const zoomPercent = Math.round((zoom / BASE_ZOOM) * 100);

  if (screen === 'home') return <main className="project-home">
    <header className="home-header"><div className="brand"><span className="brand-mark">▦</span><div><strong>diseño de interiores</strong><small>de muebles</small></div></div></header>
    <section className="home-content">
      <div className="home-intro"><p className="eyebrow">Tus diseños</p><h1>Proyectos de muebles</h1><p>Creá un diseño nuevo, importá una definición JSON o continuá trabajando sobre uno guardado.</p></div>
      <div className="home-actions">
        <button className="home-primary" onClick={() => setShowCreate(true)}><span>＋</span> Nuevo proyecto</button>
        <label className="home-secondary"><span>↑</span> Cargar desde JSON<input type="file" accept="application/json,.json" onChange={(event) => { void importProject(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>
      </div>
      {importError && <p className="import-error">{importError}</p>}
      {storageMessage && <p className="import-error" role="status">{storageMessage}</p>}
      <section className="projects-section"><div className="projects-heading"><h2>Guardados en el servidor</h2><span>{Object.keys(saved).length}</span></div>
        {loadingProjects ? <div className="empty-projects"><p>Cargando proyectos…</p></div> : Object.values(saved).length ? <div className="project-list">{Object.values(saved).map((item) => <article className="project-card" key={item.id}>
          <div><h3>{item.name}</h3></div>
          <div className="project-card-actions"><button className="open-project" onClick={() => openProject(item)}>Abrir</button><button onClick={() => void renameProject(item.id)}>Renombrar</button><button onClick={() => exportJson(item)}>JSON</button><button className="delete-project" onClick={() => void deleteProject(item.id)}>Eliminar</button></div>
        </article>)}</div> : <div className="empty-projects"><span>▦</span><p>No hay proyectos guardados todavía.</p><small>Al guardar un mueble, aparecerá en esta lista.</small></div>}
      </section>
    </section>
    {showCreate && <Modal><div className="modal-heading"><span className="brand-mark">▦</span><div><p>Nuevo proyecto</p><h2>Crear un mueble</h2></div></div><form onSubmit={(e) => { e.preventDefault(); create(e.currentTarget); }}><label>Nombre del mueble<input name="name" required placeholder="Ej. Biblioteca living" /></label><div className="form-grid"><label>Ancho exterior (cm)<input name="width" required type="number" min="4" step="0.1" placeholder="120" /></label><label>Alto exterior (cm)<input name="height" required type="number" min="4" step="0.1" placeholder="180" /></label></div><p className="form-note">Todas las piezas tienen un espesor de 1,8 cm.</p><div className="modal-actions"><button type="button" className="secondary" onClick={() => setShowCreate(false)}>Cancelar</button><button type="submit">Crear editor</button></div></form></Modal>}
  </main>;

  return <>
    {design && <header className="editor-header">
      <div className="editor-header-brand">
        <button className="brand brand-home" onClick={leaveEditor} title="Ir a proyectos"><span className="brand-mark">▦</span><span><strong>editor</strong><small>de interiores</small></span></button>
      </div>
      <div className="editor-header-main">
        <p>Diseño actual</p>
        <div className="project-title-row"><h1>{design.name}</h1><button className="header-save" onClick={() => void save()} disabled={saving} title={saving ? 'Guardando proyecto' : 'Guardar proyecto'} aria-label="Guardar proyecto"><img src={disk} alt="Guardar proyecto" /></button></div>
      </div>
      <div className="header-controls"><span>{cm(design.width)} ancho × {cm(design.height)} alto</span></div>
    </header>}

    {storageMessage && <p className="import-error" role="status">{storageMessage}</p>}
    <div className="editor-shell">
      <aside className={`toolbar ${collapsed ? 'collapsed' : ''}`}>
        <button className="icon-button collapse" onClick={() => setCollapsed(!collapsed)} aria-label="Contraer panel">{collapsed ? '›' : '‹'}</button>
        {collapsed ? <div className="toolbar-collapsed">
          <button draggable className={`tool-button icon-only ${tool === 'vertical' ? 'active' : ''}`} onClick={() => setTool(tool === 'vertical' ? null : 'vertical')} onDragStart={(e) => { e.dataTransfer.setData('orientation', 'vertical'); setTool('vertical'); }} title="Agregar división vertical" aria-label="Agregar división vertical"><span className="vertical-icon" /></button>
          <button draggable className={`tool-button icon-only ${tool === 'horizontal' ? 'active' : ''}`} onClick={() => setTool(tool === 'horizontal' ? null : 'horizontal')} onDragStart={(e) => { e.dataTransfer.setData('orientation', 'horizontal'); setTool('horizontal'); }} title="Agregar división horizontal" aria-label="Agregar división horizontal"><span className="horizontal-icon" /></button>
          <button className={`action-button danger icon-only ${tool === 'erase' ? 'active' : ''}`} onClick={() => setTool(tool === 'erase' ? null : 'erase')} title="Borrar división" aria-label="Borrar división">⌫</button>
        </div> : <>
          <div className="tool-section"><p className="section-label">Agregar división</p>
            <div className="compact-grid">
              <button draggable className={`tool-button ${tool === 'vertical' ? 'active' : ''}`} onClick={() => setTool(tool === 'vertical' ? null : 'vertical')} onDragStart={(e) => { e.dataTransfer.setData('orientation', 'vertical'); setTool('vertical'); }}><span className="vertical-icon" />Vertical</button>
              <button draggable className={`tool-button ${tool === 'horizontal' ? 'active' : ''}`} onClick={() => setTool(tool === 'horizontal' ? null : 'horizontal')} onDragStart={(e) => { e.dataTransfer.setData('orientation', 'horizontal'); setTool('horizontal'); }}><span className="horizontal-icon" />Horizontal</button>
              <button className={`action-button danger ${tool === 'erase' ? 'active' : ''}`} onClick={() => setTool(tool === 'erase' ? null : 'erase')}>{tool === 'erase' ? 'Activo' : 'Borrar'}</button>
            </div>
          </div>
          <div className="tool-section"><p className="section-label">Alineación</p>
            <div className="alignment-grid">
              {alignmentOptions.map((option) => <button
                key={option.key}
                type="button"
                className="alignment-button"
                onClick={() => alignSelected(option.key)}
                disabled={!selectedPanel}
              >{option.label}</button>)}
            </div>
          </div>
          <div className="tool-section"><p className="section-label">Vista</p>
            <label className="toggle-row"><input type="checkbox" checked={showDimensions} onChange={(e) => setShowDimensions(e.target.checked)} /><span>Mostrar dimensiones</span></label>
            <div className="zoom-row"><button onClick={() => setZoom((value) => Math.max(.2, Number((value - .05).toFixed(2))))}>−</button><span>{zoomPercent}%</span><button onClick={() => setZoom((value) => Math.min(2.5, Number((value + .05).toFixed(2))))}>+</button></div>
          </div>
        </>}
      </aside>
      <section className="workspace">
        <svg ref={svgRef} className="canvas" viewBox={viewBox} preserveAspectRatio="xMidYMin meet" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const orientation = e.dataTransfer.getData('orientation') as Orientation; if (orientation) addAt(orientation, svgPoint(e)); }} onPointerMove={(e) => {
          if (!design || !dragging) return; const panel = panels.find((item) => item.id === dragging); if (!panel) return;
          const point = svgPoint(e); const proposed = panel.orientation === 'vertical' ? point.x - panel.container.x - THICKNESS / 2 : point.y - panel.container.y - THICKNESS / 2;
          const alignedMode = alignmentMode?.panelId === panel.id ? alignmentMode.mode : null;
          const position = alignedMode
            ? validPosition(panel.orientation, panel.container, resolveAlignmentPosition(panel, proposed, alignedMode), panels, panel.id, false)
            : validPosition(panel.orientation, panel.container, proposed, panels, panel.id);
          if (position !== null) setDesign({ ...design, root: updateSplit(design.root, panel.id, position) });
        }} onPointerUp={() => setDragging(null)}>
          {!design ? <text x="50" y="35" textAnchor="middle" className="empty-svg">Creá un mueble para comenzar</text> : <>
            <rect x="0" y="0" width={design.width} height={design.height} rx=".5" className="outer-panel" />
            <rect x={THICKNESS} y={THICKNESS} width={design.width - THICKNESS * 2} height={design.height - THICKNESS * 2} className="interior" />
            {leaves.map((rect, index) => showDimensions && rect.w > 7 && rect.h > 5 && <text key={`space-${index}`} x={rect.x + rect.w / 2} y={rect.y + rect.h / 2} textAnchor="middle" className="space-label">
              <tspan x={rect.x + rect.w / 2} dy="-.55em">{cm(rect.w)}</tspan>
              <tspan x={rect.x + rect.w / 2} dy="1.2em">{cm(rect.h)}</tspan>
            </text>)}
            {panels.map((panel) => <rect key={panel.id} x={panel.rect.x} y={panel.rect.y} width={panel.rect.w} height={panel.rect.h} className={`division ${selected === panel.id ? 'selected' : ''} ${tool === 'erase' ? 'erasable' : ''}`} onPointerDown={(e) => { e.stopPropagation(); setSelected(panel.id); if (tool === 'erase') setDesign({ ...design, root: removeSplit(design.root, panel.id) }); else { setDragging(panel.id); e.currentTarget.setPointerCapture(e.pointerId); } }} />)}
            {showDimensions && <g className="outer-dimension"><line x1="0" y1={-pad / 3} x2={design.width} y2={-pad / 3} /><text x={design.width / 2} y={-pad / 3 - 1.3} textAnchor="middle">{cm(design.width)}</text><line x1={-pad / 3} y1="0" x2={-pad / 3} y2={design.height} /><text x={-pad / 3 - 1.3} y={design.height / 2} textAnchor="middle" transform={`rotate(-90 ${-pad / 3 - 1.3} ${design.height / 2})`}>{cm(design.height)}</text></g>}
          </>}
        </svg>
        {tool === 'vertical' || tool === 'horizontal' ? <div className="canvas-tip">Soltá una división {tool} dentro de un hueco</div> : null}
      </section>
      {showCreate && <Modal><div className="modal-heading"><span className="brand-mark">▦</span><div><p>Nuevo proyecto</p><h2>Crear un mueble</h2></div></div><form onSubmit={(e) => { e.preventDefault(); create(e.currentTarget); }}><label>Nombre del mueble<input name="name" required placeholder="Ej. Biblioteca living" defaultValue={design?.name || ''} /></label><div className="form-grid"><label>Ancho exterior (cm)<input name="width" required type="number" min="4" step="0.1" placeholder="120" defaultValue={design?.width} /></label><label>Alto exterior (cm)<input name="height" required type="number" min="4" step="0.1" placeholder="180" defaultValue={design?.height} /></label></div><p className="form-note">Todas las piezas tienen un espesor de 1,8 cm.</p><div className="modal-actions">{design && <button type="button" className="secondary" onClick={() => setShowCreate(false)}>Cancelar</button>}<button type="submit">Crear editor</button></div></form></Modal>}
    </div>
  </>;
}
