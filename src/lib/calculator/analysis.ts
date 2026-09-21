import type { ParsedRow, PointKind, PointOfInterest, SearchRange } from './types';

/** Samples across the visible range — dense enough for SAT curves, cheap enough to redo on a pan. */
const SAMPLES = 900;
/** Bisection halvings; 40 of them take a bracket far below one pixel. */
const REFINE_STEPS = 40;
/** Per curve (or pair of curves), so `sin(100x)` can't flood the list. */
const MAX_PER_SERIES = 24;
const MAX_POINTS = 40;
/** Two points closer than this share a pixel, so they're the same point. */
const DUPLICATE_FRACTION = 1e-4;
/** Step used for the numeric derivative, as a fraction of the visible range. */
const SLOPE_FRACTION = 1e-6;

/** What a point of interest is worth when the list has to be trimmed. */
const RANK: Record<PointKind, number> = {
  intersection: 0,
  root: 1,
  'y-intercept': 2,
  extremum: 3,
};

interface Series {
  index: number;
  at: (x: number) => number;
  /** `at` evaluated at every sample, shared by the root, intersection and extremum passes. */
  values: number[];
  /** Typical size of the curve here, used to tell a root from a pole. */
  scale: number;
}

/**
 * Roots, intersections, extrema and y-intercepts of the plotted functions, found numerically
 * over the visible x-range. Implicit rows and inequalities are skipped.
 */
export function findPointsOfInterest(
  rows: readonly ParsedRow[],
  range: SearchRange,
): PointOfInterest[] {
  const { minX, maxX } = range;
  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || maxX <= minX) return [];

  const span = maxX - minX;
  const step = span / SAMPLES;
  const xs = Array.from({ length: SAMPLES + 1 }, (_, i) => minX + i * step);

  const series: Series[] = [];
  rows.forEach((row, index) => {
    // A fitted regression curve exposes evaluateAt just like a function, and reading a value
    // off a line of best fit is exactly what the scatterplot questions ask for.
    if (row.kind !== 'function' && row.kind !== 'regression') return;
    const values = xs.map((x) => row.evaluateAt(x));
    series.push({ index, at: row.evaluateAt, values, scale: magnitude(values) });
  });
  if (series.length === 0) return [];

  const found: PointOfInterest[] = [];

  for (const curve of series) {
    for (const x of crossings(xs, curve.values, curve.at, curve.scale)) {
      found.push({ x, y: 0, kind: 'root', rowIndexes: [curve.index] });
    }
  }

  for (let i = 0; i < series.length; i += 1) {
    for (let j = i + 1; j < series.length; j += 1) {
      const a = series[i];
      const b = series[j];
      const gap = (x: number) => a.at(x) - b.at(x);
      const values = a.values.map((value, k) => value - b.values[k]);
      for (const x of crossings(xs, values, gap, Math.max(a.scale, b.scale))) {
        const y = a.at(x);
        if (Number.isFinite(y)) {
          found.push({ x, y, kind: 'intersection', rowIndexes: [a.index, b.index] });
        }
      }
    }
  }

  for (const curve of series) {
    found.push(...extrema(xs, curve, span, step));
  }

  if (minX <= 0 && maxX >= 0) {
    for (const curve of series) {
      const y = curve.at(0);
      if (Number.isFinite(y)) {
        found.push({ x: 0, y, kind: 'y-intercept', rowIndexes: [curve.index] });
      }
    }
  }

  return trim(found, span, (minX + maxX) / 2);
}

/**
 * Every sign change of `values`, refined by bisection. A sign change across a pole (`1/x` at 0)
 * is not a crossing, so a candidate only counts once the curve is actually small there.
 */
function crossings(
  xs: readonly number[],
  values: readonly number[],
  at: (x: number) => number,
  scale: number,
): number[] {
  const found: number[] = [];
  const tolerance = Math.max(1e-9, scale * 1e-7);
  for (let i = 0; i + 1 < values.length && found.length < MAX_PER_SERIES; i += 1) {
    const left = values[i];
    const right = values[i + 1];
    if (!Number.isFinite(left) || !Number.isFinite(right)) continue;
    if (left === 0) {
      found.push(xs[i]);
      continue;
    }
    if (right === 0 || left > 0 === right > 0) continue;
    const x = bisect(at, xs[i], xs[i + 1], left);
    if (Math.abs(at(x)) <= tolerance) found.push(x);
  }
  const last = values.length - 1;
  if (values[last] === 0 && found.length < MAX_PER_SERIES) found.push(xs[last]);
  return found;
}

/** Local minima and maxima, from sign changes of a central-difference derivative. */
function extrema(
  xs: readonly number[],
  curve: Series,
  span: number,
  step: number,
): PointOfInterest[] {
  const found: PointOfInterest[] = [];
  const h = span * SLOPE_FRACTION;
  const slope = (x: number) => (curve.at(x + h) - curve.at(x - h)) / (2 * h);
  // The sampled values already say roughly where the slope turns, so the exact derivative
  // is only ever asked for on a bracket that looks promising.
  const rough = curve.values.map((_, i) =>
    i === 0 || i === curve.values.length - 1
      ? Number.NaN
      : curve.values[i + 1] - curve.values[i - 1],
  );

  for (let i = 1; i + 2 < rough.length && found.length < MAX_PER_SERIES; i += 1) {
    const left = rough[i];
    const right = rough[i + 1];
    if (!Number.isFinite(left) || !Number.isFinite(right)) continue;
    if (left !== 0 && left > 0 === right > 0) continue;

    const low = slope(xs[i]);
    const high = slope(xs[i + 1]);
    if (!Number.isFinite(low) || !Number.isFinite(high)) continue;
    let x: number;
    if (low === 0) x = xs[i];
    else if (low > 0 === high > 0) continue;
    else x = bisect(slope, xs[i], xs[i + 1], low);

    const y = curve.at(x);
    const before = curve.at(x - step);
    const after = curve.at(x + step);
    if (!Number.isFinite(y) || !Number.isFinite(before) || !Number.isFinite(after)) continue;
    // Rules out a "turning point" that is really a jump or a pole.
    if (!(y >= before && y >= after) && !(y <= before && y <= after)) continue;
    found.push({ x, y, kind: 'extremum', rowIndexes: [curve.index] });
  }
  return found;
}

function bisect(
  at: (x: number) => number,
  lowX: number,
  highX: number,
  lowValue: number,
): number {
  let low = lowX;
  let high = highX;
  let value = lowValue;
  for (let stepsLeft = REFINE_STEPS; stepsLeft > 0; stepsLeft -= 1) {
    const middle = (low + high) / 2;
    const middleValue = at(middle);
    if (!Number.isFinite(middleValue) || middleValue === 0) return middle;
    if (middleValue > 0 === value > 0) {
      low = middle;
      value = middleValue;
    } else {
      high = middle;
    }
  }
  return (low + high) / 2;
}

/** Median |value| — a size for the curve that a single pole can't distort. */
function magnitude(values: readonly number[]): number {
  const sizes = values.filter((value) => Number.isFinite(value)).map(Math.abs).sort((a, b) => a - b);
  if (sizes.length === 0) return 1;
  const median = sizes[Math.floor(sizes.length / 2)];
  return median > 0 ? median : 1;
}

/** Drops repeats and non-finite points, then keeps the most useful `MAX_POINTS`. */
function trim(points: readonly PointOfInterest[], span: number, center: number): PointOfInterest[] {
  const epsilon = span * DUPLICATE_FRACTION;
  const kept: PointOfInterest[] = [];
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    const repeat = kept.some(
      (other) =>
        other.kind === point.kind &&
        other.rowIndexes.join() === point.rowIndexes.join() &&
        Math.abs(other.x - point.x) <= epsilon,
    );
    if (!repeat) kept.push(point);
  }
  return kept
    .sort(
      (a, b) =>
        RANK[a.kind] - RANK[b.kind] || Math.abs(a.x - center) - Math.abs(b.x - center),
    )
    .slice(0, MAX_POINTS)
    .sort((a, b) => a.x - b.x);
}
