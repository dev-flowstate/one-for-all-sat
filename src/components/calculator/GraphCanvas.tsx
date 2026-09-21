import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { createDefaultView, drawGraph, panView, zoomView } from '../../lib/calculator/graph';
import type { GraphPlot, GraphView } from '../../lib/calculator/graph';

interface GraphCanvasProps {
  plots: readonly GraphPlot[];
}

interface Point {
  x: number;
  y: number;
}

const BUTTON_CLASS =
  'flex h-8 w-8 items-center justify-center rounded-md border border-rock-blue/50 bg-white/90 text-base leading-none text-venice-blue-dark shadow-sm hover:bg-rock-blue/20';

/** Zoom applied by one tap of the +/− buttons. */
const BUTTON_ZOOM = 1.6;

/**
 * Graph paper that draws every plot on a 2D canvas. The viewport lives in a ref rather than
 * state so dragging and pinching redraw straight from the gesture without a React re-render.
 */
export function GraphCanvas({ plots }: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<GraphView | null>(null);
  const plotsRef = useRef<readonly GraphPlot[]>(plots);
  const frameRef = useRef(0);
  const pointersRef = useRef(new Map<number, Point>());
  const pinchRef = useRef<{ distance: number; center: Point } | null>(null);

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
    drawGraph(ctx, width, height, viewRef.current, plotsRef.current);
  }, []);

  const scheduleRender = useCallback(() => {
    if (frameRef.current !== 0) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = 0;
      render();
    });
  }, [render]);

  useEffect(() => {
    plotsRef.current = plots;
    scheduleRender();
  }, [plots, scheduleRender]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(scheduleRender);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [scheduleRender]);

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
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [scheduleRender]);

  useEffect(
    () => () => {
      if (frameRef.current !== 0) {
        window.cancelAnimationFrame(frameRef.current);
        // Must clear the id too: scheduleRender treats a non-zero ref as "a frame is already
        // queued". Leaving a cancelled id here jams the scheduler permanently, which is exactly
        // what happens on StrictMode's mount/cleanup/mount cycle — the canvas never draws.
        frameRef.current = 0;
      }
    },
    [],
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    canvas.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, pointIn(canvas, event));
    pinchRef.current = measurePinch(pointersRef.current);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const pointers = pointersRef.current;
    const previous = pointers.get(event.pointerId);
    const view = viewRef.current;
    if (!previous || !view) return;
    const canvas = event.currentTarget;
    const position = pointIn(canvas, event);
    pointers.set(event.pointerId, position);

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
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(event.pointerId);
    pinchRef.current = measurePinch(pointersRef.current);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const zoomFromCenter = (factor: number) => {
    const canvas = canvasRef.current;
    const view = viewRef.current;
    if (!canvas || !view) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    viewRef.current = zoomView(view, factor, width / 2, height / 2, width, height);
    scheduleRender();
  };

  const resetView = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    viewRef.current = createDefaultView(canvas.clientWidth);
    scheduleRender();
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-rock-blue/40 bg-white">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Graph of the entered expressions. Drag to pan, pinch or scroll to zoom."
        className="block h-full w-full cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
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
