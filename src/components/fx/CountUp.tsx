import { useLayoutEffect, useRef } from 'react';

/**
 * A number that rolls up to its value, after React Bits' CountUp (reactbits.dev, MIT +
 * Commons Clause), without its animation library: a plain animation frame loop that writes
 * the text directly, so React doesn't re-render on every frame. When the value changes it
 * rolls from the old number to the new one. Shows the number at once under reduced motion.
 */
export function CountUp({
  value,
  suffix = '',
  durationMs = 900,
}: {
  value: number;
  suffix?: string;
  durationMs?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);

  // Before paint, so the number is never an empty box (which would jolt the layout).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = shown.current;
    const write = (n: number) => {
      shown.current = n;
      el.textContent = `${Math.round(n)}${suffix}`;
    };
    if (from === value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      write(value);
      return;
    }
    write(from);
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      write(from + (value - from) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // Interrupted by a new value: the next run carries on from wherever this one got to.
    return () => cancelAnimationFrame(raf);
  }, [value, suffix, durationMs]);

  // Screen readers get the final value, not every number on the way up.
  return <span ref={ref} aria-label={`${value}${suffix}`} />;
}
