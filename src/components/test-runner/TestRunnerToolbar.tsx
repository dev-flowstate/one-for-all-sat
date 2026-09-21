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
  showCalculatorToggle: boolean;
  calculatorOpen: boolean;
  onToggleCalculator: () => void;
  timerMode: TimerMode;
  countdownMinutes?: number;
  onTimerExpire: () => void;
}

/** Sticky top bar: question progress, the answer-eliminator/calculator toggles, and the timer. */
export function TestRunnerToolbar({
  currentIndex,
  total,
  onExit,
  crosserActive,
  onToggleCrosser,
  showCalculatorToggle,
  calculatorOpen,
  onToggleCalculator,
  timerMode,
  countdownMinutes,
  onTimerExpire,
}: TestRunnerToolbarProps) {
  return (
    <div className="sticky top-0 z-20 border-b border-rock-blue/40 bg-merino">
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onExit} className="-ml-2 min-h-[44px] px-3">
            ← Exit
          </Button>
          <p className="mr-auto text-sm font-semibold text-venice-blue-dark">
            Question {currentIndex + 1} of {total}
          </p>
          <TestTimer mode={timerMode} countdownMinutes={countdownMinutes} onExpire={onTimerExpire} />
        </div>

        <div className="mt-2">
          <ProgressBar value={(currentIndex / total) * 100} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Toggle active={crosserActive} onToggle={onToggleCrosser} label="Answer Eliminator" />
          {showCalculatorToggle && <Toggle active={calculatorOpen} onToggle={onToggleCalculator} label="Calculator" />}
        </div>
      </div>
    </div>
  );
}
