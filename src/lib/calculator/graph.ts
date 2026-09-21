/** Viewport of the graph paper. One `pixelsPerUnit` for both axes keeps circles round. */
export interface GraphView {
  centerX: number;
  centerY: number;
  pixelsPerUnit: number;
}

export interface GraphPlot {
  color: string;
  evaluateAt: (x: number) => number;
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

const MINOR_GRID_COLOR = '#e8eff4';
const MAJOR_GRID_COLOR = '#cbdde8';
const AXIS_COLOR = '#6c9db8';
const LABEL_COLOR = '#0f3f59';
const LABEL_HALO_COLOR = 'rgba(255, 255, 255, 0.85)';

export function createDefaultView(width: number): GraphView {
  return { centerX: 0, centerY: 0, pixelsPerUnit: Math.max(width, 1) / DEFAULT_X_SPAN };
}

export function valueXAt(view: GraphView, width: number, pixelX: number): number {
  return view.centerX + (pixelX - width / 2) / view.pixelsPerUnit;
}

export function valueYAt(view: GraphView, height: number, pixelY: number): number {
  return view.centerY - (pixelY - height / 2) / view.pixelsPerUnit;
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
  plots: readonly GraphPlot[],
): void {
  const frame: Frame = {
    width,
    height,
    left: valueXAt(view, width, 0),
    right: valueXAt(view, width, width),
    bottom: valueYAt(view, height, height),
    top: valueYAt(view, height, 0),
    pixelX: (x) => width / 2 + (x - view.centerX) * view.pixelsPerUnit,
    pixelY: (y) => height / 2 - (y - view.centerY) * view.pixelsPerUnit,
    valueX: (pixelX) => valueXAt(view, width, pixelX),
  };
  const step = niceStep(GRID_SPACING / view.pixelsPerUnit);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  drawGrid(ctx, frame, step / 5, MINOR_GRID_COLOR);
  drawGrid(ctx, frame, step, MAJOR_GRID_COLOR);
  drawAxes(ctx, frame);

  for (const plot of plots) {
    drawPlot(ctx, frame, plot);
  }

  drawLabels(ctx, frame, step);
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

function drawPlot(ctx: CanvasRenderingContext2D, frame: Frame, plot: GraphPlot): void {
  ctx.strokeStyle = plot.color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();

  let drawing = false;
  let previousValue = Number.NaN;
  let previousPixel = 0;

  for (let px = 0; px <= frame.width; px += 1) {
    const value = plot.evaluateAt(frame.valueX(px));
    if (!Number.isFinite(value)) {
      drawing = false;
      continue;
    }
    const py = frame.pixelY(value);
    // A pole is only possible when consecutive samples sit off opposite edges of the canvas.
    const opposite = (previousPixel < 0 && py > frame.height) || (previousPixel > frame.height && py < 0);
    if (drawing && opposite && isPole(plot.evaluateAt(frame.valueX(px - 0.5)), previousValue, value)) {
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

function drawLabels(ctx: CanvasRenderingContext2D, frame: Frame, step: number): void {
  if (tooDense(frame, step)) return;

  ctx.font = '11px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
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
