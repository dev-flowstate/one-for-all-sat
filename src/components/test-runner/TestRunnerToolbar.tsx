import type { TimerMode } from '../../types/settings';
import { Button } from '../ui/Button';
import { Toggle } from '../ui/Toggle';
import { ProgressBar } from '../ui/ProgressBar';
import { TestTimer } from './TestTimer';

interface TestRunnerToolbarProps {
  currentIndex: number;
  total: number;
  /** Abandons the session. The page handles confirming and discarding. */
  onExit: () => void;
  crosserActive: boolean;
  onToggleCrosser: () => void;
  highlighterActive: boolean;
  onToggleHighlighter: () => void;
  showCalculatorToggle: boolean;
  calculatorOpen: boolean;
  onToggleCalculator: () => void;
  timerMode: TimerMode;
  countdownMinutes?: number;
  onTimerExpire: () => void;
}

/**
 * Sticky tool strip: question progress, the answer-eliminator/calculator toggles, and the
 * timer. Kept to two tight rows so it doesn't eat the screen on a phone, and painted in
 * solid merino-dark so scrolling content never shows through it.
 */
export function TestRunnerToolbar({
  currentIndex,
  total,
  onExit,
  crosserActive,
  onToggleCrosser,
  highlighterActive,
  onToggleHighlighter,
  showCalculatorToggle,
  calculatorOpen,
  onToggleCalculator,
  timerMode,
  countdownMinutes,
  onTimerExpire,
}: TestRunnerToolbarProps) {
  return (
    <div className="sticky top-0 z-20 border-b-2 border-ink bg-merino-dark">
      <div className="mx-auto max-w-6xl px-3 py-1.5 sm:px-4 sm:py-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" onClick={onExit} className="-ml-1 flex-none">
            ← Exit
          </Button>

          <p className="flex-none border-2 border-ink bg-paper px-2 py-1.5 font-mono text-xs font-bold tracking-tight tabular-nums uppercase">
            <span className="sr-only">
              Question {currentIndex + 1} of {total}
            </span>
            <span aria-hidden="true">
              Q{currentIndex + 1}
              <span className="text-ink-soft">/{total}</span>
            </span>
          </p>

          {/* Capped, so on a wide screen it stays a progress indicator instead of stretching
              into something that reads as an empty input field. */}
          <div className="min-w-8 max-w-64 flex-1">
            <ProgressBar value={(currentIndex / total) * 100} />
          </div>

          <div className="ml-auto flex-none">
            <TestTimer mode={timerMode} countdownMinutes={countdownMinutes} onExpire={onTimerExpire} />
          </div>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-2 sm:mt-2">
          <Toggle active={highlighterActive} onToggle={onToggleHighlighter} label="Highlighter" />
          <Toggle active={crosserActive} onToggle={onToggleCrosser} label="Answer Eliminator" />
          {showCalculatorToggle && <Toggle active={calculatorOpen} onToggle={onToggleCalculator} label="Calculator" />}
        </div>
      </div>
    </div>
  );
}
