import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CalculatorPanel } from './CalculatorPanel';
import { SplitDivider } from './SplitDivider';

/** Side-by-side above this, stacked below — the same 1024px pivot the question grid uses. */
const WIDE_QUERY = '(min-width: 1024px)';

function useIsWide(): boolean {
  const [wide, setWide] = useState(() => window.matchMedia(WIDE_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(WIDE_QUERY);
    const update = (event: MediaQueryListEvent) => setWide(event.matches);
    query.addEventListener('change', update);
    setWide(query.matches);
    return () => query.removeEventListener('change', update);
  }, []);
  return wide;
}

interface CalculatorSplitProps {
  calculatorOpen: boolean;
  onCloseCalculator: () => void;
  /** The question side of the split. */
  children: ReactNode;
}

/**
 * The question and the calculator side by side (stacked on a phone), with a draggable
 * divider between them, as on the real test. The caller makes its page a fixed-height column
 * while the calculator is open, so each pane scrolls itself.
 */
export function CalculatorSplit({ calculatorOpen, onCloseCalculator, children }: CalculatorSplitProps) {
  /** Percentage of the split given to the question. Above half, because the question is what
   *  you're actually answering — the calculator is the aid. */
  const [questionShare, setQuestionShare] = useState(55);
  const splitRef = useRef<HTMLDivElement>(null);
  const isWide = useIsWide();

  return (
    <div ref={splitRef} className={calculatorOpen ? 'flex min-h-0 flex-1 flex-col lg:flex-row' : ''}>
      <div
        className={calculatorOpen ? 'min-h-0 overflow-y-auto' : ''}
        style={calculatorOpen ? { flexBasis: `${questionShare}%`, flexGrow: 0, flexShrink: 0 } : undefined}
      >
        {children}
      </div>

      {calculatorOpen && (
        <SplitDivider containerRef={splitRef} horizontal={isWide} value={questionShare} onChange={setQuestionShare} />
      )}

      {/* Hidden rather than unmounted, so closing the calculator doesn't wipe what's
          typed into it. */}
      <div className={calculatorOpen ? 'min-h-0 flex-1' : 'hidden'}>
        <CalculatorPanel open={calculatorOpen} onClose={onCloseCalculator} />
      </div>
    </div>
  );
}
