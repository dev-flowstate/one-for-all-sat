/**
 * Click sparks, after React Bits' ClickSpark (reactbits.dev, MIT + Commons Clause): short
 * strokes that shoot out from a point and fade. Drawn square-ended to suit the pixel look.
 * One fixed canvas over the page, created on the first burst and idle (no animation frame
 * running) whenever nothing is on screen. Nothing is drawn for people who've asked their
 * system for reduced motion.
 */

interface BurstOptions {
  /** CSS colours, or custom properties such as '--color-success'. Picked from at random. */
  colors?: string[];
  count?: number;
  /** How far the sparks travel, in CSS pixels. */
  radius?: number;
  /** Length of each spark at the start. */
  size?: number;
  width?: number;
  durationMs?: number;
}

interface Burst {
  x: number;
  y: number;
  start: number;
  angles: number[];
  colors: string[];
  radius: number;
  size: number;
  width: number;
  duration: number;
}

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let frame = 0;
const bursts: Burst[] = [];

function ensureCanvas(): CanvasRenderingContext2D | null {
  if (ctx && canvas?.isConnected) return ctx;
  canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '60',
  });
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d');
  return ctx;
}

function fitCanvas() {
  if (!canvas || !ctx) return;
  const ratio = window.devicePixelRatio || 1;
  const w = Math.round(window.innerWidth * ratio);
  const h = Math.round(window.innerHeight * ratio);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function resolveColor(color: string): string {
  if (!color.startsWith('--')) return color;
  return getComputedStyle(document.documentElement).getPropertyValue(color).trim() || '#000';
}

function draw(now: number) {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = 'butt';

  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    const t = (now - b.start) / b.duration;
    if (t >= 1) {
      bursts.splice(i, 1);
      continue;
    }
    const eased = 1 - Math.pow(1 - t, 3);
    const distance = eased * b.radius;
    const length = b.size * (1 - eased);
    ctx.lineWidth = b.width;
    b.angles.forEach((angle, k) => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      ctx!.strokeStyle = b.colors[k % b.colors.length];
      ctx!.beginPath();
      ctx!.moveTo(b.x + distance * cos, b.y + distance * sin);
      ctx!.lineTo(b.x + (distance + length) * cos, b.y + (distance + length) * sin);
      ctx!.stroke();
    });
  }

  frame = bursts.length ? requestAnimationFrame(draw) : 0;
}

export function sparkAt(x: number, y: number, options: BurstOptions = {}) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!ensureCanvas()) return;
  fitCanvas();

  const count = options.count ?? 8;
  const offset = Math.random() * Math.PI;
  bursts.push({
    x,
    y,
    start: performance.now(),
    angles: Array.from({ length: count }, (_, i) => offset + (2 * Math.PI * i) / count),
    colors: (options.colors ?? ['--color-ink']).map(resolveColor),
    radius: options.radius ?? 22,
    size: options.size ?? 10,
    width: options.width ?? 3,
    duration: options.durationMs ?? 420,
  });
  if (!frame) frame = requestAnimationFrame(draw);
}

/** A burst from the middle of an element, e.g. the verdict bar of a correct answer. */
export function sparkFrom(el: Element, options?: BurstOptions) {
  const r = el.getBoundingClientRect();
  sparkAt(r.left + r.width / 2, r.top + r.height / 2, options);
}
