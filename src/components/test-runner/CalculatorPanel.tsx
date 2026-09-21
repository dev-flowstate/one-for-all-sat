import { Suspense, lazy, useEffect, useState } from 'react';

interface CalculatorPanelProps {
  open: boolean;
  onClose: () => void;
}

/** The math engine is ~100 kB gzipped, so it only downloads once a calculator is opened. */
const GraphingCalculator = lazy(async () => ({
  default: (await import('../calculator/GraphingCalculator')).GraphingCalculator,
}));

/**
 * Floating graphing calculator. Renders nothing until first opened. Once opened it stays
 * mounted for the rest of the session — closing just hides it via CSS so calculator state
 * (typed equations, zoom level) persists like real Bluebook. Has its own close button so it's
 * never left stuck open on a question where the toolbar toggle is hidden (non-math questions).
 */
export function CalculatorPanel({ open, onClose }: CalculatorPanelProps) {
  const [everOpened, setEverOpened] = useState(false);

  useEffect(() => {
    if (open) setEverOpened(true);
  }, [open]);

  if (!everOpened) return null;

  return (
    <div
      className={`fixed inset-x-4 bottom-4 z-30 mx-auto max-w-xl rounded-xl border border-rock-blue/40 bg-white shadow-lg sm:inset-x-auto sm:right-4 sm:w-[34rem] ${open ? '' : 'hidden'}`}
    >
      <div className="flex items-center justify-between border-b border-rock-blue/30 px-3 py-2">
        <p className="text-sm font-semibold text-venice-blue-dark">Graphing calculator</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close calculator"
          className="rounded px-2 py-1 text-venice-blue-dark hover:bg-rock-blue/20"
        >
          ✕
        </button>
      </div>

      <Suspense fallback={<p className="p-4 text-sm text-venice-blue-dark/70">Loading calculator…</p>}>
        <GraphingCalculator />
      </Suspense>
    </div>
  );
}
