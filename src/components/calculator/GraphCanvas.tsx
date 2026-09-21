import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  createDefaultView,
  drawGraph,
  panView,
  pixelXAt,
  pixelYAt,
  valueXAt,
  zoomView,
} from '../../lib/calculator/graph';
import type { GraphLayer, GraphPoint, GraphScatter, GraphView } from '../../lib/calculator/graph';
import type { PointKind, SearchRange } from '../../lib/calculator/types';

interface GraphCanvasProps {
  layers: readonly GraphLayer[];
  /** One entry per data table, drawn as markers. */
  scatters: readonly GraphScatter[];
  /** Asked for the points to mark, once the view has settled. */
  findPoints: (range: SearchRange) => readonly GraphPoint[];
}

interface Point {
  x: number;
  y: number;
}

const BUTTON_CLASS =
  'press flex h-10 w-10 items-center justify-center border-2 border-ink bg-paper text-base leading-none font-semibold text-ink shadow-[3px_3px_0_var(--color-ink)] hover:bg-rock-blue';

/** Zoom applied by one tap of the +/− buttons. */
const BUTTON_ZOOM = 1.6;
/** Stillness (ms) before points of interest are searched again — a drag would thrash it. */
const SETTLE_DELAY = 180;
/** How close a cursor or fingertip has to get to a point to read its coordinates. */
const HIT_RADIUS = 16;
/** A pointer that moves further than this was a drag, not a tap. */
const TAP_SLOP = 6;
/** Points closer together than this on screen collapse to one, so labels can't pile up. */
const MERGE_DISTANCE = 10;
const MAX_POINTS = 40;
/** Points this far outside the canvas aren't worth keeping. */
const OFF_CANVAS = 8;

/** Which point wins when several land on the same spot: the ones SAT questions ask about. */
const KIND_PRIORITY: Record<PointKind, number> = {
  intersection: 0,
  root: 1,
  'y-intercept': 2,
  extremum: 3,
};

/**
 * Graph paper that draws every layer on a 2D canvas. The viewport lives in a ref rather than
 * state so dragging and pinching redraw straight from the gesture without a React re-render.
 */
export function GraphCanvas({ layers, scatters, findPoints }: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<GraphView | null>(null);
  const layersRef = useRef<readonly GraphLayer[]>(layers);
  const scattersRef = useRef<readonly GraphScatter[]>(scatters);
  const findPointsRef = useRef(findPoints);
  const pointsRef = useRef<readonly GraphPoint[]>([]);
  const activeRef = useRef(-1);
  const frameRef = useRef(0);
  const settleRef = useRef(0);
  const pointersRef = useRef(new Map<number, Point>());
  const pinchRef = useRef<{ distance: number; center: Point } | null>(null);
  const gestureRef = useRef<{ start: Point; moved: boolean } | null>(null);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    // The panel hides itself with `display: none`; nothing to draw until it's visible again.
    if (width === 0 || height === 0) return;

    const ratio = window.devicePixelRatio || 1;
    const backingWidth = Math.round(width * ratio);
    const backingHeight = Math.round(height * ratio);
    if (canvas.width !== backingWidth) canvas.width = backingWidth;
    if (canvas.height !== backingHeight) canvas.height = backingHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    viewRef.current ??= createDefaultView(width);
    drawGraph(ctx, width, height, viewRef.current, {
      layers: layersRef.current,
      scatters: scattersRef.current,
      points: pointsRef.current,
      activeIndex: activeRef.current,
    });
  }, []);

  const scheduleRender = useCallback(() => {
    if (frameRef.current !== 0) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = 0;
      render();
    });
  }, [render]);

  /** Searches the visible x-range for points of interest. Costly, so never on a drag frame. */
  const refreshPoints = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;

    const view = (viewRef.current ??= createDefaultView(width));
    const found = findPointsRef.current({
      minX: valueXAt(view, width, 0),
      maxX: valueXAt(view, width, width),
    });
    pointsRef.current = thinPoints(found, view, width, height);
    // Indexes have just shifted, so whatever was labelled no longer means anything.
    activeRef.current = -1;
    scheduleRender();
  }, [scheduleRender]);

  const schedulePoints = useCallback(() => {
    if (settleRef.current !== 0) window.clearTimeout(settleRef.current);
    settleRef.current = window.setTimeout(() => {
      settleRef.current = 0;
      refreshPoints();
    }, SETTLE_DELAY);
  }, [refreshPoints]);

  const setActive = useCallback(
    (index: number) => {
      if (activeRef.current === index) return;
      activeRef.current = index;
      scheduleRender();
    },
    [scheduleRender],
  );

  useEffect(() => {
    layersRef.current = layers;
    scheduleRender();
  }, [layers, scheduleRender]);

  useEffect(() => {
    scattersRef.current = scatters;
    scheduleRender();
  }, [scatters, scheduleRender]);

  useEffect(() => {
    findPointsRef.current = findPoints;
    schedulePoints();
  }, [findPoints, schedulePoints]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      scheduleRender();
      schedulePoints();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [scheduleRender, schedulePoints]);

  // React attaches `wheel` passively, so the listener has to be native to stop page scroll.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const view = viewRef.current;
      if (!view) return;
      const rect = canvas.getBoundingClientRect();
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      viewRef.current = zoomView(
        view,
        Math.exp(-delta * 0.002),
        event.clientX - rect.left,
        event.clientY - rect.top,
        rect.width,
        rect.height,
      );
      scheduleRender();
      schedulePoints();
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [scheduleRender, schedulePoints]);

  useEffect(
    () => () => {
      if (frameRef.current !== 0) {
        window.cancelAnimationFrame(frameRef.current);
        // Must clear the id too: scheduleRender treats a non-zero ref as "a frame is already
        // queued". Leaving a cancelled id here jams the scheduler permanently, which is exactly
        // what happens on StrictMode's mount/cleanup/mount cycle — the canvas never draws.
        frameRef.current = 0;
      }
      if (settleRef.current !== 0) {
        window.clearTimeout(settleRef.current);
        settleRef.current = 0;
      }
    },
    [],
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    canvas.setPointerCapture(event.pointerId);
    const position = pointIn(canvas, event);
    pointersRef.current.set(event.pointerId, position);
    pinchRef.current = measurePinch(pointersRef.current);
    // A second finger is always a pinch, never a tap on a point.
    gestureRef.current =
      pointersRef.current.size === 1 ? { start: position, moved: false } : { start: position, moved: true };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const pointers = pointersRef.current;
    const position = pointIn(canvas, event);

    if (pointers.size === 0) {
      // Hovering. Touch devices have no hover, so they get the tap handling below instead.
      if (event.pointerType !== 'touch') {
        setActive(hitTest(pointsRef.current, viewRef.current, canvas, position));
      }
      return;
    }

    const previous = pointers.get(event.pointerId);
    const view = viewRef.current;
    if (!previous || !view) return;
    pointers.set(event.pointerId, position);

    const gesture = gestureRef.current;
    if (gesture && Math.hypot(position.x - gesture.start.x, position.y - gesture.start.y) > TAP_SLOP) {
      gesture.moved = true;
    }

    if (pointers.size === 1) {
      viewRef.current = panView(view, position.x - previous.x, position.y - previous.y);
    } else {
      const pinch = measurePinch(pointers);
      const start = pinchRef.current;
      pinchRef.current = pinch;
      if (!pinch || !start || start.distance === 0) return;
      const zoomed = zoomView(
        view,
        pinch.distance / start.distance,
        pinch.center.x,
        pinch.center.y,
        canvas.clientWidth,
        canvas.clientHeight,
      );
      viewRef.current = panView(zoomed, pinch.center.x - start.center.x, pinch.center.y - start.center.y);
    }
    scheduleRender();
    schedulePoints();
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLCanvasElement>, tappable: boolean) => {
    const canvas = event.currentTarget;
    const position = pointIn(canvas, event);
    const gesture = gestureRef.current;
    pointersRef.current.delete(event.pointerId);
    pinchRef.current = measurePinch(pointersRef.current);
    if (pointersRef.current.size === 0) gestureRef.current = null;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }

    if (tappable && gesture && !gesture.moved) {
      // A tap on a point pins its coordinates; tapping it again (or empty paper) clears them.
      const hit = hitTest(pointsRef.current, viewRef.current, canvas, position);
      setActive(hit === activeRef.current ? -1 : hit);
    }
  };

  const handlePointerLeave = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType !== 'touch' && pointersRef.current.size === 0) setActive(-1);
  };

  const zoomFromCenter = (factor: number) => {
    const canvas = canvasRef.current;
    const view = viewRef.current;
    if (!canvas || !view) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    viewRef.current = zoomView(view, factor, width / 2, height / 2, width, height);
    scheduleRender();
    schedulePoints();
  };

  const resetView = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    viewRef.current = createDefaultView(canvas.clientWidth);
    scheduleRender();
    schedulePoints();
  };

  return (
    <div className="relative h-full w-full overflow-hidden border-2 border-ink bg-paper">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Graph of the entered expressions. Drag to pan, pinch or scroll to zoom. Hover or tap a marked point to read its coordinates."
        className="block h-full w-full cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => handlePointerEnd(event, true)}
        onPointerCancel={(event) => handlePointerEnd(event, false)}
        onPointerLeave={handlePointerLeave}
      />
      <div className="absolute right-2 top-2 flex flex-col gap-1">
        <button type="button" className={BUTTON_CLASS} onClick={() => zoomFromCenter(BUTTON_ZOOM)} aria-label="Zoom in">
          +
        </button>
        <button
          type="button"
          className={BUTTON_CLASS}
          onClick={() => zoomFromCenter(1 / BUTTON_ZOOM)}
          aria-label="Zoom out"
        >
          −
        </button>
        <button type="button" className={BUTTON_CLASS} onClick={resetView} aria-label="Reset view">
          ⌂
        </button>
      </div>
    </div>
  );
}

function pointIn(canvas: HTMLCanvasElement, event: ReactPointerEvent<HTMLCanvasElement>): Point {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

/** Distance and midpoint of the first two active pointers, or null when there aren't two. */
function measurePinch(pointers: Map<number, Point>): { distance: number; center: Point } | null {
  const [first, second] = [...pointers.values()];
  if (!first || !second) return null;
  return {
    distance: Math.hypot(second.x - first.x, second.y - first.y),
    center: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
  };
}

/**
 * Drops points that are off-screen or that would overlap one already kept, so a zoomed-out
 * `sin(x)` marks a readable handful of roots instead of a solid line of dots.
 */
function thinPoints(
  points: readonly GraphPoint[],
  view: GraphView,
  width: number,
  height: number,
): GraphPoint[] {
  const visible = points
    .map((point) => ({
      point,
      px: pixelXAt(view, width, point.x),
      py: pixelYAt(view, height, point.y),
    }))
    .filter(
      ({ px, py }) =>
        px >= -OFF_CANVAS && px <= width + OFF_CANVAS && py >= -OFF_CANVAS && py <= height + OFF_CANVAS,
    )
    .sort((a, b) => KIND_PRIORITY[a.point.kind] - KIND_PRIORITY[b.point.kind]);

  const kept: { point: GraphPoint; px: number; py: number }[] = [];
  for (const candidate of visible) {
    if (kept.length >= MAX_POINTS) break;
    const crowded = kept.some(
      (other) => Math.hypot(other.px - candidate.px, other.py - candidate.py) < MERGE_DISTANCE,
    );
    if (!crowded) kept.push(candidate);
  }
  return kept.map(({ point }) => point);
}

/** Index of the point under a cursor or fingertip, or -1. */
function hitTest(
  points: readonly GraphPoint[],
  view: GraphView | null,
  canvas: HTMLCanvasElement,
  position: Point,
): number {
  if (!view) return -1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  let best = -1;
  let bestDistance = HIT_RADIUS;
  points.forEach((point, index) => {
    const distance = Math.hypot(
      pixelXAt(view, width, point.x) - position.x,
      pixelYAt(view, height, point.y) - position.y,
    );
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}
