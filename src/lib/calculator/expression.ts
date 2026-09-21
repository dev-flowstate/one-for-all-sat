import { compile, parse } from 'mathjs/number';
import type { EvalFunction, MathNode, SymbolNode } from 'mathjs/number';

/** A leading `y =` is optional, so both `y = 2x + 3` and `2x + 3` graph the same line. */
const Y_PREFIX = /^\s*y\s*=\s*/i;

/** x used while probing an expression for errors — avoids landing on a pole or a domain edge. */
const PROBE_X = 1.2345;

/**
 * Extra scope entries. mathjs' `log` is the natural log, but SAT (and Desmos) treat `log`
 * as base 10 and `ln` as the natural log, so both are redefined here.
 */
const FUNCTIONS = {
  log: (value: number, base?: number) =>
    base === undefined ? Math.log10(value) : Math.log(value) / Math.log(base),
  ln: (value: number) => Math.log(value),
};

export interface CompiledExpression {
  /** Evaluates at a single x. Returns NaN wherever the expression is undefined. */
  evaluateAt: (x: number) => number;
  /** The expression mentions x, so it should be drawn as a curve. */
  usesX: boolean;
  /** Value of an x-free expression such as `2+2*7`, otherwise null. */
  value: number | null;
  /** The user typed an explicit `y =`, so even `y = 3` should be drawn as a line. */
  explicitY: boolean;
}

export type ExpressionResult =
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | { status: 'ok'; expression: CompiledExpression };

/** Parses one expression-list row. Never throws — bad input comes back as `status: 'error'`. */
export function parseExpression(input: string): ExpressionResult {
  const explicitY = Y_PREFIX.test(input);
  const source = input
    .replace(Y_PREFIX, '')
    .replace(/π/g, 'pi')
    .replace(/−/g, '-')
    .replace(/×/g, '*')
    .replace(/÷/g, '/');
  if (!source.trim()) return { status: 'empty' };

  let code: EvalFunction;
  let usesX: boolean;
  try {
    usesX = parse(source).filter(isXSymbol).length > 0;
    code = compile(source);
  } catch (error) {
    return { status: 'error', message: toMessage(error) };
  }

  const scope: Record<string, unknown> = { ...FUNCTIONS, x: 0 };
  const evaluateAt = (x: number): number => {
    scope.x = x;
    try {
      const result: unknown = code.evaluate(scope);
      return typeof result === 'number' ? result : Number.NaN;
    } catch {
      return Number.NaN;
    }
  };

  // A single probe surfaces unknown variables/functions and non-numeric results (`x > 1`)
  // as a row error instead of silently drawing nothing.
  try {
    const probe: unknown = code.evaluate({ ...FUNCTIONS, x: PROBE_X });
    if (typeof probe !== 'number') {
      return { status: 'error', message: 'Enter a number or a function of x' };
    }
  } catch (error) {
    return { status: 'error', message: toMessage(error) };
  }

  return {
    status: 'ok',
    expression: { evaluateAt, usesX, value: usesX ? null : evaluateAt(0), explicitY },
  };
}

/** True when a parsed expression should be drawn on the graph rather than just evaluated. */
export function shouldPlot(expression: CompiledExpression): boolean {
  return expression.usesX || expression.explicitY;
}

/** Trims floating-point noise off a numeric answer (`0.30000000000000004` → `0.3`). */
export function formatNumber(value: number): string {
  if (Number.isNaN(value)) return 'undefined';
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '−∞';
  // Exact integers print in full, so `2^40` stays 1099511627776 rather than being rounded.
  if (Number.isInteger(value) && Math.abs(value) < Number.MAX_SAFE_INTEGER) return String(value);
  const rounded = Number(value.toPrecision(10));
  if (rounded !== 0 && (Math.abs(rounded) >= 1e10 || Math.abs(rounded) < 1e-6)) {
    return rounded.toExponential();
  }
  return String(rounded);
}

function isXSymbol(node: MathNode): boolean {
  return node.type === 'SymbolNode' && (node as SymbolNode).name === 'x';
}

function toMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : '';
  if (raw.startsWith('Undefined symbol')) {
    return `${raw.replace('Undefined symbol', 'Unknown variable')} — only x can vary`;
  }
  if (raw.startsWith('Undefined function')) {
    return raw.replace('Undefined function', 'Unknown function');
  }
  return "Can't read this — check for a typo or a missing bracket";
}
