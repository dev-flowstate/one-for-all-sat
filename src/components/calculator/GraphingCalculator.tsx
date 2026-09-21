import { useCallback, useMemo, useRef, useState } from 'react';
import { AngleModeToggle } from './AngleModeToggle';
import { GraphCanvas } from './GraphCanvas';
import { compileRows, formatNumber } from '../../lib/calculator/expression';
import { findPointsOfInterest } from '../../lib/calculator/analysis';
import type { GraphLayer, GraphPoint } from '../../lib/calculator/graph';
import type {
  AngleMode,
  FunctionRow,
  ImplicitRow,
  InequalityRow,
  ParsedRow,
  SearchRange,
} from '../../lib/calculator/types';

interface ExpressionRow {
  id: number;
  text: string;
}

/** Curve colours, reused in order once a student adds more rows than there are colours. */
const PLOT_COLORS = ['#16587b', '#b3401f', '#2e7d4f', '#7a4cc4', '#c2761b', '#0f7d8c'];
const IDLE_COLOR = '#b6c6d0';
const INITIAL_ROWS = 4;
/** A slider covers ±this many times the constant's own magnitude, rounded to a power of ten. */
const SLIDER_SPAN = 10;
const SLIDER_STEPS = 100;

/**
 * Desmos-style calculator: an expression list where each row is one equation, plotted live on
 * the graph beside it. Rows without an x (`2+2*7`, `sqrt(144)`) show their value instead, so
 * the same list doubles as a plain scientific calculator, and a row that just names a constant
 * (`a = 5`) gets a slider so later rows using `a` can be explored by dragging it.
 */
export function GraphingCalculator() {
  const nextIdRef = useRef(INITIAL_ROWS);
  const [angleMode, setAngleMode] = useState<AngleMode>('radians');
  const [rows, setRows] = useState<ExpressionRow[]>(() =>
    Array.from({ length: INITIAL_ROWS }, (_, index) => ({ id: index, text: '' })),
  );

  const parsed = useMemo(
    () => compileRows(rows.map((row) => row.text), angleMode),
    [rows, angleMode],
  );

  const layers = useMemo<GraphLayer[]>(
    () =>
      parsed.flatMap((row, index) =>
        isDrawable(row) ? [{ color: PLOT_COLORS[index % PLOT_COLORS.length], row }] : [],
      ),
    [parsed],
  );

  const findPoints = useCallback(
    (range: SearchRange): GraphPoint[] =>
      findPointsOfInterest(parsed, range).map((point) => ({
        x: point.x,
        y: point.y,
        kind: point.kind,
        color: PLOT_COLORS[(point.rowIndexes[0] ?? 0) % PLOT_COLORS.length],
        label: `(${formatNumber(point.x)}, ${formatNumber(point.y)})`,
      })),
    [parsed],
  );

  const updateRow = (id: number, text: string) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, text } : row)));
  };

  const addRow = () => {
    const id = nextIdRef.current;
    nextIdRef.current += 1;
    setRows((current) => [...current, { id, text: '' }]);
  };

  const removeRow = (id: number) => {
    setRows((current) => (current.length === 1 ? current : current.filter((row) => row.id !== id)));
  };

  return (
    <div className="flex flex-col gap-3 p-3 sm:flex-row">
      <div className="flex w-full flex-col gap-2 sm:w-52">
        <AngleModeToggle mode={angleMode} onChange={setAngleMode} />

        <ul className="max-h-44 space-y-2 overflow-y-auto pr-1 sm:max-h-72">
          {rows.map((row, index) => {
            const result = parsed[index];
            const color = PLOT_COLORS[index % PLOT_COLORS.length];
            const slider = sliderFor(result);
            return (
              <li key={row.id} className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="mt-3 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: isDrawable(result) ? color : IDLE_COLOR }}
                />
                <div className="min-w-0 flex-1">
                  <input
                    type="text"
                    value={row.text}
                    onChange={(event) => updateRow(row.id, event.target.value)}
                    placeholder={index === 0 ? 'y = 2x + 3' : ''}
                    aria-label={`Expression ${index + 1}`}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className={`min-h-9 w-full rounded-lg border bg-white px-2 py-1.5 font-mono text-sm text-venice-blue-dark placeholder:font-sans placeholder:text-venice-blue-dark/40 focus:border-venice-blue focus:outline-none ${
                      result.kind === 'error' ? 'border-danger bg-danger-bg' : 'border-rock-blue/50'
                    }`}
                  />
                  {result.kind === 'error' && <p className="mt-0.5 text-xs text-danger">{result.message}</p>}
                  {result.kind === 'value' && (
                    <p className="mt-0.5 font-mono text-xs font-semibold text-venice-blue">
                      = {formatNumber(result.value)}
                    </p>
                  )}
                  {slider && (
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="range"
                        min={slider.min}
                        max={slider.max}
                        step={slider.step}
                        value={slider.value}
                        onChange={(event) => updateRow(row.id, `${slider.name} = ${event.target.value}`)}
                        aria-label={`Value of ${slider.name}`}
                        className="h-6 min-w-0 flex-1 accent-venice-blue"
                      />
                      <span className="shrink-0 font-mono text-xs font-semibold text-venice-blue">
                        {formatNumber(slider.value)}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length === 1}
                  aria-label={`Remove expression ${index + 1}`}
                  className="mt-0.5 flex h-9 w-7 shrink-0 items-center justify-center rounded text-venice-blue-dark/60 hover:bg-rock-blue/20 hover:text-venice-blue-dark disabled:opacity-30"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={addRow}
          className="min-h-9 shrink-0 rounded-lg bg-rock-blue/30 px-3 py-1.5 text-sm font-semibold text-venice-blue-dark hover:bg-rock-blue/50"
        >
          + Add expression
        </button>
        <p className="hidden text-xs text-venice-blue-dark/60 sm:block">
          Try <span className="font-mono">x^2 - 4</span>, <span className="font-mono">x^2 + y^2 = 25</span>,{' '}
          <span className="font-mono">y &gt; 2x + 1</span> or <span className="font-mono">2+2*7</span>.
        </p>
      </div>

      <div className="h-56 flex-1 sm:h-80">
        <GraphCanvas layers={layers} findPoints={findPoints} />
      </div>
    </div>
  );
}

/** Rows that put something on the canvas, as opposed to a value, a definition or an error. */
function isDrawable(row: ParsedRow): row is FunctionRow | ImplicitRow | InequalityRow {
  return row.kind === 'function' || row.kind === 'implicit' || row.kind === 'inequality';
}

interface Slider {
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
}

/**
 * Slider bounds for a constant row. The span is quantised to a power of ten so it can't shift
 * under the student's thumb mid-drag: dragging `a = 5` anywhere in −10…10 keeps that same range.
 */
function sliderFor(row: ParsedRow): Slider | null {
  if (row.kind !== 'definition' || !row.slidable || row.value === null || !Number.isFinite(row.value)) {
    return null;
  }
  const magnitude = Math.abs(row.value);
  const span = Math.max(SLIDER_SPAN, 10 ** Math.ceil(Math.log10(magnitude || 1)));
  return { name: row.name, value: row.value, min: -span, max: span, step: span / SLIDER_STEPS };
}
