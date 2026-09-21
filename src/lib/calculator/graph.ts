import type { FunctionRow, ImplicitRow, InequalityRow, PointKind, Residual } from './types';

/** Viewport of the graph paper. One `pixelsPerUnit` for both axes keeps circles round. */
export interface GraphView {
  centerX: number;
  centerY: number;
  pixelsPerUnit: number;
}

/** One drawable row plus the colour of its entry in the expression list. */
export interface GraphLayer {
  color: string;
  row: FunctionRow | ImplicitRow | InequalityRow;
}

/** A point of interest, already coloured and labelled by the expression list. */
export interface GraphPoint {
  x: number;
  y: number;
  kind: PointKind;
  color: string;
  /** Pre-formatted coordinates, e.g. `(2, 0)`. */
  label: string;
}

export interface GraphScene {
  layers: readonly GraphLayer[];
  points: readonly GraphPoint[];
  /** Index into `points` of the one showing its label (hovered or tapped), or -1 for none. */
  activeIndex: number;
}

/** Everything the drawing helpers need about the current canvas + viewport. */
interface Frame {
  width: number;
  height: number;
  left: number;
  right: number;
  bottom: number;
  top: number;
  /** Graph x → canvas pixel. */
  pixelX: (x: number) => number;
  /** Graph y → canvas pixel. */
  pixelY: (y: number) => number;
  /** Canvas pixel → graph x. */
  valueX: (pixelX: number) => number;
  /** Canvas pixel → graph y. */
  valueY: (pixelY: number) => number;
}

const MIN_PIXELS_PER_UNIT = 1e-6;
const MAX_PIXELS_PER_UNIT = 1e9;
/** Units of x visible at the default zoom, matching Desmos' −10…10 starting view. */
const DEFAULT_X_SPAN = 20;
/** Target gap in pixels between labelled gridlines. */
const GRID_SPACING = 72;
/** Gridlines are skipped entirely once this many would be drawn on one axis. */
const MAX_GRID_LINES = 400;
/** Off-screen clamp for plotted points, so huge values never reach the canvas path. */
const OFFSCREEN = 1e5;

/**
 * Contours and shaded regions sample the viewport on a square grid. The budget caps how many
 * samples one layer may take per frame so panning stays smooth on a large canvas; the floor
 * keeps the grid from getting so fine that a small canvas pays for detail nobody can see.
 */
const SAMPLE_BUDGET = 4200;
const MIN_CELL = 6;
/** Translucency of an inequality's shaded region. */
const REGION_ALPHA = 0.16;
const DASH_PATTERN = [6, 5];
/**
 * A contour segment is dropped when the residual at its midpoint is this many times larger
 * than the cell's own corner values — the 2D counterpart of `isPole` below.
 */
const POLE_FACTOR = 4;

const POINT_RADIUS = 4.5;
/** Pixels a point of interest may sit outside the canvas before it stops being drawn. */
const POINT_MARGIN = 8;
const TAU = Math.PI * 2;

const FONT_STACK = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
const MINOR_GRID_COLOR = '#e8eff4';
const MAJOR_GRID_COLOR = '#cbdde8';
const AXIS_COLOR = '#6c9db8';
const LABEL_COLOR = '#0f3f59';
const LABEL_HALO_COLOR = 'rgba(255, 255, 255, 0.85)';
const SURFACE_COLOR = '#ffffff';

export function createDefaultView(width: number): GraphView {
  return { centerX: 0, centerY: 0, pixelsPerUnit: Math.max(width, 1) / DEFAULT_X_SPAN };
}

export function valueXAt(view: GraphView, width: number, pixelX: number): number {
  return view.centerX + (pixelX - width / 2) / view.pixelsPerUnit;
}

export function valueYAt(view: GraphView, height: number, pixelY: number): number {
  return view.centerY - (pixelY - height / 2) / view.pixelsPerUnit;
}

export function pixelXAt(view: GraphView, width: number, x: number): number {
  return width / 2 + (x - view.centerX) * view.pixelsPerUnit;
}

export function pixelYAt(view: GraphView, height: number, y: number): number {
  return height / 2 - (y - view.centerY) * view.pixelsPerUnit;
}

/** Drags the graph by a pixel delta (content follows the finger/cursor). */
export function panView(view: GraphView, deltaX: number, deltaY: number): GraphView {
  return {
    pixelsPerUnit: view.pixelsPerUnit,
    centerX: view.centerX - deltaX / view.pixelsPerUnit,
    centerY: view.centerY + deltaY / view.pixelsPerUnit,
  };
}

/** Zooms by `factor` while keeping the graph point under (anchorX, anchorY) in place. */
export function zoomView(
  view: GraphView,
  factor: number,
  anchorX: number,
  anchorY: number,
  width: number,
  height: number,
): GraphView {
  const pixelsPerUnit = clamp(view.pixelsPerUnit * factor, MIN_PIXELS_PER_UNIT, MAX_PIXELS_PER_UNIT);
  return {
    pixelsPerUnit,
    centerX: valueXAt(view, width, anchorX) - (anchorX - width / 2) / pixelsPerUnit,
    centerY: valueYAt(view, height, anchorY) + (anchorY - height / 2) / pixelsPerUnit,
  };
}

export function drawGraph(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  view: GraphView,
  scene: GraphScene,
): void {
  const frame: Frame = {
    width,
    height,
    left: valueXAt(view, width, 0),
    right: valueXAt(view, width, width),
    bottom: valueYAt(view, height, height),
    top: valueYAt(view, height, 0),
    pixelX: (x) => pixelXAt(view, width, x),
    pixelY: (y) => pixelYAt(view, height, y),
    valueX: (pixelX) => valueXAt(view, width, pixelX),
    valueY: (pixelY) => valueYAt(view, height, pixelY),
  };
  const step = niceStep(GRID_SPACING / view.pixelsPerUnit);

  ctx.fillStyle = SURFACE_COLOR;
  ctx.fillRect(0, 0, width, height);

  drawGrid(ctx, frame, step / 5, MINOR_GRID_COLOR);
  drawGrid(ctx, frame, step, MAJOR_GRID_COLOR);
  drawAxes(ctx, frame);

  // Shading goes down in its own pass so no region ever covers another row's curve.
  for (const layer of scene.layers) {
    if (layer.row.kind === 'inequality') fillRegion(ctx, frame, layer.color, layer.row.satisfiedAt);
  }
  for (const layer of scene.layers) {
    drawLayer(ctx, frame, layer);
  }

  drawLabels(ctx, frame, step);
  drawPoints(ctx, frame, scene);
}

function drawLayer(ctx: CanvasRenderingContext2D, frame: Frame, layer: GraphLayer): void {
  switch (layer.row.kind) {
    case 'function':
      drawPlot(ctx, frame, layer.color, layer.row.evaluateAt);
      return;
    case 'implicit':
      strokeContour(ctx, frame, layer.color, layer.row.residual, false);
      return;
    case 'inequality':
      strokeContour(ctx, frame, layer.color, layer.row.residual, layer.row.strict);
      return;
  }
}

function tooDense(frame: Frame, spacing: number): boolean {
  return (
    (frame.right - frame.left) / spacing > MAX_GRID_LINES ||
    (frame.top - frame.bottom) / spacing > MAX_GRID_LINES
  );
}

function drawGrid(ctx: CanvasRenderingContext2D, frame: Frame, spacing: number, color: string): void {
  if (tooDense(frame, spacing)) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = Math.ceil(frame.left / spacing); i <= Math.floor(frame.right / spacing); i += 1) {
    const x = Math.round(frame.pixelX(i * spacing)) + 0.5;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, frame.height);
  }
  for (let i = Math.ceil(frame.bottom / spacing); i <= Math.floor(frame.top / spacing); i += 1) {
    const y = Math.round(frame.pixelY(i * spacing)) + 0.5;
    ctx.moveTo(0, y);
    ctx.lineTo(frame.width, y);
  }
  ctx.stroke();
}

function drawAxes(ctx: CanvasRenderingContext2D, frame: Frame): void {
  ctx.strokeStyle = AXIS_COLOR;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const axisY = frame.pixelY(0);
  if (axisY >= 0 && axisY <= frame.height) {
    ctx.moveTo(0, Math.round(axisY) + 0.5);
    ctx.lineTo(frame.width, Math.round(axisY) + 0.5);
  }
  const axisX = frame.pixelX(0);
  if (axisX >= 0 && axisX <= frame.width) {
    ctx.moveTo(Math.round(axisX) + 0.5, 0);
    ctx.lineTo(Math.round(axisX) + 0.5, frame.height);
  }
  ctx.stroke();
}

function drawPlot(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  color: string,
  evaluateAt: (x: number) => number,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();

  let drawing = false;
  let previousValue = Number.NaN;
  let previousPixel = 0;

  for (let px = 0; px <= frame.width; px += 1) {
    const value = evaluateAt(frame.valueX(px));
    if (!Number.isFinite(value)) {
      drawing = false;
      continue;
    }
    const py = frame.pixelY(value);
    // A pole is only possible when consecutive samples sit off opposite edges of the canvas.
    const opposite = (previousPixel < 0 && py > frame.height) || (previousPixel > frame.height && py < 0);
    if (drawing && opposite && isPole(evaluateAt(frame.valueX(px - 0.5)), previousValue, value)) {
      drawing = false;
    }
    const clamped = clamp(py, -OFFSCREEN, frame.height + OFFSCREEN);
    if (drawing) {
      ctx.lineTo(px, clamped);
    } else {
      ctx.moveTo(px, clamped);
      drawing = true;
    }
    previousValue = value;
    previousPixel = py;
  }

  ctx.stroke();
}

/**
 * Tells a vertical asymptote apart from a merely very steep function, so `1/x` and `tan(x)`
 * aren't joined across the gap: at a pole the midpoint sample shoots outside the two
 * surrounding samples, while a steep function stays between them.
 */
function isPole(middle: number, previous: number, current: number): boolean {
  if (!Number.isFinite(middle)) return true;
  return middle < Math.min(previous, current) || middle > Math.max(previous, current);
}

/** Side of a square grid cell, in canvas pixels, for contour and region sampling. */
function cellSize(frame: Frame): number {
  return Math.max(MIN_CELL, Math.sqrt((frame.width * frame.height) / SAMPLE_BUDGET));
}

/**
 * Draws the zero contour of `residual` with marching squares: the viewport is sampled on a
 * square grid, and every cell whose corners don't all share a sign contributes a short segment
 * between the interpolated crossings on its edges. That draws `x^2 + y^2 = 25` as a round
 * circle rather than as a staircase, and handles curves no `y = f(x)` can express.
 */
function strokeContour(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  color: string,
  residual: Residual,
  dashed: boolean,
): void {
  const cell = cellSize(frame);
  const columns = Math.ceil(frame.width / cell);
  const rows = Math.ceil(frame.height / cell);
  const values = new Float64Array((columns + 1) * (rows + 1));
  for (let j = 0; j <= rows; j += 1) {
    const y = frame.valueY(j * cell);
    for (let i = 0; i <= columns; i += 1) {
      values[j * (columns + 1) + i] = residual(frame.valueX(i * cell), y);
    }
  }

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  if (dashed) ctx.setLineDash(DASH_PATTERN);
  ctx.beginPath();

  // Largest corner magnitude of the cell being emitted, used to reject segments across a pole.
  let extreme = 0;
  const segment = (ax: number, ay: number, bx: number, by: number) => {
    const middle = residual(frame.valueX((ax + bx) / 2), frame.valueY((ay + by) / 2));
    if (!Number.isFinite(middle) || Math.abs(middle) > POLE_FACTOR * extreme) return;
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
  };

  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < columns; i += 1) {
      const topLeft = values[j * (columns + 1) + i];
      const topRight = values[j * (columns + 1) + i + 1];
      const bottomRight = values[(j + 1) * (columns + 1) + i + 1];
      const bottomLeft = values[(j + 1) * (columns + 1) + i];
      if (
        !Number.isFinite(topLeft) ||
        !Number.isFinite(topRight) ||
        !Number.isFinite(bottomRight) ||
        !Number.isFinite(bottomLeft)
      ) {
        continue;
      }
      const corners =
        (topLeft > 0 ? 1 : 0) |
        (topRight > 0 ? 2 : 0) |
        (bottomRight > 0 ? 4 : 0) |
        (bottomLeft > 0 ? 8 : 0);
      if (corners === 0 || corners === 15) continue;

      const x0 = i * cell;
      const y0 = j * cell;
      const x1 = x0 + cell;
      const y1 = y0 + cell;
      // Crossing points on each edge. Only the ones the case below reads are meaningful.
      const onTop = x0 + cell * crossing(topLeft, topRight);
      const onBottom = x0 + cell * crossing(bottomLeft, bottomRight);
      const onLeft = y0 + cell * crossing(topLeft, bottomLeft);
      const onRight = y0 + cell * crossing(topRight, bottomRight);
      extreme = Math.max(
        Math.abs(topLeft),
        Math.abs(topRight),
        Math.abs(bottomRight),
        Math.abs(bottomLeft),
      );

      // Swapping the inside and the outside gives the same segments, except for the two saddle
      // cases (5 and 10) where it picks the other pairing — so those are handled separately.
      const shape = corners !== 5 && corners !== 10 && corners > 7 ? 15 - corners : corners;
      switch (shape) {
        case 1:
        case 14:
          segment(x0, onLeft, onTop, y0);
          break;
        case 2:
        case 13:
          segment(onTop, y0, x1, onRight);
          break;
        case 3:
        case 12:
          segment(x0, onLeft, x1, onRight);
          break;
        case 4:
        case 11:
          segment(x1, onRight, onBottom, y1);
          break;
        case 5:
          segment(x0, onLeft, onTop, y0);
          segment(x1, onRight, onBottom, y1);
          break;
        case 6:
        case 9:
          segment(onTop, y0, onBottom, y1);
          break;
        case 7:
        case 8:
          segment(x0, onLeft, onBottom, y1);
          break;
        case 10:
          segment(onTop, y0, x1, onRight);
          segment(x0, onLeft, onBottom, y1);
          break;
      }
    }
  }

  ctx.stroke();
  ctx.restore();
}

/** Where between two corner values the residual passes through zero, as a 0…1 fraction. */
function crossing(from: number, to: number): number {
  return from / (from - to);
}

/**
 * Shades where an inequality holds. Cells are tested at their centre and merged into horizontal
 * runs, and the whole region is one path so overlapping runs never darken a seam. The boundary
 * is drawn separately at full resolution, which hides the grid's stair-stepping.
 */
function fillRegion(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  color: string,
  satisfiedAt: (x: number, y: number) => boolean,
): void {
  const cell = cellSize(frame);
  const columns = Math.ceil(frame.width / cell);
  const rows = Math.ceil(frame.height / cell);

  ctx.save();
  ctx.globalAlpha = REGION_ALPHA;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let j = 0; j < rows; j += 1) {
    const top = j * cell;
    const y = frame.valueY(top + cell / 2);
    let runStart = -1;
    for (let i = 0; i <= columns; i += 1) {
      const inside = i < columns && satisfiedAt(frame.valueX(i * cell + cell / 2), y);
      if (inside) {
        if (runStart < 0) runStart = i * cell;
      } else if (runStart >= 0) {
        ctx.rect(runStart, top, i * cell - runStart, cell);
        runStart = -1;
      }
    }
  }
  ctx.fill();
  ctx.restore();
}

function drawPoints(ctx: CanvasRenderingContext2D, frame: Frame, scene: GraphScene): void {
  let labelled = -1;

  for (let index = 0; index < scene.points.length; index += 1) {
    const point = scene.points[index];
    const px = frame.pixelX(point.x);
    const py = frame.pixelY(point.y);
    if (
      px < -POINT_MARGIN ||
      px > frame.width + POINT_MARGIN ||
      py < -POINT_MARGIN ||
      py > frame.height + POINT_MARGIN
    ) {
      continue;
    }
    const isActive = index === scene.activeIndex;
    if (isActive) labelled = index;
    // Roots and intersections are what an SAT question asks for, so they read as solid dots;
    // extrema and y-intercepts are hollow so they stay in the background.
    const solid = point.kind === 'root' || point.kind === 'intersection';
    const radius = (solid ? POINT_RADIUS : POINT_RADIUS - 1) + (isActive ? 1.5 : 0);

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, TAU);
    ctx.fillStyle = solid ? point.color : SURFACE_COLOR;
    ctx.strokeStyle = solid ? SURFACE_COLOR : point.color;
    ctx.fill();
    ctx.stroke();

    // An intersection gets a hole punched in it, so two curves meeting reads differently
    // from one curve crossing the x-axis.
    if (point.kind === 'intersection') {
      ctx.beginPath();
      ctx.arc(px, py, radius - 2.4, 0, TAU);
      ctx.fillStyle = SURFACE_COLOR;
      ctx.fill();
    }
  }

  // Drawn last so the bubble is never covered by a marker behind it.
  if (labelled >= 0) drawPointLabel(ctx, frame, scene.points[labelled]);
}

/** Coordinate bubble for the hovered or tapped point, nudged to stay inside the canvas. */
function drawPointLabel(ctx: CanvasRenderingContext2D, frame: Frame, point: GraphPoint): void {
  ctx.font = `12px ${FONT_STACK}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const boxWidth = ctx.measureText(point.label).width + 14;
  const boxHeight = 22;
  const px = frame.pixelX(point.x);
  const py = frame.pixelY(point.y);
  const flipX = px + 12 + boxWidth > frame.width - 4;
  const flipY = py - 12 - boxHeight < 4;
  const boxX = clamp(flipX ? px - 12 - boxWidth : px + 12, 4, Math.max(4, frame.width - boxWidth - 4));
  const boxY = clamp(flipY ? py + 12 : py - 12 - boxHeight, 4, Math.max(4, frame.height - boxHeight - 4));

  ctx.beginPath();
  roundedRect(ctx, boxX, boxY, boxWidth, boxHeight, 6);
  ctx.fillStyle = SURFACE_COLOR;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = point.color;
  ctx.stroke();

  ctx.fillStyle = LABEL_COLOR;
  ctx.fillText(point.label, boxX + 7, boxY + boxHeight / 2);
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function drawLabels(ctx: CanvasRenderingContext2D, frame: Frame, step: number): void {
  if (tooDense(frame, step)) return;

  ctx.font = `11px ${FONT_STACK}`;
  ctx.fillStyle = LABEL_COLOR;
  ctx.strokeStyle = LABEL_HALO_COLOR;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';

  const labelRow = clamp(frame.pixelY(0), 0, frame.height - 15) + 3;
  ctx.textBaseline = 'top';
  for (let i = Math.ceil(frame.left / step); i <= Math.floor(frame.right / step); i += 1) {
    const label = formatTick(i * step, step);
    // The zero label would sit on top of the y-axis, so nudge it to the axis' left.
    ctx.textAlign = i === 0 ? 'right' : 'center';
    const x = frame.pixelX(i * step) + (i === 0 ? -4 : 0);
    ctx.strokeText(label, x, labelRow);
    ctx.fillText(label, x, labelRow);
  }

  const yAxisVisible = frame.pixelX(0) >= 0 && frame.pixelX(0) <= frame.width;
  const labelColumn = clamp(frame.pixelX(0), 26, frame.width - 4) - 5;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = Math.ceil(frame.bottom / step); i <= Math.floor(frame.top / step); i += 1) {
    if (i === 0 && yAxisVisible) continue;
    const label = formatTick(i * step, step);
    ctx.strokeText(label, labelColumn, frame.pixelY(i * step));
    ctx.fillText(label, labelColumn, frame.pixelY(i * step));
  }
}

/** Rounds a rough spacing to the nearest 1, 2 or 5 times a power of ten. */
function niceStep(rough: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const multiplier = normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1;
  return multiplier * magnitude;
}

function formatTick(value: number, step: number): string {
  if (Math.abs(value) < step / 2) return '0';
  if (Math.abs(value) >= 1e7 || Math.abs(value) < 1e-4) return value.toExponential(0);
  const decimals = clamp(-Math.floor(Math.log10(step) + 1e-9), 0, 8);
  return value.toFixed(decimals);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
