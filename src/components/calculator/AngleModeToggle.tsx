import type { AngleMode } from '../../lib/calculator/types';

interface AngleModeToggleProps {
  mode: AngleMode;
  onChange: (mode: AngleMode) => void;
}

const OPTIONS: readonly { mode: AngleMode; short: string; full: string }[] = [
  { mode: 'radians', short: 'RAD', full: 'Radians' },
  { mode: 'degrees', short: 'DEG', full: 'Degrees' },
];

/** Segmented control deciding how `sin`, `cos` and friends read their argument. */
export function AngleModeToggle({ mode, onChange }: AngleModeToggleProps) {
  return (
    <div
      role="group"
      aria-label="Angle mode"
      className="flex shrink-0 gap-1 rounded-lg border border-rock-blue/50 bg-white p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = option.mode === mode;
        return (
          <button
            key={option.mode}
            type="button"
            onClick={() => onChange(option.mode)}
            aria-pressed={active}
            title={option.full}
            className={`min-h-8 flex-1 rounded-md px-2 text-xs font-semibold ${
              active
                ? 'bg-venice-blue text-white'
                : 'text-venice-blue-dark/60 hover:bg-rock-blue/20 hover:text-venice-blue-dark'
            }`}
          >
            {option.short}
          </button>
        );
      })}
    </div>
  );
}
