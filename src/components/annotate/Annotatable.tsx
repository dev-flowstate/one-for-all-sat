import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { COLORS, HIGHLIGHTER, getDoodle, saveDoodle, type DoodleColor, type DoodleTool, type Stroke } from '../../lib/doodles';

/** Drawing units across the content's width; a stroke's coordinates and width are in these. */
const UNITS = 1000;
/** A point closer than this to the last one adds nothing visible. */
const MIN_STEP = 2;
const HIGHLIGHTER_PX = 18;

interface AnnotatableProps {
  /** What the drawing is saved under: a question's id, or a book chapter. */
  id: string;
  /** The highlighter is offered only where asked for; the pen always is. */
  highlighter?: boolean;
  /** Keeps the tools in view while a long page scrolls (a book chapter). */
  stickyToolbar?: string;
  children: ReactNode;
}

function pathOf(points: number[]): string {
  if (points.length < 2) return '';
  let d = `M${points[0]} ${points[1]}`;
  // A single tap still leaves a dot.
  if (points.length === 2) d += `l0.1 0`;
  for (let i = 2; i < points.length; i += 2) d += `L${points[i]} ${points[i + 1]}`;
  return d;
}

/**
 * Content that can be written on with a pen or highlighter. Drawings are vector strokes laid
 * over the content, scaled to its width, and kept only when "Save doodle" is pressed; a saved
 * one shows again whenever the same question or chapter is opened.
 */
export function Annotatable({ id, highlighter = false, stickyToolbar, children }: AnnotatableProps) {
  const [active, setActive] = useState(false);
  const [tool, setTool] = useState<DoodleTool>('pen');
  const [color, setColor] = useState<DoodleColor>('ink');
  const [widthPx, setWidthPx] = useState(3);
  const [strokes, setStrokes] = useState<Stroke[]>(() => getDoodle(id));
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const box = useRef<HTMLDivElement>(null);
  /** The stroke being drawn, until the pen lifts. */
  const [drawing, setDrawing] = useState<Stroke | null>(null);

  // Another question or chapter: its own saved drawing instead.
  const [shownFor, setShownFor] = useState(id);
  if (shownFor !== id) {
    setShownFor(id);
    setStrokes(getDoodle(id));
    setDrawing(null);
    setDirty(false);
    setNotice(null);
  }

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ w: el.offsetWidth || 1, h: el.offsetHeight || 1 });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = UNITS / size.w;

  function point(e: React.PointerEvent): [number, number] {
    const rect = box.current!.getBoundingClientRect();
    return [Math.round((e.clientX - rect.left) * scale), Math.round((e.clientY - rect.top) * scale)];
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!active || e.button > 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x, y] = point(e);
    setDrawing({
      tool,
      color,
      width: Math.max(1, Math.round((tool === 'highlighter' ? HIGHLIGHTER_PX : widthPx) * scale)),
      points: [x, y],
    });
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!drawing) return;
    const [x, y] = point(e);
    const n = drawing.points.length;
    if (Math.hypot(x - drawing.points[n - 2], y - drawing.points[n - 1]) < MIN_STEP) return;
    setDrawing({ ...drawing, points: [...drawing.points, x, y] });
  }

  function onPointerUp() {
    if (!drawing) return;
    const stroke = drawing;
    setDrawing(null);
    setStrokes((s) => [...s, stroke]);
    setDirty(true);
    setNotice(null);
  }

  function save() {
    if (saveDoodle(id, strokes)) {
      setDirty(false);
      setNotice(strokes.length ? 'Saved' : 'Cleared');
    } else {
      setNotice("Couldn't save: this browser's storage is full");
    }
  }

  const all = drawing ? [...strokes, drawing] : strokes;
  const toolButton = (value: DoodleTool, label: string) => (
    <button
      type="button"
      aria-pressed={tool === value}
      onClick={() => setTool(value)}
      className={`border-2 border-ink px-2 py-1 font-mono text-[11px] font-bold uppercase ${
        tool === value ? 'bg-venice-blue text-merino' : 'bg-paper hover:bg-merino-dark'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div
        className={`mb-3 flex flex-wrap items-center gap-2 border-2 border-ink bg-merino-dark px-2 py-1.5 ${
          stickyToolbar ? `sticky z-10 ${stickyToolbar}` : ''
        }`}
      >
        <button
          type="button"
          aria-pressed={active}
          onClick={() => setActive((v) => !v)}
          className={`press border-2 border-ink px-2.5 py-1 font-mono text-[11px] font-bold tracking-tight uppercase ${
            active ? 'bg-coral text-paper' : 'bg-paper hover:bg-merino'
          }`}
        >
          {active ? '✎ Drawing: on' : '✎ Annotate'}
        </button>

        {active && (
          <>
            {highlighter && (
              <div className="flex" role="group" aria-label="Tool">
                {toolButton('pen', 'Pen')}
                {toolButton('highlighter', 'Highlighter')}
              </div>
            )}
            {tool === 'pen' && (
              <>
                <div className="flex gap-1" role="radiogroup" aria-label="Pen colour">
                  {(Object.keys(COLORS) as DoodleColor[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={color === c}
                      aria-label={c === 'ink' ? 'Black' : c === 'red' ? 'Red' : 'Blue'}
                      onClick={() => setColor(c)}
                      className={`h-6 w-6 border-2 border-ink ${color === c ? 'outline-2 outline-offset-1 outline-coral' : ''}`}
                      style={{ background: COLORS[c] }}
                    />
                  ))}
                </div>
                <label className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase">
                  Width
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={widthPx}
                    onChange={(e) => setWidthPx(Number(e.target.value))}
                    className="w-20 accent-venice-blue"
                  />
                  <span className="w-4 tabular-nums">{widthPx}</span>
                </label>
              </>
            )}
            <button
              type="button"
              disabled={strokes.length === 0}
              onClick={() => {
                setStrokes((s) => s.slice(0, -1));
                setDirty(true);
              }}
              className="border-2 border-ink bg-paper px-2 py-1 font-mono text-[11px] font-bold uppercase disabled:opacity-40"
            >
              Undo
            </button>
            <button
              type="button"
              disabled={strokes.length === 0}
              onClick={() => {
                setStrokes([]);
                setDirty(true);
              }}
              className="border-2 border-ink bg-paper px-2 py-1 font-mono text-[11px] font-bold uppercase disabled:opacity-40"
            >
              Clear
            </button>
          </>
        )}

        {(active || dirty) && (
          <button
            type="button"
            disabled={!dirty}
            onClick={save}
            className="press ml-auto border-2 border-ink bg-venice-blue px-2.5 py-1 font-mono text-[11px] font-bold tracking-tight text-merino uppercase disabled:opacity-40"
          >
            Save doodle
          </button>
        )}
        {(dirty || notice) && (
          <span className={`font-mono text-[11px] font-semibold uppercase ${dirty ? 'text-danger' : 'text-success'}`}>
            {dirty ? 'Unsaved' : notice}
          </span>
        )}
      </div>

      <div ref={box} className="relative">
        {children}
        <svg
          aria-hidden={!active}
          aria-label={active ? 'Drawing area' : undefined}
          className={`absolute inset-0 h-full w-full ${active ? 'cursor-crosshair' : ''}`}
          style={{ pointerEvents: active ? 'auto' : 'none', touchAction: active ? 'none' : 'auto' }}
          viewBox={`0 0 ${UNITS} ${size.h * scale}`}
          preserveAspectRatio="xMinYMin meet"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {all.map((s, i) => (
            <path
              key={i}
              d={pathOf(s.points)}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={s.width}
              style={
                s.tool === 'highlighter'
                  ? { stroke: HIGHLIGHTER.color, opacity: HIGHLIGHTER.opacity }
                  : { stroke: COLORS[s.color] }
              }
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
