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
      className={`panel-raised fixed inset-x-3 bottom-3 z-30 mx-auto max-w-xl sm:inset-x-auto sm:right-4 sm:w-[34rem] ${open ? '' : 'hidden'}`}
    >
      {/* Same window chrome as the Card title bar, so the floating panel reads as part of
          the same furniture. */}
      <div className="flex items-center justify-between gap-2 border-b-2 border-ink bg-venice-blue py-0.5 pr-0.5 pl-3">
        <p className="font-mono text-xs font-bold tracking-tight text-merino uppercase">Graphing calculator</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close calculator"
          className="flex h-11 w-11 flex-none items-center justify-center border-2 border-transparent font-mono text-sm text-merino hover:border-merino hover:bg-venice-blue-dark"
        >
          ✕
        </button>
      </div>

      <Suspense fallback={<p className="p-4 font-mono text-sm text-ink-soft">Loading calculator…</p>}>
        <GraphingCalculator />
      </Suspense>
    </div>
  );
}
