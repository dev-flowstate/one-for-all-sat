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
 * divider between them, as on the real test: the calculator on the left, as Bluebook puts it.
 * On a phone it goes below the question instead, which would otherwise be pushed off screen.
 * The caller makes its page a fixed-height column while the calculator is open, so each pane
 * scrolls itself.
 *
 * The sides swap with CSS `order`, not by moving elements: moving the calculator would reload
 * Desmos and lose whatever was typed into it.
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
        className={calculatorOpen ? 'min-h-0 overflow-y-auto lg:order-3' : ''}
        style={calculatorOpen ? { flexBasis: `${questionShare}%`, flexGrow: 0, flexShrink: 0 } : undefined}
      >
        {children}
      </div>

      {calculatorOpen && (
        // The divider measures from the leading edge, which side by side is the calculator's.
        <SplitDivider
          containerRef={splitRef}
          horizontal={isWide}
          value={isWide ? 100 - questionShare : questionShare}
          onChange={(v) => setQuestionShare(isWide ? 100 - v : v)}
          className="lg:order-2"
        />
      )}

      {/* Hidden rather than unmounted, so closing the calculator doesn't wipe what's
          typed into it. */}
      <div className={calculatorOpen ? 'min-h-0 flex-1 lg:order-1' : 'hidden'}>
        <CalculatorPanel open={calculatorOpen} onClose={onCloseCalculator} />
      </div>
    </div>
  );
}
