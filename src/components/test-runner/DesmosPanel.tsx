import { useEffect, useRef, useState } from 'react';
import { loadDesmosScript, DesmosLoadError } from '../../lib/desmos/loadDesmos';
import type { DesmosCalculator, DesmosLoadFailureReason } from '../../lib/desmos/loadDesmos';

interface DesmosPanelProps {
  open: boolean;
  onClose: () => void;
}

type Status = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Floating graphing calculator. Renders nothing until first opened. Once opened, the
 * container stays mounted (and the Desmos.GraphingCalculator instance stays alive) for
 * the rest of the session — closing just hides it via CSS so calculator state (graphed
 * equations etc.) persists like real Bluebook. Has its own close button so it's never
 * left stuck open on a question where the toolbar toggle is hidden (non-math questions).
 */
export function DesmosPanel({ open, onClose }: DesmosPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const calculatorRef = useRef<DesmosCalculator | null>(null);
  const [everOpened, setEverOpened] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [errorReason, setErrorReason] = useState<DesmosLoadFailureReason | null>(null);

  useEffect(() => {
    if (!open) return;
    setEverOpened(true);
    if (calculatorRef.current) return; // already created — just stays visible via CSS

    setStatus('loading');
    setErrorReason(null);
    loadDesmosScript()
      .then(() => {
        if (containerRef.current && !calculatorRef.current) {
          calculatorRef.current = window.Desmos!.GraphingCalculator(containerRef.current);
        }
        setStatus('ready');
      })
      .catch((err: unknown) => {
        setErrorReason(err instanceof DesmosLoadError ? err.reason : 'SCRIPT_LOAD_FAILED');
        setStatus('error');
      });
  }, [open]);

  if (!everOpened) return null;

  return (
    <div
      className={`fixed inset-x-4 bottom-4 z-30 mx-auto max-w-xl rounded-xl border border-rock-blue/40 bg-white shadow-lg sm:inset-x-auto sm:right-4 sm:w-[28rem] ${open ? '' : 'hidden'}`}
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

      {status === 'error' && errorReason && (
        <p className="p-4 text-sm text-danger">
          {errorReason === 'NO_API_KEY'
            ? "Graphing calculator isn't configured for this deployment yet."
            : "Couldn't load the calculator — check your connection and try again."}
        </p>
      )}
      {status === 'loading' && <p className="p-4 text-sm text-venice-blue-dark/70">Loading calculator…</p>}

      <div ref={containerRef} className={`h-80 w-full ${status === 'error' ? 'hidden' : ''}`} />
    </div>
  );
}
