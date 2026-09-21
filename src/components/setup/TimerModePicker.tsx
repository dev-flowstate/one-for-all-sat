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
  { value: 'none', label: 'None' },
];

export function TimerModePicker({
  mode,
  onModeChange,
  countdownMinutes,
  onCountdownMinutesChange,
}: TimerModePickerProps) {
  return (
    <div>
      <div className="flex border-2 border-ink bg-paper">
        {OPTIONS.map((opt, index) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={mode === opt.value}
            onClick={() => onModeChange(opt.value)}
            className={`min-h-11 flex-1 px-3 py-2.5 text-xs font-semibold tracking-tight uppercase sm:text-sm ${
              index > 0 ? 'border-l-2 border-ink' : ''
            } ${mode === opt.value ? 'bg-venice-blue text-merino' : 'text-ink hover:bg-merino-dark'}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {mode === 'countdown' && (
        <div className="mt-3 flex items-center gap-2">
          <label htmlFor="countdown-minutes" className="text-xs font-semibold tracking-tight text-ink-soft uppercase">
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
            className="min-h-11 w-24 border-2 border-ink bg-paper px-3 py-1.5 text-sm font-semibold tabular-nums"
          />
        </div>
      )}
    </div>
  );
}
