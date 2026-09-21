import { all, create } from 'mathjs/number';
import type { AngleMode } from './types';

/** The variables and functions an expression is evaluated against. */
export type Scope = Record<string, unknown>;

/**
 * A private number-only mathjs instance. `matrix: 'Array'` is what makes list literals
 * (`[1,2,3]`, `1:10`) work in this build — the default 'Matrix' setting needs the matrix
 * type, which the number entry point deliberately leaves out.
 */
export const math = create(all, { matrix: 'Array' });

const DEGREES_PER_RADIAN = 180 / Math.PI;

/** Stats take either one list (`stdev([1,2,3])`) or loose arguments (`stdev(1,2,3)`). */
function listOf(args: readonly unknown[]): number[] {
  const values = args.length === 1 && Array.isArray(args[0]) ? (args[0] as unknown[]) : args;
  return values.map((value) => (typeof value === 'number' ? value : Number.NaN));
}

/** Real n-th root, so `nthroot(-8, 3)` is −2 rather than NaN. */
function nthroot(value: number, root = 2): number {
  if (value < 0 && Number.isInteger(root) && Math.abs(root % 2) === 1) {
    return -((-value) ** (1 / root));
  }
  return value ** (1 / root);
}

/**
 * SAT conventions and the handful of names mathjs' number build doesn't ship:
 * `log` is base 10 (mathjs' is natural), `stdev` is the sample deviation and `stdevp`
 * the population one.
 */
const SAT_FUNCTIONS: Scope = {
  log: (value: number, base?: number) =>
    base === undefined ? Math.log10(value) : Math.log(value) / Math.log(base),
  ln: (value: number) => Math.log(value),
  nthroot,
  nCr: (n: number, r: number) => Number(math.combinations(n, r)),
  nPr: (n: number, r: number) => Number(math.permutations(n, r)),
  stdev: (...args: unknown[]) => Number(math.std(listOf(args), 'unbiased')),
  stdevp: (...args: unknown[]) => Number(math.std(listOf(args), 'uncorrected')),
  var: (...args: unknown[]) => Number(math.variance(listOf(args), 'unbiased')),
};

/** `arcsin` etc. are the forms a student types; mathjs only knows `asin`. */
const RADIAN_FUNCTIONS: Scope = {
  arcsin: math.asin,
  arccos: math.acos,
  arctan: math.atan,
  arcsec: math.asec,
  arccsc: math.acsc,
  arccot: math.acot,
};

/** In degree mode trig takes degrees and the inverses hand degrees back. */
function degreeFunctions(): Scope {
  const sin = (angle: number) => Math.sin(angle / DEGREES_PER_RADIAN);
  const cos = (angle: number) => Math.cos(angle / DEGREES_PER_RADIAN);
  const asin = (value: number) => Math.asin(value) * DEGREES_PER_RADIAN;
  const acos = (value: number) => Math.acos(value) * DEGREES_PER_RADIAN;
  const atan = (value: number) => Math.atan(value) * DEGREES_PER_RADIAN;
  // Built from sin/cos rather than 1/tan so that cot(90°) is exactly 0.
  const tan = (angle: number) => sin(angle) / cos(angle);
  const cot = (angle: number) => cos(angle) / sin(angle);
  const asec = (value: number) => acos(1 / value);
  const acsc = (value: number) => asin(1 / value);
  const acot = (value: number) => atan(1 / value);
  return {
    sin,
    cos,
    tan,
    cot,
    sec: (angle: number) => 1 / cos(angle),
    csc: (angle: number) => 1 / sin(angle),
    asin,
    acos,
    atan,
    asec,
    acsc,
    acot,
    arcsin: asin,
    arccos: acos,
    arctan: atan,
    arcsec: asec,
    arccsc: acsc,
    arccot: acot,
  };
}

/** The library every row is evaluated against, before the student's own definitions. */
export function createBaseScope(angleMode: AngleMode): Scope {
  return {
    ...SAT_FUNCTIONS,
    ...(angleMode === 'degrees' ? degreeFunctions() : RADIAN_FUNCTIONS),
  };
}

/** Names a definition may not take over: the graph variables and any built-in function. */
export function isReservedName(name: string): boolean {
  if (name === 'x' || name === 'y') return true;
  if (Object.hasOwn(SAT_FUNCTIONS, name) || Object.hasOwn(RADIAN_FUNCTIONS, name)) return true;
  return typeof (math as unknown as Scope)[name] === 'function';
}
