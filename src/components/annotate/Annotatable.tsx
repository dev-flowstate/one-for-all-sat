import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { COLORS, HIGHLIGHTER, getDoodle, saveDoodle, type DoodleColor, type Stroke } from '../../lib/doodles';

/** Drawing units across the content's width; a stroke's coordinates and width are in these. */
const UNITS = 1000;
/** A point closer than this to the last one adds nothing visible. */
const MIN_STEP = 2;
/** Remembered once a stylus is seen, so on that device a finger scrolls instead of drawing. */
const STYLUS_KEY = 'ofa-sat:stylus';

function stylusSeen(): boolean {
  try {
    return localStorage.getItem(STYLUS_KEY) === '1';
  } catch {
    return false;
  }
}

/** The text highlighter, where the content offers one: it marks selected text, kept by the page. */
export interface TextHighlighter {
  count: number;
  undo: () => void;
  clear: () => void;
}

interface AnnotatableProps {
  /** What the drawing is saved under: a question's id, or a book chapter. */
  id: string;
  highlighter?: TextHighlighter;
  /** Keeps the tools in view while a long page scrolls. */
  stickyToolbar?: string;
  /** Told whether the highlighter is in use, so the content can take text selections. */
  children: ReactNode | ((state: { highlighting: boolean }) => ReactNode);
}

function pathOf(points: number[]): string {
  if (points.length < 2) return '';
  let d = `M${points[0]} ${points[1]}`;
  // A single tap still leaves a dot.
  if (points.length === 2) d += `l0.1 0`;
  for (let i = 2; i < points.length; i += 2) d += `L${points[i]} ${points[i + 1]}`;
  return d;
}

const smallButton = 'border-2 border-ink bg-paper px-2 py-1 font-mono text-[11px] font-bold uppercase disabled:opacity-40';

/**
 * Content that can be written on with a pen, and, where offered, text that can be highlighted.
 * Pen drawings are vector strokes over the content, scaled to its width, kept when "Save
 * doodle" is pressed and shown again whenever the same question or chapter is opened.
 *
 * Fingers and pens: one finger draws and two fingers scroll, so a phone can do both. Once a
 * stylus has been used on a device (an iPad with an Apple Pencil, say), the stylus draws and a
 * finger scrolls, as in a notes app.
 */
export function Annotatable({ id, highlighter, stickyToolbar, children }: AnnotatableProps) {
  const [active, setActive] = useState(false);
  const [tool, setTool] = useState<'pen' | 'highlighter'>('pen');
  const [color, setColor] = useState<DoodleColor>('ink');
  const [widthPx, setWidthPx] = useState(3);
  const [strokes, setStrokes] = useState<Stroke[]>(() => getDoodle(id));
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const box = useRef<HTMLDivElement>(null);
  /** The stroke being drawn, until the pen lifts. */
  const [drawing, setDrawing] = useState<Stroke | null>(null);
  const drawingPointer = useRef<number | null>(null);
  /** Fingers on the screen, by pointer id, with where each last was. */
  const touches = useRef(new Map<number, number>());
  /** The finger whose movement scrolls the page, while scrolling. */
  const scroller = useRef<number | null>(null);
  const [stylus, setStylus] = useState(stylusSeen);

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
  const highlighting = active && tool === 'highlighter' && !!highlighter;
  const penOn = active && !highlighting;

  function point(e: React.PointerEvent): [number, number] {
    const rect = box.current!.getBoundingClientRect();
    return [Math.round((e.clientX - rect.left) * scale), Math.round((e.clientY - rect.top) * scale)];
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!penOn || e.button > 0) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // A pointer the browser no longer tracks; the stroke still draws while it's over the page.
    }
    if (e.pointerType === 'pen' && !stylus) {
      setStylus(true);
      try {
        localStorage.setItem(STYLUS_KEY, '1');
      } catch {
        // Then it's learned again next visit.
      }
    }
    if (e.pointerType === 'touch') {
      touches.current.set(e.pointerId, e.clientY);
      // A finger scrolls when a stylus does the drawing, or when it's the second finger down,
      // which also abandons the stroke the first one started.
      if (stylus || touches.current.size >= 2) {
        if (drawingPointer.current !== null) {
          drawingPointer.current = null;
          setDrawing(null);
        }
        // The first finger down leads the scroll; following one finger keeps two from doubling it.
        scroller.current ??= touches.current.keys().next().value ?? e.pointerId;
        return;
      }
    }
    drawingPointer.current = e.pointerId;
    const [x, y] = point(e);
    setDrawing({ tool: 'pen', color, width: Math.max(1, Math.round(widthPx * scale)), points: [x, y] });
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (e.pointerType === 'touch' && touches.current.has(e.pointerId)) {
      const lastY = touches.current.get(e.pointerId)!;
      touches.current.set(e.pointerId, e.clientY);
      if (scroller.current === e.pointerId) {
        window.scrollBy(0, lastY - e.clientY);
        return;
      }
    }
    if (!drawing || drawingPointer.current !== e.pointerId) return;
    const [x, y] = point(e);
    const n = drawing.points.length;
    if (Math.hypot(x - drawing.points[n - 2], y - drawing.points[n - 1]) < MIN_STEP) return;
    setDrawing({ ...drawing, points: [...drawing.points, x, y] });
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    touches.current.delete(e.pointerId);
    if (scroller.current === e.pointerId) scroller.current = touches.current.keys().next().value ?? null;
    if (drawingPointer.current !== e.pointerId || !drawing) return;
    drawingPointer.current = null;
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
  const toolButton = (value: 'pen' | 'highlighter', label: string) => (
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
          {active ? '✎ Annotating: on' : '✎ Annotate'}
        </button>

        {active && (
          <>
            {highlighter && (
              <div className="flex" role="group" aria-label="Tool">
                {toolButton('pen', 'Pen')}
                {toolButton('highlighter', 'Highlighter')}
              </div>
            )}
            {highlighting ? (
              <>
                <span className="font-mono text-[11px]">Select text to highlight it; tap a highlight to remove it.</span>
                <button type="button" disabled={highlighter.count === 0} onClick={highlighter.undo} className={smallButton}>
                  Undo
                </button>
                <button type="button" disabled={highlighter.count === 0} onClick={highlighter.clear} className={smallButton}>
                  Clear highlights
                </button>
              </>
            ) : (
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
                <button
                  type="button"
                  disabled={strokes.length === 0}
                  onClick={() => {
                    setStrokes((s) => s.slice(0, -1));
                    setDirty(true);
                  }}
                  className={smallButton}
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
                  className={smallButton}
                >
                  Clear
                </button>
              </>
            )}
          </>
        )}

        {(penOn || dirty) && (
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
        {penOn && (
          <span className="w-full font-mono text-[10px] text-ink-soft">
            {stylus ? 'Your stylus draws; a finger scrolls.' : 'On a touch screen, scroll with two fingers.'}
          </span>
        )}
      </div>

      <div ref={box} className="relative">
        {typeof children === 'function' ? children({ highlighting }) : children}
        <svg
          aria-hidden={!penOn}
          aria-label={penOn ? 'Drawing area' : undefined}
          className={`absolute inset-0 h-full w-full ${penOn ? 'cursor-crosshair' : ''}`}
          style={{ pointerEvents: penOn ? 'auto' : 'none', touchAction: penOn ? 'none' : 'auto' }}
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
              // Freehand highlighter strokes from before the highlighter marked text still show.
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
