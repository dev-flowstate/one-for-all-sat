import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { formatClock } from '../../lib/practiceTest/format';

interface BreakScreenProps {
  secondsLeft: number;
  onStartMath: () => void;
  onExit: () => void;
}

/**
 * The 10-minute break between the two sections. Math never starts on its own: someone who
 * stepped away for the whole break shouldn't come back to a clock that's already running.
 */
export function BreakScreen({ secondsLeft, onStartMath, onExit }: BreakScreenProps) {
  const over = secondsLeft === 0;
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-10">
      <Card title="Break">
        <div className="py-4 text-center">
          <p className="text-[11px] font-semibold tracking-tight text-ink-soft uppercase">
            {over ? "Break's over" : 'Reading and Writing is done'}
          </p>
          <p
            className="mt-3 text-6xl font-bold tracking-tight tabular-nums sm:text-7xl"
            role="timer"
            aria-label={`${formatClock(secondsLeft)} left in the break`}
          >
            {formatClock(secondsLeft)}
          </p>
          <p className="mx-auto mt-4 max-w-sm text-sm text-ink-soft">
            {over
              ? 'Start Math when you are ready.'
              : 'Take a 10-minute break before Math. Your test is saved, so you can step away from the screen.'}
          </p>
        </div>
        <Button className="w-full py-4 text-base" onClick={onStartMath}>
          {over ? 'Start Math' : 'Skip the break and start Math'}
        </Button>
        <Button variant="ghost" className="mt-3 w-full" onClick={onExit}>
          Save and exit
        </Button>
      </Card>
    </div>
  );
}
