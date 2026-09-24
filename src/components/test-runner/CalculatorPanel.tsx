import { Component, Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { Button } from '../ui/Button';

interface CalculatorPanelProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Desmos's College Board version: the calculator built into the digital SAT itself. Desmos
 * lets its calculator pages be embedded, so it needs no API key; it does need a connection,
 * which is why the built-in calculator stays as the other choice.
 */
const DESMOS_URL = 'https://www.desmos.com/testing/collegeboard/graphing';

type Engine = 'desmos' | 'builtin';
const ENGINE_KEY = 'ofa-sat:calculator';

function savedEngine(): Engine {
  try {
    return localStorage.getItem(ENGINE_KEY) === 'builtin' ? 'builtin' : 'desmos';
  } catch {
    return 'desmos';
  }
}

/** The math engine is ~100 kB gzipped, so it only downloads once a calculator is opened. */
const GraphingCalculator = lazy(async () => ({
  default: (await import('../calculator/GraphingCalculator')).GraphingCalculator,
}));

/**
 * Catches the calculator failing to download. Uncaught, that failure unmounts the whole app
 * and leaves a blank page that not even Back recovers from. The usual cause is a tab opened
 * before the site was updated: each deploy replaces the calculator's file with one under a
 * new name, so the file an older tab asks for is gone.
 */
class CalculatorLoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex flex-col items-start gap-3 p-4 text-sm">
        <p className="font-semibold text-ink">The calculator couldn't load.</p>
        <p className="text-ink-soft">
          The site has probably been updated since you opened it. Finish this set, then reload the page to get the
          latest version. Reloading now would lose your answers in this set.
        </p>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Reload now
        </Button>
      </div>
    );
  }
}

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
  const [engine, setEngine] = useState<Engine>(savedEngine);
  // Each stays mounted once shown, so switching back doesn't wipe what was typed into it.
  const [shown, setShown] = useState<Set<Engine>>(() => new Set([savedEngine()]));

  function choose(next: Engine) {
    setEngine(next);
    setShown((prev) => new Set(prev).add(next));
    try {
      localStorage.setItem(ENGINE_KEY, next);
    } catch {
      // Only a convenience: without storage the choice lasts until the page is left.
    }
  }

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
        <div className="ml-auto flex border-2 border-merino" role="group" aria-label="Calculator">
          {(
            [
              ['desmos', 'Desmos'],
              ['builtin', 'Built-in'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={engine === value}
              onClick={() => choose(value)}
              className={`min-h-8 px-2 font-mono text-[11px] font-semibold tracking-tight uppercase ${
                engine === value ? 'bg-merino text-venice-blue-dark' : 'text-merino hover:bg-venice-blue-dark'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
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
      {shown.has('desmos') && (
        <iframe
          src={DESMOS_URL}
          title="Desmos graphing calculator"
          className={`min-h-0 w-full flex-1 border-0 bg-white ${engine === 'desmos' ? '' : 'hidden'}`}
        />
      )}
      {shown.has('builtin') && (
        <div className={`min-h-0 flex-1 overflow-y-auto ${engine === 'builtin' ? '' : 'hidden'}`}>
          <CalculatorLoadBoundary>
            <Suspense fallback={<p className="p-4 font-mono text-sm text-ink-soft">Loading calculator…</p>}>
              <GraphingCalculator />
            </Suspense>
          </CalculatorLoadBoundary>
        </div>
      )}
    </div>
  );
}
