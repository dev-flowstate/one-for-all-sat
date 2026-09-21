/**
 * Least-squares fitting behind the calculator's `~` rows. Pure numerics: the caller supplies a
 * model that evaluates at one data row for a given parameter vector, and gets the fitted
 * parameters back. Nothing here throws — a fit that can't be done comes back as `ok: false`.
 */

/** The model evaluated at data row `index` for a parameter vector. */
export type ModelAt = (parameters: readonly number[], index: number) => number;

export interface Fit {
  parameters: number[];
  /** target − model at the fitted parameters, one per data row. */
  residuals: number[];
  rSquared: number;
}

export type FitResult = { ok: true; fit: Fit } | { ok: false; message: string };

/** Relative step for the numerical Jacobian, narrow enough to track a curved model. */
const DERIVATIVE_STEP = 1e-6;
/**
 * A model affine in its parameters has the same difference quotient at any step, so the two
 * places that count on that — deciding a model is affine, and reading off its design matrix —
 * both take a wide one. A narrow step there would lose the partials to rounding whenever the
 * model carries a large constant term, as `m*x_1 + 1000000` does.
 */
const SECANT_STEP = 1;
/** Two stand-in parameter vectors the partials are compared at, to spot a linear model. */
const FIRST_PROBE = 0.7;
const SECOND_PROBE = 1.9;
/** Spread between a probe's entries, so two parameters are never handed the same value. */
const PROBE_SPREAD = 0.13;
/** How far apart two partials may sit and still count as the same. */
const LINEAR_TOLERANCE = 1e-6;
/** A pivot this small, against the largest entry of the matrix, means the system is singular. */
const SINGULAR = 1e-12;

/**
 * Values every parameter starts at, tried in turn. One flat starting guess isn't enough:
 * `a*e^(k*x) + c` walks off down a flat valley from a positive start and never settles, but
 * reaches the answer in about thirty steps from a small or negative one.
 */
const STARTS = [1, 0.1, -0.5];
const MAX_ITERATIONS = 200;
const INITIAL_DAMPING = 1e-3;
const MIN_DAMPING = 1e-12;
/** Past this, no step of any size improves the fit, so the search has arrived. */
const MAX_DAMPING = 1e12;
/** Relative improvement below which another iteration isn't worth it. */
const SETTLED = 1e-12;

const NOT_EVALUABLE = "This model can't be evaluated on the data";
const UNDERDETERMINED = "There isn't enough data to pin down every parameter";
const NO_FIT = "Couldn't settle on a fit — try a simpler model";

/**
 * Fits `model` to `targets`. A model whose partial derivatives don't depend on its parameters
 * is solved exactly through the normal equations; anything else goes to Levenberg-Marquardt.
 */
export function fitModel(
  model: ModelAt,
  targets: readonly number[],
  parameterCount: number,
): FitResult {
  if (targets.length === 0) return { ok: false, message: 'No data points to fit' };
  if (targets.length < parameterCount) {
    return {
      ok: false,
      message: `Fitting ${parameterCount} parameters needs at least ${parameterCount} points`,
    };
  }
  return isLinearInParameters(model, targets.length, parameterCount)
    ? fitLinear(model, targets, parameterCount)
    : fitIteratively(model, targets, parameterCount);
}

// --- choosing a method -------------------------------------------------------------------

/**
 * True when every ∂model/∂parameter comes out the same at two different parameter vectors,
 * which is exactly the condition for `model(p) = offset + design·p`. A partial that can't be
 * read at all counts as a mismatch, so an awkward model goes the iterative way.
 */
function isLinearInParameters(model: ModelAt, rows: number, parameterCount: number): boolean {
  if (parameterCount === 0) return true;
  const first = jacobian(model, probeVector(parameterCount, FIRST_PROBE), rows, SECANT_STEP);
  const second = jacobian(model, probeVector(parameterCount, SECOND_PROBE), rows, SECANT_STEP);
  return first.every((row, i) => row.every((value, k) => sameSlope(value, second[i][k])));
}

function probeVector(count: number, base: number): number[] {
  return Array.from({ length: count }, (_, k) => base + PROBE_SPREAD * k);
}

function sameSlope(left: number, right: number): boolean {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  return Math.abs(left - right) <= LINEAR_TOLERANCE * Math.max(1, Math.abs(left), Math.abs(right));
}

// --- the linear case ---------------------------------------------------------------------

function fitLinear(model: ModelAt, targets: readonly number[], parameterCount: number): FitResult {
  const rows = targets.length;
  const zeros = new Array<number>(parameterCount).fill(0);
  const design = jacobian(model, zeros, rows, SECANT_STEP);
  // With the partials fixed, the model is `offset + design·parameters`.
  const offsets = Array.from({ length: rows }, (_, i) => model(zeros, i));
  const finite = offsets.every(Number.isFinite) && design.every((row) => row.every(Number.isFinite));
  if (!finite) return { ok: false, message: NOT_EVALUABLE };

  // Unit-length columns keep the normal equations well conditioned whatever the data's scale,
  // and make the singularity test independent of it too.
  const norms = Array.from({ length: parameterCount }, (_, k) =>
    Math.sqrt(design.reduce((total, row) => total + row[k] * row[k], 0)),
  );
  if (norms.some((norm) => !(norm > 0))) return { ok: false, message: UNDERDETERMINED };
  const scaled = design.map((row) => row.map((value, k) => value / norms[k]));

  const gap = targets.map((target, i) => target - offsets[i]);
  const solution = solve(normalMatrix(scaled, parameterCount), project(scaled, gap, parameterCount));
  if (solution === null) return { ok: false, message: UNDERDETERMINED };

  const parameters = solution.map((value, k) => value / norms[k]);
  return summarize(parameters, residualsOf(model, targets, parameters), targets);
}

// --- the iterative case ------------------------------------------------------------------

/** Descends from each starting guess in turn and keeps whichever lands closest to the data. */
function fitIteratively(
  model: ModelAt,
  targets: readonly number[],
  parameterCount: number,
): FitResult {
  let best: FitResult = { ok: false, message: NO_FIT };
  let bestError = Number.POSITIVE_INFINITY;
  for (const start of STARTS) {
    const attempt = descend(model, targets, parameterCount, start);
    if (!attempt.ok) continue;
    const error = sumOfSquares(attempt.fit.residuals);
    if (error < bestError) {
      best = attempt;
      bestError = error;
    }
  }
  return best;
}

/**
 * Levenberg-Marquardt on a numerical Jacobian. Damping is raised whenever a step fails, so a
 * bad step is never taken; once even a tiny step can't improve the fit, we've arrived. A run
 * that uses up its iterations while still moving hasn't found anything worth reporting.
 */
function descend(
  model: ModelAt,
  targets: readonly number[],
  parameterCount: number,
  start: number,
): FitResult {
  const rows = targets.length;
  let parameters = new Array<number>(parameterCount).fill(start);
  let residuals = residualsOf(model, targets, parameters);
  let error = sumOfSquares(residuals);
  if (!Number.isFinite(error)) return { ok: false, message: NOT_EVALUABLE };

  let damping = INITIAL_DAMPING;
  let settled = false;
  for (let iteration = 0; iteration < MAX_ITERATIONS && !settled; iteration += 1) {
    const design = jacobian(model, parameters, rows);
    const normal = normalMatrix(design, parameterCount);
    // Marquardt's scaling: inflating the diagonal slides the step from Gauss-Newton towards
    // a short move down the gradient.
    const damped = normal.map((row, k) =>
      row.map((value, j) => (k === j ? value * (1 + damping) : value)),
    );
    const step = solve(damped, project(design, residuals, parameterCount));

    const candidate = step === null ? null : parameters.map((value, k) => value + step[k]);
    const candidateResiduals = candidate === null ? [] : residualsOf(model, targets, candidate);
    const candidateError = candidate === null ? Number.NaN : sumOfSquares(candidateResiduals);

    if (candidate === null || !(candidateError < error)) {
      damping *= 10;
      settled = damping > MAX_DAMPING;
      continue;
    }

    const improvement = (error - candidateError) / error;
    parameters = candidate;
    residuals = candidateResiduals;
    error = candidateError;
    damping = Math.max(damping / 10, MIN_DAMPING);
    settled = improvement < SETTLED;
  }

  if (!settled) return { ok: false, message: NO_FIT };
  return summarize(parameters, residuals, targets);
}

// --- shared machinery --------------------------------------------------------------------

function summarize(
  parameters: number[],
  residuals: number[],
  targets: readonly number[],
): FitResult {
  if (!parameters.every(Number.isFinite) || !residuals.every(Number.isFinite)) {
    return { ok: false, message: NOT_EVALUABLE };
  }
  return { ok: true, fit: { parameters, residuals, rSquared: rSquaredOf(residuals, targets) } };
}

function rSquaredOf(residuals: readonly number[], targets: readonly number[]): number {
  const mean = targets.reduce((total, target) => total + target, 0) / targets.length;
  const total = targets.reduce((sum, target) => sum + (target - mean) ** 2, 0);
  if (total === 0) return Number.NaN;
  return 1 - sumOfSquares(residuals) / total;
}

function residualsOf(
  model: ModelAt,
  targets: readonly number[],
  parameters: readonly number[],
): number[] {
  return targets.map((target, i) => target - model(parameters, i));
}

function sumOfSquares(values: readonly number[]): number {
  return values.reduce((total, value) => total + value * value, 0);
}

/** ∂model/∂parameter at every data row, by central difference. */
function jacobian(
  model: ModelAt,
  parameters: readonly number[],
  rows: number,
  step = DERIVATIVE_STEP,
): number[][] {
  const steps = parameters.map((value) => step * Math.max(1, Math.abs(value)));
  const forward = parameters.map((value, k) => withValue(parameters, k, value + steps[k]));
  const backward = parameters.map((value, k) => withValue(parameters, k, value - steps[k]));
  return Array.from({ length: rows }, (_, i) =>
    steps.map((step, k) => (model(forward[k], i) - model(backward[k], i)) / (2 * step)),
  );
}

function withValue(parameters: readonly number[], index: number, value: number): number[] {
  const copy = [...parameters];
  copy[index] = value;
  return copy;
}

/** designᵀ · design. */
function normalMatrix(design: readonly number[][], size: number): number[][] {
  return Array.from({ length: size }, (_, k) =>
    Array.from({ length: size }, (_, j) =>
      design.reduce((total, row) => total + row[k] * row[j], 0),
    ),
  );
}

/** designᵀ · values. */
function project(design: readonly number[][], values: readonly number[], size: number): number[] {
  return Array.from({ length: size }, (_, k) =>
    design.reduce((total, row, i) => total + row[k] * values[i], 0),
  );
}

/** Gaussian elimination with partial pivoting; null rather than NaNs when it's singular. */
function solve(matrix: readonly number[][], rhs: readonly number[]): number[] | null {
  const size = rhs.length;
  const rows = matrix.map((row, i) => [...row, rhs[i]]);
  const scale = rows.reduce(
    (largest, row) => row.reduce((value, entry) => Math.max(value, Math.abs(entry)), largest),
    0,
  );
  const tolerance = scale * SINGULAR;

  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    if (!(Math.abs(rows[pivot][column]) > tolerance)) return null;
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    for (let row = column + 1; row < size; row += 1) {
      const factor = rows[row][column] / rows[column][column];
      if (factor === 0) continue;
      for (let entry = column; entry <= size; entry += 1) {
        rows[row][entry] -= factor * rows[column][entry];
      }
    }
  }

  const solution = new Array<number>(size).fill(0);
  for (let row = size - 1; row >= 0; row -= 1) {
    let sum = rows[row][size];
    for (let column = row + 1; column < size; column += 1) sum -= rows[row][column] * solution[column];
    solution[row] = sum / rows[row][row];
  }
  return solution.every(Number.isFinite) ? solution : null;
}
