import type { TimerMode } from '../../types/settings';

interface TimerModePickerProps {
  mode: TimerMode;
  onModeChange: (mode: TimerMode) => void;
  countdownMinutes: number;
  onCountdownMinutesChange: (minutes: number) => void;
}

const OPTIONS: { value: TimerMode; label: string }[] = [
  { value: 'countdown', label: 'Countdown' },
  { value: 'stopwatch', label: 'Stopwatch' },
  { value: 'none', label: 'No timer' },
];

export function TimerModePicker({ mode, onModeChange, countdownMinutes, onCountdownMinutesChange }: TimerModePickerProps) {
  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={mode === opt.value}
            onClick={() => onModeChange(opt.value)}
            className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors sm:text-center ${
              mode === opt.value
                ? 'border-venice-blue bg-venice-blue text-merino'
                : 'border-rock-blue/40 bg-white/50 text-venice-blue-dark hover:bg-rock-blue/10'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {mode === 'countdown' && (
        <div className="mt-3 flex items-center gap-2">
          <label htmlFor="countdown-minutes" className="text-sm text-venice-blue-dark/80">
            Minutes
          </label>
          <input
            id="countdown-minutes"
            type="number"
            min={1}
            value={countdownMinutes}
            onChange={(e) => {
              const raw = Number(e.target.value);
              if (Number.isNaN(raw)) return;
              onCountdownMinutesChange(Math.max(1, raw));
            }}
            className="w-20 rounded-lg border border-rock-blue/40 bg-white/70 px-3 py-1.5 text-sm text-venice-blue-dark"
          />
        </div>
      )}
    </div>
  );
}
