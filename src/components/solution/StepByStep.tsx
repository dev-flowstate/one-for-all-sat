import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchSolutions, type Solution } from '../../lib/solutions';
import { MathText } from '../math/MathText';

const METHOD_LABEL: Record<Solution['method'], string> = {
  desmos: 'Desmos',
  algebra: 'By hand',
  reading: 'Reading',
};

/** The "Step-by-step solution" button, and the panel it opens on the right. */
export function StepByStepButton({ questionId }: { questionId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press inline-flex min-h-10 items-center gap-2 border-2 border-ink bg-venice-blue px-3 py-2 font-mono text-xs font-bold tracking-tight text-merino uppercase shadow-[3px_3px_0_var(--color-ink)] hover:brightness-110"
      >
        <span aria-hidden="true">≡</span>
        Step-by-step solution
      </button>
      {open && createPortal(<SolutionPanel questionId={questionId} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function SolutionPanel({ questionId, onClose }: { questionId: string; onClose: () => void }) {
  const [solution, setSolution] = useState<Solution | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [shown, setShown] = useState(1);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    fetchSolutions()
      .then((all) => live && setSolution(all[questionId] ?? null))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [questionId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Each new step scrolls into view, with the earlier ones still above it.
  useEffect(() => {
    if (shown > 1) end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [shown]);

  const total = solution?.steps.length ?? 0;

  return (
    <aside
      role="dialog"
      aria-label="Step-by-step solution"
      className="fixed inset-x-0 bottom-0 z-50 flex max-h-[75dvh] flex-col border-t-2 border-ink bg-paper text-ink shadow-[0_-6px_0_var(--color-ink)] sm:inset-x-auto sm:top-0 sm:right-0 sm:max-h-none sm:w-[26rem] sm:border-t-0 sm:border-l-2 sm:shadow-[-6px_0_0_var(--color-ink)]"
    >
      <header className="flex flex-none items-center gap-2 border-b-2 border-ink bg-venice-blue px-4 py-3 text-merino">
        <h2 className="flex-1 font-mono text-xs font-bold tracking-tight uppercase">Step-by-step</h2>
        {solution && (
          <span className="border-2 border-merino px-1.5 font-mono text-[10px] font-bold uppercase">
            {METHOD_LABEL[solution.method]}
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center border-2 border-merino font-mono text-sm font-bold hover:bg-merino hover:text-venice-blue"
        >
          ✕
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {failed ? (
          <p className="text-sm text-ink-soft">Couldn&apos;t load the solution. Check your connection and try again.</p>
        ) : solution === undefined ? (
          <p className="text-sm text-ink-soft">Loading…</p>
        ) : solution === null ? (
          <p className="text-sm text-ink-soft">
            The step-by-step for this question is still being written. Its explanation has the full reasoning meanwhile.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {solution.steps.slice(0, shown).map((step, i) => (
              <li key={i} className="border-2 border-ink bg-merino">
                <p className="border-b-2 border-ink bg-merino-dark px-3 py-1 font-mono text-[11px] font-bold tracking-tight uppercase">
                  Step {i + 1}
                  {i + 1 === total && ' · Answer'}
                </p>
                <p className="prose-reading px-3 py-2.5">
                  <MathText text={step.text} />
                </p>
                {step.desmos && <DesmosInput expression={step.desmos} />}
              </li>
            ))}
          </ol>
        )}
        <div ref={end} />
      </div>

      {solution && (
        <footer className="flex flex-none items-center gap-3 border-t-2 border-ink bg-merino px-4 py-3">
          <span className="flex-1 font-mono text-xs font-semibold tabular-nums text-ink-soft">
            {shown}/{total}
          </span>
          {shown < total ? (
            <button
              type="button"
              onClick={() => setShown((n) => n + 1)}
              className="press min-h-10 border-2 border-ink bg-coral px-4 py-2 font-mono text-xs font-bold tracking-tight text-paper uppercase shadow-[3px_3px_0_var(--color-ink)]"
            >
              Next step →
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="press min-h-10 border-2 border-ink bg-paper px-4 py-2 font-mono text-xs font-bold tracking-tight uppercase shadow-[3px_3px_0_var(--color-ink)]"
            >
              Done
            </button>
          )}
        </footer>
      )}
    </aside>
  );
}

/** What to type into Desmos, with a button to copy it. */
function DesmosInput({ expression }: { expression: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 border-t-2 border-ink bg-paper px-3 py-2">
      <span className="flex-none border-2 border-ink bg-success px-1.5 font-mono text-[10px] font-bold text-paper uppercase">
        Desmos
      </span>
      <code className="min-w-0 flex-1 overflow-x-auto font-mono text-sm whitespace-nowrap">{expression}</code>
      <button
        type="button"
        onClick={() =>
          navigator.clipboard?.writeText(expression).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            },
            () => {},
          )
        }
        className="flex-none border-2 border-ink px-2 py-0.5 font-mono text-[10px] font-bold uppercase hover:bg-merino"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
