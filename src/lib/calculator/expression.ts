import type { EvalFunction, MathNode, SymbolNode } from 'mathjs/number';
import { createBaseScope, isReservedName, math } from './scope';
import type { Scope } from './scope';
import type { AngleMode, ParsedRow } from './types';

/** x/y used when probing a row for unknown names — away from poles and domain edges. */
const PROBE_X = 1.2345;
const PROBE_Y = 0.6789;

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

/** A message that is already fit to show the student, as opposed to a mathjs failure. */
class RowError extends Error {}

/**
 * Compiles every row of the expression list in one pass, so a definition in one row is
 * visible to the rows below it. Never throws: a bad row comes back as `kind: 'error'`.
 */
export function compileRows(inputs: readonly string[], angleMode: AngleMode): ParsedRow[] {
  const base = createBaseScope(angleMode);
  const definitions: Scope = {};
  return inputs.map((input) => compileRow(input, base, definitions));
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

function compileRow(input: string, base: Scope, definitions: Scope): ParsedRow {
  const normalized = normalize(input);
  if (!normalized.trim()) return { kind: 'empty' };
  try {
    return buildRow(normalized, { ...base, ...definitions }, definitions);
  } catch (error) {
    return { kind: 'error', message: error instanceof RowError ? error.message : toMessage(error) };
  }
}

function buildRow(normalized: string, snapshot: Scope, definitions: Scope): ParsedRow {
  const { body, conditions } = splitRestrictions(normalized);
  if (!body) throw new RowError('Add an expression before the restriction');
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
