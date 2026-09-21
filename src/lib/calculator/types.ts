/**
 * Shared contract between the calculator's expression engine (expression.ts, analysis.ts)
 * and its renderer (graph.ts, components/calculator/*). Both sides are built against this,
 * so it should only change deliberately.
 */

export type AngleMode = 'radians' | 'degrees';

/** A curve or boundary is the set of points where this returns 0; sign tells you which side. */
export type Residual = (x: number, y: number) => number;

/** `y = f(x)` — including a bare `2x + 3`. Returns NaN outside the domain or any restriction. */
export interface FunctionRow {
  kind: 'function';
  evaluateAt: (x: number) => number;
}

/** A relation that isn't solvable for y, e.g. `x^2 + y^2 = 25`. Drawn as the zero contour. */
export interface ImplicitRow {
  kind: 'implicit';
  residual: Residual;
}

/** e.g. `y > 2x + 1`. Shade where `satisfiedAt` holds; draw the boundary dashed when strict. */
export interface InequalityRow {
  kind: 'inequality';
  residual: Residual;
  satisfiedAt: (x: number, y: number) => boolean;
  strict: boolean;
}

/** An x-free expression such as `2+2*7`, shown inline as `= 16`. */
export interface ValueRow {
  kind: 'value';
  value: number;
}

/** `a = 5` or `f(x) = x^2`. Usable by later rows. `value` is set for plain constants. */
export interface DefinitionRow {
  kind: 'definition';
  name: string;
  value: number | null;
  /** True for a constant a slider can drive. */
  slidable: boolean;
}

export interface ErrorRow {
  kind: 'error';
  message: string;
}

export interface EmptyRow {
  kind: 'empty';
}

/** One column of table data, referenced from expressions by name (`x_1`, `y_1`, ...). */
export interface DataColumn {
  name: string;
  /** Blank cells are NaN; rows where either column is NaN are excluded from a fit. */
  values: readonly number[];
}

export interface TableData {
  id: string;
  columns: readonly DataColumn[];
}

/**
 * A fitted model from a `~` row, e.g. `y_1 ~ m*x_1 + b`. Parameters are whatever free
 * symbols the model introduced; the renderer draws it like a function row.
 */
export interface RegressionRow {
  kind: 'regression';
  /** Fitted values keyed by parameter name, e.g. `{ m: 2.1, b: 0.4 }`. */
  parameters: Record<string, number>;
  /** Coefficient of determination for the fit. NaN when it can't be computed. */
  rSquared: number;
  /** Correlation coefficient. Only meaningful for a straight-line fit, else null. */
  r: number | null;
  residuals: readonly number[];
  /** Evaluates the fitted model, so the fit can be plotted over the data. */
  evaluateAt: (x: number) => number;
}

export type ParsedRow =
  | FunctionRow
  | ImplicitRow
  | InequalityRow
  | ValueRow
  | DefinitionRow
  | RegressionRow
  | ErrorRow
  | EmptyRow;

export type PointKind = 'root' | 'intersection' | 'extremum' | 'y-intercept';

export interface PointOfInterest {
  x: number;
  y: number;
  kind: PointKind;
  /** Indexes into the row array this point came from (two entries for an intersection). */
  rowIndexes: number[];
}

/** The x-range currently visible, used to bound numeric searches. */
export interface SearchRange {
  minX: number;
  maxX: number;
}
