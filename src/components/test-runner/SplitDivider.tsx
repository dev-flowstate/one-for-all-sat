import { useCallback, useEffect, useRef, type RefObject } from 'react';

interface SplitDividerProps {
  /** The element the two panes share; the drag position is read against its box. */
  containerRef: RefObject<HTMLDivElement | null>;
  /** True when the panes sit side by side, so the drag follows x instead of y. */
  horizontal: boolean;
  /** Percentage of the container given to the first pane. */
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

/** Neither pane may be squeezed below this share of the container. */
const MIN = 20;
const MAX = 80;
const STEP = 4;

/**
 * The draggable seam between the question and the calculator.
 *
 * It's a real `separator` with arrow-key support, not just a mouse target: on a phone the
 * calculator takes half the screen, and someone who can't drag still needs to be able to give
 * the question more room.
 */
export function SplitDivider({ containerRef, horizontal, value, onChange, className = '' }: SplitDividerProps) {
  const draggingRef = useRef(false);
  // Read through a ref so a new callback each render doesn't re-bind the listeners below:
  // re-binding runs their cleanup, which ends the drag after its first step.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const positionFrom = useCallback(
    (clientX: number, clientY: number) => {
      const box = containerRef.current?.getBoundingClientRect();
      if (!box) return null;
      const pct = horizontal
        ? ((clientX - box.left) / box.width) * 100
        : ((clientY - box.top) / box.height) * 100;
      return Math.min(MAX, Math.max(MIN, pct));
    },
    [containerRef, horizontal],
  );

  // Bound to the window rather than the divider, so dragging faster than the layout can
  // follow doesn't drop the pointer and leave the seam stuck mid-drag.
  useEffect(() => {
    function move(event: PointerEvent) {
      if (!draggingRef.current) return;
      event.preventDefault();
      const next = positionFrom(event.clientX, event.clientY);
      if (next !== null) onChangeRef.current(next);
    }
    function stop() {
      draggingRef.current = false;
      document.body.style.userSelect = '';
      delete document.body.dataset.resizing;
    }
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      stop();
    };
  }, [positionFrom]);

  function handleKeyDown(event: React.KeyboardEvent) {
    const back = horizontal ? 'ArrowLeft' : 'ArrowUp';
    const forward = horizontal ? 'ArrowRight' : 'ArrowDown';
    if (event.key !== back && event.key !== forward) return;
    event.preventDefault();
    const next = value + (event.key === forward ? STEP : -STEP);
    onChange(Math.min(MAX, Math.max(MIN, next)));
  }

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation={horizontal ? 'vertical' : 'horizontal'}
      aria-label="Resize the question and calculator panes"
      aria-valuenow={Math.round(value)}
      aria-valuemin={MIN}
      aria-valuemax={MAX}
      onPointerDown={(event) => {
        draggingRef.current = true;
        // Without this a drag selects the question text it passes over.
        document.body.style.userSelect = 'none';
        // Desmos is another site's page in an iframe, and it swallows pointer events passing
        // over it, which would stall a drag towards the calculator. See index.css.
        document.body.dataset.resizing = 'true';
        event.preventDefault();
      }}
      onKeyDown={handleKeyDown}
      className={`group flex flex-none items-center justify-center border-ink bg-merino-dark hover:bg-rock-blue ${
        horizontal ? 'w-3 cursor-col-resize border-x-2' : 'h-3 cursor-row-resize border-y-2'
      } ${className}`}
    >
      {/* A grip, so the seam reads as something you can pull rather than a border. */}
      <span
        aria-hidden="true"
        className={`bg-ink/40 group-hover:bg-ink ${horizontal ? 'h-8 w-0.5' : 'h-0.5 w-8'}`}
      />
    </div>
  );
}
