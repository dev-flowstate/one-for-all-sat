import type { EvalFunction, MathNode, SymbolNode } from 'mathjs/number';
import { fitModel } from './regression';
import type { ModelAt } from './regression';
import { createBaseScope, isReservedName, math } from './scope';
import type { Scope } from './scope';
import type { AngleMode, ParsedRow, TableData } from './types';

/** x/y used when probing a row for unknown names — away from poles and domain edges. */
const PROBE_X = 1.2345;
const PROBE_Y = 0.6789;
/** Stand-in for a fitted parameter when asking what shape a model has, rather than how it fits. */
const PROBE_PARAMETER = 0.7;
/** How far a sampled model may bend and still count as a straight line. */
const STRAIGHT_TOLERANCE = 1e-9;

/** `a` / `f(x, t)` on the left of an `=`. */
const CONSTANT_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;
const FUNCTION_NAME = /^([A-Za-z][A-Za-z0-9_]*)\s*\(\s*([A-Za-z][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z][A-Za-z0-9_]*)*)\s*\)$/;

/** `sin^-1(x)` and `sin^(-1)(x)` both mean `asin(x)`. */
const INVERSE_TRIG = /\b(sin|cos|tan|sec|csc|cot)\s*\^\s*\(?\s*-\s*1\s*\)?\s*\(/g;
/** Desmos' `[1...10]`; mathjs spells the same range `1:10`. */
const LIST_RANGE = /\[([^[\]]+?)\.\.\.([^[\]]+?)\]/g;
/** A trailing Desmos-style domain restriction, e.g. `{0 < x < 5}`. */
const RESTRICTION = /\{([^{}]*)\}\s*$/;

type Predicate = (x: number, y: number) => boolean;
/** Evaluates an expression that may use both graph variables. */
type Surface = (x: number, y: number) => number;
/** Table columns visible to every row, keyed by the name expressions reference them with. */
type Columns = ReadonlyMap<string, readonly number[]>;

/** A message that is already fit to show the student, as opposed to a mathjs failure. */
class RowError extends Error {}

/**
 * Compiles every row of the expression list in one pass, so a definition in one row is
 * visible to the rows below it. Never throws: a bad row comes back as `kind: 'error'`.
 */
export function compileRows(
  inputs: readonly string[],
  angleMode: AngleMode,
  tables?: readonly TableData[],
): ParsedRow[] {
  const columns = collectColumns(tables);
  const base = createBaseScope(angleMode);
  // Each column is one list-valued symbol, so `x_1` reads as an array in any row.
  for (const [name, values] of columns) base[name] = [...values];
  const definitions: Scope = {};
  return inputs.map((input) => compileRow(input, base, definitions, columns));
}

/** Later tables win a name clash; a column can't take over `x`, `y` or a built-in. */
function collectColumns(tables: readonly TableData[] | undefined): Columns {
  const columns = new Map<string, readonly number[]>();
  for (const table of tables ?? []) {
    for (const column of table.columns) {
      if (column.name && !isReservedName(column.name)) columns.set(column.name, column.values);
    }
  }
  return columns;
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

function compileRow(
  input: string,
  base: Scope,
  definitions: Scope,
  columns: Columns,
): ParsedRow {
  const normalized = normalize(input);
  if (!normalized.trim()) return { kind: 'empty' };
  try {
    return buildRow(normalized, { ...base, ...definitions }, definitions, columns);
  } catch (error) {
    return { kind: 'error', message: error instanceof RowError ? error.message : toMessage(error) };
  }
}

function buildRow(
  normalized: string,
  snapshot: Scope,
  definitions: Scope,
  columns: Columns,
): ParsedRow {
  const { body, conditions } = splitRestrictions(normalized);
  if (!body) throw new RowError('Add an expression before the restriction');

  const fits = findOperators(body, ['~']);
  if (fits.length > 0) {
    if (fits.length > 1) throw new RowError('Use one ~ per row');
    if (conditions.length > 0) throw new RowError("A regression can't take a restriction");
    return buildRegression(body, fits[0].index, snapshot, definitions, columns);
  }

  const restriction = compileRestriction(conditions, snapshot);

  const comparisons = findOperators(body, ['<=', '>=', '<', '>']);
  if (comparisons.length > 1) throw new RowError('Use one comparison per row');
  if (comparisons.length === 1) return buildInequality(body, comparisons[0], snapshot, restriction);

  const equals = findOperators(body, ['=']);
  if (equals.length > 1) throw new RowError('Use one = per row');
  if (equals.length === 1) {
    return buildEquation(body, equals[0].index, snapshot, definitions, restriction);
  }

  return buildExpression(body, snapshot, restriction);
}

// --- row kinds ---------------------------------------------------------------------------

/** A bare `x^2 - 4` graphs; a bare `2 + 2*7` just shows its value. */
function buildExpression(body: string, snapshot: Scope, restriction: Predicate | null): ParsedRow {
  const node = math.parse(rewrite(body));
  if (usesVariable(node, 'x')) return buildFunction(node, snapshot, restriction);
  const scope: Scope = { ...snapshot };
  const result: unknown = node.compile().evaluate(scope);
  if (typeof result !== 'number') throw new RowError('Enter a number or a function of x');
  return { kind: 'value', value: result };
}

function buildFunction(node: MathNode, snapshot: Scope, restriction: Predicate | null): ParsedRow {
  const code = node.compile();
  probe(code, snapshot, false);
  const at = evaluator(code, snapshot, false);
  if (!restriction) return { kind: 'function', evaluateAt: (x) => at(x, Number.NaN) };
  return {
    kind: 'function',
    // The restriction may mention y, which for `y = f(x)` is the value we just computed.
    evaluateAt: (x) => {
      const value = at(x, Number.NaN);
      return restriction(x, value) ? value : Number.NaN;
    },
  };
}

function buildEquation(
  body: string,
  index: number,
  snapshot: Scope,
  definitions: Scope,
  restriction: Predicate | null,
): ParsedRow {
  const left = body.slice(0, index).trim();
  const right = body.slice(index + 1).trim();
  if (!left || !right) throw new RowError('Both sides of = need an expression');

  // `y = 2x + 3` and `2x + 3 = y` are the same function; anything else with a y is implicit.
  if (left.toLowerCase() === 'y') return solvedForY(right, snapshot, restriction);
  if (right.toLowerCase() === 'y') return solvedForY(left, snapshot, restriction);

  const constant = CONSTANT_NAME.exec(left);
  if (constant && !isReservedName(constant[0])) {
    return defineConstant(constant[0], right, snapshot, definitions);
  }

  const signature = FUNCTION_NAME.exec(left);
  if (signature && !isReservedName(signature[1])) {
    const parameters = signature[2].split(',').map((parameter) => parameter.trim());
    return defineFunction(signature[1], parameters, right, snapshot, definitions);
  }

  return buildImplicit(left, right, snapshot, restriction);
}

/** `y = …` only stays a function while the other side is free of y. */
function solvedForY(source: string, snapshot: Scope, restriction: Predicate | null): ParsedRow {
  const node = math.parse(rewrite(source));
  if (usesVariable(node, 'y')) throw new RowError('y appears on both sides');
  return buildFunction(node, snapshot, restriction);
}

function buildImplicit(
  left: string,
  right: string,
  snapshot: Scope,
  restriction: Predicate | null,
): ParsedRow {
  const leftAt = compileSurface(left, snapshot);
  const rightAt = compileSurface(right, snapshot);
  return {
    kind: 'implicit',
    residual: (x, y) =>
      allowed(restriction, x, y) ? leftAt(x, y) - rightAt(x, y) : Number.NaN,
  };
}

function buildInequality(
  body: string,
  operator: { index: number; text: string },
  snapshot: Scope,
  restriction: Predicate | null,
): ParsedRow {
  const left = body.slice(0, operator.index).trim();
  const right = body.slice(operator.index + operator.text.length).trim();
  if (!left || !right) throw new RowError('Both sides of the comparison need an expression');

  const leftAt = compileSurface(left, snapshot);
  const rightAt = compileSurface(right, snapshot);
  const strict = operator.text === '<' || operator.text === '>';
  const greater = operator.text.startsWith('>');

  return {
    kind: 'inequality',
    strict,
    residual: (x, y) =>
      allowed(restriction, x, y) ? leftAt(x, y) - rightAt(x, y) : Number.NaN,
    satisfiedAt: (x, y) => {
      if (!allowed(restriction, x, y)) return false;
      const delta = leftAt(x, y) - rightAt(x, y);
      if (!Number.isFinite(delta)) return false;
      if (greater) return strict ? delta > 0 : delta >= 0;
      return strict ? delta < 0 : delta <= 0;
    },
  };
}

// --- regression --------------------------------------------------------------------------

/**
 * `y_1 ~ m*x_1 + b` fits the model on the right to the data on the left. Every symbol the
 * model introduces — one that isn't a column, a definition, a constant or a function — is a
 * parameter to be fitted, and stays readable by the rows below.
 */
function buildRegression(
  body: string,
  index: number,
  snapshot: Scope,
  definitions: Scope,
  columns: Columns,
): ParsedRow {
  const left = body.slice(0, index).trim();
  const right = body.slice(index + 1).trim();
  if (!left || !right) throw new RowError('Both sides of ~ need an expression');

  const targetNode = math.parse(rewrite(left));
  const modelNode = math.parse(rewrite(right));
  if (usesVariable(modelNode, 'x') || usesVariable(modelNode, 'y')) {
    throw new RowError('A regression is written with table columns, not x or y');
  }
  const unknown = freeNames(targetNode, snapshot)[0];
  if (unknown) throw new RowError(`Unknown variable ${unknown} — the left of ~ is the data`);

  const parameters = regressionParameters(modelNode, snapshot);
  const used = [...columns]
    .filter(([name]) => mentions(targetNode, name) || mentions(modelNode, name))
    .map(([name, values]) => ({ name, values }));
  if (used.length === 0) throw new RowError('A regression needs table data, as in y_1 ~ m*x_1 + b');

  const targetCode = targetNode.compile();
  const modelCode = modelNode.compile();
  const rowScope: Scope = { ...snapshot };
  const bind = (scope: Scope, row: number) => {
    for (const column of used) scope[column.name] = column.values[row];
  };

  // A row is only usable once every column it draws on has a real number in it.
  const length = Math.min(...used.map((column) => column.values.length));
  const rows: number[] = [];
  const targets: number[] = [];
  for (let row = 0; row < length; row += 1) {
    if (used.some((column) => !Number.isFinite(column.values[row]))) continue;
    bind(rowScope, row);
    const target = evaluateNumber(targetCode, rowScope);
    if (!Number.isFinite(target)) continue;
    rows.push(row);
    targets.push(target);
  }

  const modelScope: Scope = { ...snapshot };
  const model: ModelAt = (values, point) => {
    bind(modelScope, rows[point]);
    parameters.forEach((name, k) => {
      modelScope[name] = values[k];
    });
    return evaluateNumber(modelCode, modelScope);
  };

  const result = fitModel(model, targets, parameters.length);
  if (!result.ok) throw new RowError(result.message);

  const fitted: Record<string, number> = {};
  parameters.forEach((name, k) => {
    fitted[name] = result.fit.parameters[k];
    definitions[name] = result.fit.parameters[k];
  });

  // The one column the model reads is its independent variable, so the fit can be drawn over
  // the data. A model reading several columns has no single x to plot against.
  const inputs = used.filter((column) => mentions(modelNode, column.name));
  const independent = inputs.length === 1 ? inputs[0] : null;
  const plotScope: Scope = { ...snapshot, ...fitted };
  const evaluateAt = (x: number): number => {
    if (independent) plotScope[independent.name] = x;
    return evaluateNumber(modelCode, plotScope);
  };

  return {
    kind: 'regression',
    parameters: fitted,
    rSquared: result.fit.rSquared,
    r: lineCorrelation(modelCode, snapshot, parameters, independent, rows, targets),
    residuals: result.fit.residuals,
    evaluateAt,
  };
}

/**
 * The correlation coefficient, but only for a fit that is a straight line in its column —
 * reporting r for a parabola would say something the number doesn't mean. Straightness is
 * judged from the model as written, with stand-in parameters, so a quadratic never qualifies
 * on the strength of its x² term fitting to nearly zero.
 */
function lineCorrelation(
  code: EvalFunction,
  snapshot: Scope,
  parameters: readonly string[],
  independent: { name: string; values: readonly number[] } | null,
  rows: readonly number[],
  targets: readonly number[],
): number | null {
  if (!independent) return null;
  const inputs = rows.map((row) => independent.values[row]);
  const low = Math.min(...inputs);
  const high = Math.max(...inputs);
  if (!(high > low)) return null;

  const scope: Scope = { ...snapshot };
  for (const name of parameters) scope[name] = PROBE_PARAMETER;
  const step = (high - low) / 3;
  const sampled = [0, 1, 2, 3].map((k) => {
    scope[independent.name] = low + k * step;
    return evaluateNumber(code, scope);
  });
  if (!sampled.every(Number.isFinite)) return null;
  // A straight line has no curvature, so its second differences vanish.
  const scale = Math.max(1, ...sampled.map(Math.abs));
  const straight = [0, 1].every(
    (k) =>
      Math.abs(sampled[k + 2] - 2 * sampled[k + 1] + sampled[k]) <= scale * STRAIGHT_TOLERANCE,
  );
  return straight ? correlation(inputs, targets) : null;
}

function correlation(inputs: readonly number[], targets: readonly number[]): number | null {
  const meanInput = inputs.reduce((total, value) => total + value, 0) / inputs.length;
  const meanTarget = targets.reduce((total, value) => total + value, 0) / targets.length;
  let together = 0;
  let spreadInput = 0;
  let spreadTarget = 0;
  inputs.forEach((input, i) => {
    const dx = input - meanInput;
    const dy = targets[i] - meanTarget;
    together += dx * dy;
    spreadInput += dx * dx;
    spreadTarget += dy * dy;
  });
  const spread = Math.sqrt(spreadInput * spreadTarget);
  return spread > 0 ? together / spread : null;
}

/**
 * The names a `~` row fits. A regression's parameters belong to that row, so a symbol is a
 * parameter even when an earlier row already gave it a value.
 *
 * Without this, the conventional names collide: fitting `y_1 ~ m*x_1 + b` publishes `b`, and
 * a later `y_1 ~ a*x_1^2 + b*x_1 + c` then treats that `b` as a fixed constant and fits only
 * what's left. The result is silent — plausible-looking parameters and a nonsense R² — which
 * is worse than an error, so the row simply owns its own names instead.
 *
 * Only plain numbers are shadowed. Table columns are lists and user-defined functions are
 * functions, so both still resolve normally; mathjs' own constants (pi, e) are never in scope
 * to begin with and are recognised by `isKnownName`'s fallback.
 */
function regressionParameters(node: MathNode, snapshot: Scope): string[] {
  const shadowed: Scope = { ...snapshot };
  for (const [name, value] of Object.entries(shadowed)) {
    if (typeof value === 'number') delete shadowed[name];
  }
  return freeNames(node, shadowed);
}

/** Symbols the expression introduces itself: not a column, a definition, a constant or a function. */
function freeNames(node: MathNode, snapshot: Scope): string[] {
  const names: string[] = [];
  const symbols = node.filter(
    (candidate, path, parent) =>
      candidate.type === 'SymbolNode' && !(parent?.type === 'FunctionNode' && path === 'fn'),
  );
  for (const symbol of symbols) {
    const { name } = symbol as SymbolNode;
    if (!names.includes(name) && !isKnownName(name, snapshot)) names.push(name);
  }
  return names;
}

function isKnownName(name: string, snapshot: Scope): boolean {
  if (Object.hasOwn(snapshot, name) || isReservedName(name)) return true;
  // mathjs resolves its own constants (pi, e, phi, …) without them ever being in scope.
  try {
    math.evaluate(name, {});
    return true;
  } catch {
    return false;
  }
}

function evaluateNumber(code: EvalFunction, scope: Scope): number {
  try {
    const result: unknown = code.evaluate(scope);
    return typeof result === 'number' ? result : Number.NaN;
  } catch {
    return Number.NaN;
  }
}

// --- definitions -------------------------------------------------------------------------

function defineConstant(
  name: string,
  source: string,
  snapshot: Scope,
  definitions: Scope,
): ParsedRow {
  const node = math.parse(rewrite(source));
  if (usesVariable(node, 'x')) throw new RowError(`Use ${name}(x) = … to define a function of x`);
  const scope: Scope = { ...snapshot };
  const result: unknown = node.compile().evaluate(scope);
  if (typeof result !== 'number') throw new RowError(`${name} has to be a number`);
  definitions[name] = result;
  return { kind: 'definition', name, value: result, slidable: true };
}

/**
 * The body is compiled against a snapshot taken *before* this name existed, so a definition
 * can never reach itself — mutual cycles come out as "unknown function" instead of a hang.
 */
function defineFunction(
  name: string,
  parameters: readonly string[],
  source: string,
  snapshot: Scope,
  definitions: Scope,
): ParsedRow {
  const node = math.parse(rewrite(source));
  if (mentions(node, name)) throw new RowError(`${name} can't be defined in terms of itself`);

  const code = node.compile();
  // Safe to reuse one scope: a definition can't call itself, so calls never nest.
  const scope: Scope = { ...snapshot };
  const compiled = (...args: unknown[]): number => {
    parameters.forEach((parameter, index) => {
      scope[parameter] = args[index];
    });
    const result: unknown = code.evaluate(scope);
    return typeof result === 'number' ? result : Number.NaN;
  };

  // Calling it once surfaces unknown names in the body as an error on *this* row.
  compiled(...parameters.map(() => PROBE_X));
  definitions[name] = compiled;
  return { kind: 'definition', name, value: null, slidable: false };
}

// --- restrictions ------------------------------------------------------------------------

/** Peels the trailing `{…}` groups off a row, leaving the expression and its conditions. */
function splitRestrictions(source: string): { body: string; conditions: string[] } {
  let body = source.trim();
  const conditions: string[] = [];
  for (let match = RESTRICTION.exec(body); match; match = RESTRICTION.exec(body)) {
    const parts = match[1]
      .split(/,|\band\b/i)
      .map((part) => part.trim())
      .filter(Boolean);
    conditions.unshift(...parts);
    body = body.slice(0, match.index).trim();
  }
  return { body, conditions };
}

function compileRestriction(conditions: readonly string[], snapshot: Scope): Predicate | null {
  if (conditions.length === 0) return null;
  const tests = conditions.map((condition) => compileCondition(condition, snapshot));
  return (x, y) => tests.every((test) => test(x, y));
}

/** One condition, possibly chained: `x > 3`, `0 < x < 5`. */
function compileCondition(condition: string, snapshot: Scope): Predicate {
  const parts = condition.split(/(<=|>=|<|>)/).map((part) => part.trim());
  if (parts.length < 3 || parts.length % 2 === 0) {
    throw new RowError('A restriction looks like {0 < x < 5}');
  }
  const operands = parts.filter((_, index) => index % 2 === 0).map((part) => {
    if (!part) throw new RowError('A restriction looks like {0 < x < 5}');
    return compileSurface(part, snapshot);
  });
  const operators = parts.filter((_, index) => index % 2 === 1);
  return (x, y) =>
    operators.every((operator, index) =>
      compare(operands[index](x, y), operator, operands[index + 1](x, y)),
    );
}

function compare(left: number, operator: string, right: number): boolean {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  if (operator === '<') return left < right;
  if (operator === '<=') return left <= right;
  if (operator === '>') return left > right;
  return left >= right;
}

function allowed(restriction: Predicate | null, x: number, y: number): boolean {
  return restriction === null || restriction(x, y);
}

// --- compiling and evaluating ------------------------------------------------------------

/** Compiles a side of a relation, which may use x, y or both. */
function compileSurface(source: string, snapshot: Scope): Surface {
  const code = math.parse(rewrite(source)).compile();
  probe(code, snapshot, true);
  return evaluator(code, snapshot, true);
}

function evaluator(code: EvalFunction, snapshot: Scope, withY: boolean): Surface {
  const scope: Scope = { ...snapshot, x: 0 };
  if (withY) scope.y = 0;
  return (x, y) => {
    scope.x = x;
    if (withY) scope.y = y;
    try {
      const result: unknown = code.evaluate(scope);
      return typeof result === 'number' ? result : Number.NaN;
    } catch {
      return Number.NaN;
    }
  };
}

/**
 * A single evaluation up front turns unknown variables/functions and non-numeric results
 * into a row error, instead of a row that silently draws nothing.
 */
function probe(code: EvalFunction, snapshot: Scope, withY: boolean): void {
  const scope: Scope = { ...snapshot, x: PROBE_X };
  if (withY) scope.y = PROBE_Y;
  const result: unknown = code.evaluate(scope);
  if (typeof result !== 'number') throw new RowError('Enter a number or a function of x');
}

// --- text handling -----------------------------------------------------------------------

/** Typed symbols the parser doesn't know, mapped onto their ASCII spelling. */
function normalize(input: string): string {
  return input
    .replace(/π/g, 'pi')
    .replace(/[−–—]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=');
}

/** Notation mathjs doesn't take, rewritten into calls it does. */
function rewrite(source: string): string {
  const spelled = source
    .replace(INVERSE_TRIG, 'a$1(')
    .replace(LIST_RANGE, '($1:$2)')
    // mathjs reads `xy` as one name; on a graph it's the product, as in `xy = 4`.
    .replace(/\bxy\b/g, 'x*y')
    .replace(/\byx\b/g, 'y*x');
  return expandLogBase(expandAbsBars(spelled));
}

/** `|x - 2|` → `abs(x - 2)`. Bars alternate open/close; an odd count is left to mathjs. */
function expandAbsBars(source: string): string {
  if (!source.includes('|')) return source;
  let expanded = '';
  let open = false;
  for (const character of source) {
    if (character !== '|') {
      expanded += character;
      continue;
    }
    expanded += open ? ')' : 'abs(';
    open = !open;
  }
  return open ? source : expanded;
}

/** `log_2(32)` → `log(32, 2)`, the two-argument form the scope's `log` already handles. */
function expandLogBase(source: string): string {
  const pattern = /\blog_(\{[^{}]*\}|[A-Za-z0-9.]+)\s*\(/;
  let expanded = source;
  for (let match = pattern.exec(expanded); match; match = pattern.exec(expanded)) {
    const open = match.index + match[0].length - 1;
    const close = matchingParen(expanded, open);
    if (close < 0) break;
    const base = match[1].replace(/[{}]/g, '');
    const inner = expanded.slice(open + 1, close);
    expanded = `${expanded.slice(0, match.index)}log(${inner},${base})${expanded.slice(close + 1)}`;
  }
  return expanded;
}

function matchingParen(source: string, open: number): number {
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '(') depth += 1;
    else if (source[index] === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/** Finds operators outside any bracket, so `max(a, b) > 1` splits at the `>`. */
function findOperators(
  source: string,
  operators: readonly string[],
): { index: number; text: string }[] {
  const found: { index: number; text: string }[] = [];
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '(' || character === '[') depth += 1;
    else if (character === ')' || character === ']') depth -= 1;
    else if (depth === 0) {
      const text = operators.find((operator) => source.startsWith(operator, index));
      // `==` and `!=` aren't supported, but shouldn't be mistaken for an assignment either.
      const doubled = text === '=' && (source[index + 1] === '=' || source[index - 1] === '=');
      if (text && !doubled && !(text === '=' && source[index - 1] === '!')) {
        found.push({ index, text });
        index += text.length - 1;
      }
    }
  }
  return found;
}

/** True when the expression reads `name` as a variable (a call like `f(x)` doesn't count). */
function usesVariable(node: MathNode, name: string): boolean {
  return (
    node.filter(
      (candidate, path, parent) =>
        isSymbol(candidate, name) && !(parent?.type === 'FunctionNode' && path === 'fn'),
    ).length > 0
  );
}

/** True when `name` appears at all, as a variable or as a call. */
function mentions(node: MathNode, name: string): boolean {
  return node.filter((candidate) => isSymbol(candidate, name)).length > 0;
}

function isSymbol(node: MathNode, name: string): boolean {
  return node.type === 'SymbolNode' && (node as SymbolNode).name === name;
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
