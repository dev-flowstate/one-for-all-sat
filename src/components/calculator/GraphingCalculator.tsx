import { useMemo, useRef, useState } from 'react';
import { GraphCanvas } from './GraphCanvas';
import { formatNumber, parseExpression, shouldPlot } from '../../lib/calculator/expression';
import type { GraphPlot } from '../../lib/calculator/graph';

interface ExpressionRow {
  id: number;
  text: string;
}

/** Curve colours, reused in order once a student adds more rows than there are colours. */
const PLOT_COLORS = ['#16587b', '#b3401f', '#2e7d4f', '#7a4cc4', '#c2761b', '#0f7d8c'];
const IDLE_COLOR = '#b6c6d0';
const INITIAL_ROWS = 4;

/**
 * Desmos-style calculator: an expression list where each row is one equation, plotted live on
 * the graph beside it. Rows without an x (`2+2*7`, `sqrt(144)`) show their value instead, so
 * the same list doubles as a plain scientific calculator.
 */
export function GraphingCalculator() {
  const nextIdRef = useRef(INITIAL_ROWS);
  const [rows, setRows] = useState<ExpressionRow[]>(() =>
    Array.from({ length: INITIAL_ROWS }, (_, index) => ({ id: index, text: '' })),
  );

  const entries = useMemo(
    () =>
      rows.map((row, index) => ({
        row,
        color: PLOT_COLORS[index % PLOT_COLORS.length],
        result: parseExpression(row.text),
      })),
    [rows],
  );

  const plots = useMemo<GraphPlot[]>(
    () =>
      entries.flatMap(({ color, result }) =>
        result.status === 'ok' && shouldPlot(result.expression)
          ? [{ color, evaluateAt: result.expression.evaluateAt }]
          : [],
      ),
    [entries],
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
        <ul className="max-h-44 space-y-2 overflow-y-auto pr-1 sm:max-h-72">
          {entries.map(({ row, color, result }, index) => {
            const plotted = result.status === 'ok' && shouldPlot(result.expression);
            return (
              <li key={row.id} className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="mt-3 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: plotted ? color : IDLE_COLOR }}
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
                      result.status === 'error' ? 'border-danger bg-danger-bg' : 'border-rock-blue/50'
                    }`}
                  />
                  {result.status === 'error' && <p className="mt-0.5 text-xs text-danger">{result.message}</p>}
                  {result.status === 'ok' && result.expression.value !== null && (
                    <p className="mt-0.5 font-mono text-xs font-semibold text-venice-blue">
                      = {formatNumber(result.expression.value)}
                    </p>
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
          Try <span className="font-mono">x^2 - 4</span>, <span className="font-mono">sin(x)</span> or{' '}
          <span className="font-mono">2+2*7</span>.
        </p>
      </div>

      <div className="h-56 flex-1 sm:h-80">
        <GraphCanvas plots={plots} />
      </div>
    </div>
  );
}
