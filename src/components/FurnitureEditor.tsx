import { useEffect, useMemo, useRef, useState } from 'react';

type Orientation = 'vertical' | 'horizontal';
type Rect = { x: number; y: number; w: number; h: number };
type Leaf = { type: 'leaf' };
type Split = { type: 'split'; id: string; orientation: Orientation; position: number; first: Node; second: Node };
type Node = Leaf | Split;
type Design = { version: 1; id: string; name: string; width: number; height: number; root: Node };
type Panel = { id: string; orientation: Orientation; rect: Rect; container: Rect; position: number };

const THICKNESS = 1.8;
const MIN_DIVISION_GAP = 5;
const STORAGE_KEY = 'editor-de-muebles.designs.v1';
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

function validPosition(orientation: Orientation, target: Rect, proposed: number, panels: Panel[], ignoreId?: string) {
  const max = (orientation === 'vertical' ? target.w : target.h) - THICKNESS;
  let candidate = Math.max(0, Math.min(max, Math.round(proposed)));
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

function readSaved(): Record<string, Design> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

function Modal({ children }: { children: React.ReactNode }) { return <div className="modal-backdrop"><section className="modal-card">{children}</section></div>; }

export default function FurnitureEditor() {
  const [design, setDesign] = useState<Design | null>(null);
  const [showDimensions, setShowDimensions] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [tool, setTool] = useState<Orientation | 'erase' | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showCreate, setShowCreate] = useState(true);
  const [showLoad, setShowLoad] = useState(false);
  const [saved, setSaved] = useState<Record<string, Design>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => setSaved(readSaved()), []);
  const panels = useMemo(() => design ? collectPanels(design.root, innerRect(design)) : [], [design]);
  const leaves = useMemo(() => design ? collectLeaves(design.root, innerRect(design)) : [], [design]);

  function create(form: HTMLFormElement) {
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const width = Number(data.get('width'));
    const height = Number(data.get('height'));
    if (!name || !Number.isFinite(width) || !Number.isFinite(height) || width <= THICKNESS * 2 || height <= THICKNESS * 2) return;
    setDesign({ version: 1, id: id(), name, width, height, root: leaf });
    setShowCreate(false); setSelected(null); setZoom(1);
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

  function save() {
    if (!design) return;
    const next = { ...readSaved(), [design.id]: design };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setSaved(next);
  }

  function exportJson() {
    if (!design) return;
    const blob = new Blob([JSON.stringify(design, null, 2)], { type: 'application/json' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
    link.download = `${design.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-') || 'mueble'}.json`;
    link.click(); URL.revokeObjectURL(link.href);
  }

  // El zoom se ancla al margen superior: alejar la vista no desplaza el mueble hacia abajo.
  const pad = 10;
  const viewBox = design ? `${design.width / 2 - (design.width + pad * 2) / (2 * zoom)} ${-pad} ${(design.width + pad * 2) / zoom} ${(design.height + pad * 2) / zoom}` : '0 0 100 70';

  return <div className="editor-shell">
    <aside className={`toolbar ${collapsed ? 'collapsed' : ''}`}>
      <button className="icon-button collapse" onClick={() => setCollapsed(!collapsed)} aria-label="Contraer panel">{collapsed ? '›' : '‹'}</button>
      {!collapsed && <>
        <div className="brand"><span className="brand-mark">▦</span><div><strong>editor</strong><small>de muebles</small></div></div>
        <div className="tool-section"><p className="section-label">Agregar división</p>
          <div className="compact-grid">
            <button draggable className={`tool-button ${tool === 'vertical' ? 'active' : ''}`} onClick={() => setTool(tool === 'vertical' ? null : 'vertical')} onDragStart={(e) => { e.dataTransfer.setData('orientation', 'vertical'); setTool('vertical'); }}><span className="vertical-icon" />Vertical</button>
            <button draggable className={`tool-button ${tool === 'horizontal' ? 'active' : ''}`} onClick={() => setTool(tool === 'horizontal' ? null : 'horizontal')} onDragStart={(e) => { e.dataTransfer.setData('orientation', 'horizontal'); setTool('horizontal'); }}><span className="horizontal-icon" />Horizontal</button>
          </div>
          <p className="hint">Arrastrá una división al hueco deseado.</p>
        </div>
        <div className="tool-section"><p className="section-label">Vista</p>
          <label className="toggle-row"><input type="checkbox" checked={showDimensions} onChange={(e) => setShowDimensions(e.target.checked)} /><span>Mostrar cotas</span></label>
          <div className="zoom-row"><button onClick={() => setZoom((value) => Math.max(.5, round(value - .1)))}>−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom((value) => Math.min(2.5, round(value + .1)))}>+</button></div>
        </div>
        <div className="tool-section"><p className="section-label">Acciones</p>
          <div className="compact-grid action-grid">
            <button className={`action-button danger ${tool === 'erase' ? 'active' : ''}`} onClick={() => setTool(tool === 'erase' ? null : 'erase')}>⌫ {tool === 'erase' ? 'Activo' : 'Borrar'}</button>
            <button className="action-button" onClick={save} disabled={!design}>Guardar</button>
            <button className="action-button" onClick={() => { setSaved(readSaved()); setShowLoad(true); }}>Cargar</button>
            <button className="action-button" onClick={exportJson} disabled={!design}>Exportar JSON</button>
            <button className="action-button ghost" onClick={() => setShowCreate(true)}>Nuevo</button>
          </div>
        </div>
      </>}
    </aside>
    <section className="workspace">
      {design && <header className="workspace-header"><div><p>Diseño actual</p><h1>{design.name}</h1></div><span>{cm(design.width)} × {cm(design.height)}</span></header>}
      <svg ref={svgRef} className="canvas" viewBox={viewBox} preserveAspectRatio="xMidYMin meet" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const orientation = e.dataTransfer.getData('orientation') as Orientation; if (orientation) addAt(orientation, svgPoint(e)); }} onPointerMove={(e) => {
        if (!design || !dragging) return; const panel = panels.find((item) => item.id === dragging); if (!panel) return;
        const point = svgPoint(e); const proposed = panel.orientation === 'vertical' ? point.x - panel.container.x - THICKNESS / 2 : point.y - panel.container.y - THICKNESS / 2;
        const position = validPosition(panel.orientation, panel.container, proposed, panels, panel.id);
        if (position !== null) setDesign({ ...design, root: updateSplit(design.root, panel.id, position) });
      }} onPointerUp={() => setDragging(null)}>
        {!design ? <text x="50" y="35" textAnchor="middle" className="empty-svg">Creá un mueble para comenzar</text> : <>
          <rect x="0" y="0" width={design.width} height={design.height} rx=".5" className="outer-panel" />
          <rect x={THICKNESS} y={THICKNESS} width={design.width - THICKNESS * 2} height={design.height - THICKNESS * 2} className="interior" />
          {leaves.map((rect, index) => showDimensions && rect.w > 7 && rect.h > 5 && <text key={`space-${index}`} x={rect.x + rect.w / 2} y={rect.y + rect.h / 2} textAnchor="middle" className="space-label">{cm(rect.w)} × {cm(rect.h)}</text>)}
          {panels.map((panel) => <rect key={panel.id} x={panel.rect.x} y={panel.rect.y} width={panel.rect.w} height={panel.rect.h} className={`division ${selected === panel.id ? 'selected' : ''} ${tool === 'erase' ? 'erasable' : ''}`} onPointerDown={(e) => { e.stopPropagation(); setSelected(panel.id); if (tool === 'erase') setDesign({ ...design, root: removeSplit(design.root, panel.id) }); else { setDragging(panel.id); e.currentTarget.setPointerCapture(e.pointerId); } }} />)}
          {showDimensions && <g className="outer-dimension"><line x1="0" y1={-pad / 3} x2={design.width} y2={-pad / 3} /><text x={design.width / 2} y={-pad / 3 - 1.3} textAnchor="middle">{cm(design.width)}</text><line x1={-pad / 3} y1="0" x2={-pad / 3} y2={design.height} /><text x={-pad / 3 - 1.3} y={design.height / 2} textAnchor="middle" transform={`rotate(-90 ${-pad / 3 - 1.3} ${design.height / 2})`}>{cm(design.height)}</text></g>}
        </>}
      </svg>
      {tool === 'vertical' || tool === 'horizontal' ? <div className="canvas-tip">Soltá una división {tool} dentro de un hueco</div> : null}
    </section>
    {showCreate && <Modal><div className="modal-heading"><span className="brand-mark">▦</span><div><p>Nuevo proyecto</p><h2>Crear un mueble</h2></div></div><form onSubmit={(e) => { e.preventDefault(); create(e.currentTarget); }}><label>Nombre del mueble<input name="name" required placeholder="Ej. Biblioteca living" defaultValue={design?.name || ''} /></label><div className="form-grid"><label>Ancho exterior (cm)<input name="width" required type="number" min="4" step="0.1" placeholder="120" defaultValue={design?.width} /></label><label>Alto exterior (cm)<input name="height" required type="number" min="4" step="0.1" placeholder="180" defaultValue={design?.height} /></label></div><p className="form-note">Todas las piezas tienen un espesor de 1,8 cm.</p><div className="modal-actions">{design && <button type="button" className="secondary" onClick={() => setShowCreate(false)}>Cancelar</button>}<button type="submit">Crear editor</button></div></form></Modal>}
    {showLoad && <Modal><div className="modal-heading"><div><p>Diseños guardados</p><h2>Cargar un mueble</h2></div></div><div className="saved-list">{Object.values(saved).length ? Object.values(saved).map((item) => <button key={item.id} onClick={() => { setDesign(item); setShowLoad(false); setSelected(null); setZoom(1); }}><strong>{item.name}</strong><span>{cm(item.width)} × {cm(item.height)}</span></button>) : <p className="empty-list">Todavía no hay muebles guardados en este navegador.</p>}</div><div className="modal-actions"><button className="secondary" onClick={() => setShowLoad(false)}>Cerrar</button></div></Modal>}
  </div>;
}
