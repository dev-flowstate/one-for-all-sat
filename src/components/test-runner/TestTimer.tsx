import { useEffect, useRef, useState } from 'react';
import type { TimerMode } from '../../types/settings';

interface TestTimerProps {
  mode: TimerMode;
  /** Only used when mode === 'countdown'. */
  countdownMinutes?: number;
  /** Called exactly once, when a countdown timer reaches 0. Never called for other modes. */
  onExpire: () => void;
}

function formatTime(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Countdown or count-up display. Renders nothing when mode === 'none'. */
export function TestTimer({ mode, countdownMinutes, onExpire }: TestTimerProps) {
  const [seconds, setSeconds] = useState(() => (mode === 'countdown' ? Math.round((countdownMinutes ?? 20) * 60) : 0));

  // Always read the latest onExpire without having to restart the interval below when it changes.
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (mode === 'none') return;
    const id = setInterval(() => {
      setSeconds((prev) => {
        if (mode === 'countdown') {
          if (prev <= 1) {
            clearInterval(id);
            onExpireRef.current();
            return 0;
          }
          return prev - 1;
        }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [mode]);

  if (mode === 'none') return null;

  return (
    <p className="flex-none border-2 border-ink bg-paper px-2 py-1.5 font-mono text-sm font-bold tabular-nums text-ink">
      {formatTime(seconds)}
    </p>
  );
}
