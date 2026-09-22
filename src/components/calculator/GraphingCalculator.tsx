import { useCallback, useMemo, useRef, useState } from 'react';
import { AngleModeToggle } from './AngleModeToggle';
import { DataTableEditor } from './DataTableEditor';
import { GraphCanvas } from './GraphCanvas';
import { createTable, toTableData } from './tableModel';
import type { EditableTable, TableRowData } from './tableModel';
import { compileRows, formatNumber } from '../../lib/calculator/expression';
import { findPointsOfInterest } from '../../lib/calculator/analysis';
import type { GraphLayer, GraphPoint, GraphScatter } from '../../lib/calculator/graph';
import type {
  AngleMode,
  FunctionRow,
  ImplicitRow,
  InequalityRow,
  ParsedRow,
  RegressionRow,
  SearchRange,
  TableData,
} from '../../lib/calculator/types';

interface ExpressionRow {
  id: number;
  text: string;
}

type PanelTab = 'expressions' | 'data';

/** Curve colours, reused in order once a student adds more rows than there are colours. */
const PLOT_COLORS = ['#16587b', '#b3401f', '#2e7d4f', '#7a4cc4', '#c2761b', '#0f7d8c'];
/** Kept clear of PLOT_COLORS so a table's points never read as some expression's curve. */
const TABLE_COLORS = ['#a4113f', '#3f2b96'];
const IDLE_COLOR = '#b6c6d0';
const INITIAL_ROWS = 4;
/** A slider covers ±this many times the constant's own magnitude, rounded to a power of ten. */
const SLIDER_SPAN = 10;
const SLIDER_STEPS = 100;

const TABS: readonly { tab: PanelTab; label: string }[] = [
  { tab: 'expressions', label: 'Expressions' },
  { tab: 'data', label: 'Data' },
];

const LIST_CLASS = 'max-h-44 overflow-y-auto pr-1 sm:max-h-72';

/**
 * Desmos-style calculator: an expression list where each row is one equation, plotted live on
 * the graph beside it. Rows without an x (`2+2*7`, `sqrt(144)`) show their value instead, so
 * the same list doubles as a plain scientific calculator, and a row that just names a constant
 * (`a = 5`) gets a slider so later rows using `a` can be explored by dragging it.
 *
 * The Data tab holds tables of paired points, which scatter onto the graph and can be fitted
 * from an expression row (`y_1 ~ m*x_1 + b`) for line-of-best-fit questions.
 */
export function GraphingCalculator() {
  const nextIdRef = useRef(INITIAL_ROWS);
  const [angleMode, setAngleMode] = useState<AngleMode>('radians');
  const [tab, setTab] = useState<PanelTab>('expressions');
  const [rows, setRows] = useState<ExpressionRow[]>(() =>
    Array.from({ length: INITIAL_ROWS }, (_, index) => ({ id: index, text: '' })),
  );
  const [tables, setTables] = useState<EditableTable[]>(() => [createTable(1)]);

  const tableData = useMemo(() => tables.map(toTableData), [tables]);

  const parsed = useMemo(
    () => compileRows(rows.map((row) => row.text), angleMode, tableData),
    [rows, angleMode, tableData],
  );

  const layers = useMemo<GraphLayer[]>(
    () =>
      parsed.flatMap((row, index) =>
        isDrawable(row) ? [{ color: PLOT_COLORS[index % PLOT_COLORS.length], row }] : [],
      ),
    [parsed],
  );

  const scatters = useMemo<GraphScatter[]>(
    () =>
      tableData.map((table, index) => ({
        color: TABLE_COLORS[index % TABLE_COLORS.length],
        points: pairsOf(table),
      })),
    [tableData],
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

  const updateTable = (position: number, tableRows: TableRowData[]) => {
    setTables((current) =>
      current.map((table, index) => (index === position ? { ...table, rows: tableRows } : table)),
    );
  };

  const addTable = () => {
    setTables((current) => [
      ...current,
      // Numbered past every existing table, so removing one never renames another's columns.
      createTable(Math.max(...current.map((table) => table.index)) + 1),
    ]);
  };

  const removeTable = (position: number) => {
    setTables((current) => current.filter((_, index) => index !== position));
  };

  return (
    <div className="flex flex-col gap-3 p-3 sm:flex-row">
      <div className="flex w-full flex-col gap-2 sm:w-52">
        <AngleModeToggle mode={angleMode} onChange={setAngleMode} />

        <div
          role="group"
          aria-label="Calculator input"
          className="flex shrink-0 border-2 border-ink bg-paper"
        >
          {TABS.map((option) => (
            <button
              key={option.tab}
              type="button"
              onClick={() => setTab(option.tab)}
              aria-pressed={option.tab === tab}
              className={`min-h-9 flex-1 px-2 text-xs font-semibold tracking-tight uppercase ${
                option.tab === tab
                  ? 'bg-venice-blue text-merino'
                  : 'text-ink hover:bg-merino-dark'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {tab === 'expressions' ? (
          <>
            <ul className={`space-y-2 ${LIST_CLASS}`}>
              {rows.map((row, index) => {
                const result = parsed[index];
                const color = PLOT_COLORS[index % PLOT_COLORS.length];
                const slider = sliderFor(result);
                return (
                  <li key={row.id} className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className="mt-3 h-3 w-3 shrink-0 border-2 border-ink"
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
                        className={`min-h-9 w-full border-2 bg-paper px-2 py-1.5 font-mono text-sm text-ink placeholder:text-ink-soft/60 ${
                          result.kind === 'error' ? 'border-danger bg-danger-bg' : 'border-ink'
                        }`}
                      />
                      {result.kind === 'error' && <p className="mt-0.5 text-xs text-danger">{result.message}</p>}
                      {result.kind === 'value' && (
                        <p className="mt-0.5 font-mono text-xs font-semibold text-venice-blue">
                          = {formatNumber(result.value)}
                        </p>
                      )}
                      {result.kind === 'regression' && <RegressionReadout row={result} />}
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
                      className="mt-0.5 flex h-9 w-7 shrink-0 items-center justify-center text-ink-soft hover:bg-merino-dark hover:text-ink disabled:opacity-30"
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
              className="press min-h-9 shrink-0 border-2 border-ink bg-rock-blue px-3 py-1.5 text-xs font-semibold tracking-tight text-ink uppercase hover:bg-rock-blue-dark"
            >
              + Add expression
            </button>
            {/* Shown at every width. Hidden below `sm` these were invisible on a phone, which
                is where most people meet the calculator — and the syntax it can't guess at,
                like a restriction, may as well not exist if it's never mentioned. */}
            <p className="text-xs text-ink-soft">
              Try <span className="font-mono">x^2 - 4</span>, <span className="font-mono">x^2 + y^2 = 25</span>,{' '}
              <span className="font-mono">y &gt; 2x + 1</span>, <span className="font-mono">a = 5</span> for a slider,
              or <span className="font-mono">y = x^2 &#123;0&lt;x&lt;5&#125;</span> to restrict a curve.
            </p>
          </>
        ) : (
          <>
            <div className={`space-y-2 ${LIST_CLASS}`}>
              {tables.map((table, index) => (
                <DataTableEditor
                  key={table.index}
                  table={table}
                  color={TABLE_COLORS[index % TABLE_COLORS.length]}
                  onChange={(tableRows) => updateTable(index, tableRows)}
                  onRemove={tables.length > 1 ? () => removeTable(index) : undefined}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={addTable}
              className="press min-h-9 shrink-0 border-2 border-ink bg-rock-blue px-3 py-1.5 text-xs font-semibold tracking-tight text-ink uppercase hover:bg-rock-blue-dark"
            >
              + Add table
            </button>
            <p className="text-xs text-ink-soft">
              Type or paste two columns, then fit them from an expression row:{' '}
              <span className="font-mono">y_1 ~ m*x_1 + b</span> for a line,{' '}
              <span className="font-mono">y_1 ~ a*x_1^2 + b*x_1 + c</span> for a parabola, or{' '}
              <span className="font-mono">y_1 ~ a*b^x_1</span> for growth.
            </p>
          </>
        )}
      </div>

      <div className="h-56 flex-1 sm:h-80">
        <GraphCanvas layers={layers} scatters={scatters} findPoints={findPoints} />
      </div>
    </div>
  );
}

/** R² and r are always in -1..1, where a long decimal tail is noise rather than information. */
function formatFitQuality(value: number): string {
  return Number.isFinite(value) ? value.toFixed(4) : '—';
}

/** Fitted parameters and goodness of fit, shown under the `~` row that produced them. */
function RegressionReadout({ row }: { row: RegressionRow }) {
  return (
    <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 font-mono text-xs text-venice-blue">
      {Object.entries(row.parameters).map(([name, value]) => (
        <span key={name} className="font-semibold">
          {name} = {formatNumber(value)}
        </span>
      ))}
      <span className="text-ink-soft">R² = {formatFitQuality(row.rSquared)}</span>
      {/* Only a straight-line fit has a meaningful r, so the engine returns null otherwise. */}
      {row.r !== null && <span className="text-ink-soft">r = {formatFitQuality(row.r)}</span>}
    </div>
  );
}

/** The (x, y) pairs a table contributes to the graph; a blank cell drops its whole row. */
function pairsOf(table: TableData): { x: number; y: number }[] {
  const [xs, ys] = table.columns;
  return xs.values
    .map((x, index) => ({ x, y: ys.values[index] }))
    .filter((pair) => Number.isFinite(pair.x) && Number.isFinite(pair.y));
}

/** Rows that put something on the canvas, as opposed to a value, a definition or an error. */
function isDrawable(row: ParsedRow): row is FunctionRow | ImplicitRow | InequalityRow | RegressionRow {
  return (
    row.kind === 'function' ||
    row.kind === 'implicit' ||
    row.kind === 'inequality' ||
    row.kind === 'regression'
  );
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
