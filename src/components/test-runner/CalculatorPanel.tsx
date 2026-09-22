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
 * The calculator, filling whatever pane the test runner gives it. It used to float over the
 * page, which on a phone meant it sat on top of the question and the answer choices — you
 * could have the calculator or the question, never both. The runner now splits the screen
 * between them instead, so this only has to fill its share.
 *
 * Renders nothing until first opened. After that it stays mounted and is merely hidden when
 * closed, so typed equations and the zoom level survive being toggled, as they do in Bluebook.
 */
export function CalculatorPanel({ open, onClose }: CalculatorPanelProps) {
  const [everOpened, setEverOpened] = useState(false);

  useEffect(() => {
    if (open) setEverOpened(true);
  }, [open]);

  if (!everOpened) return null;

  return (
    <div className={`flex h-full min-h-0 flex-col bg-paper ${open ? '' : 'hidden'}`}>
      {/* Same window chrome as the Card title bar, so the pane reads as part of the same
          furniture as the question beside it. */}
      <div className="flex flex-none items-center justify-between gap-2 border-y-2 border-ink bg-venice-blue py-0.5 pr-0.5 pl-3 lg:border-t-0">
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

      {/* Scrolls within the pane rather than resizing the calculator itself, so a short pane
          never squeezes the graph down to nothing. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Suspense fallback={<p className="p-4 font-mono text-sm text-ink-soft">Loading calculator…</p>}>
          <GraphingCalculator />
        </Suspense>
      </div>
    </div>
  );
}
