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
    <div role="group" aria-label="Angle mode" className="flex shrink-0 border-2 border-ink bg-paper">
      {OPTIONS.map((option, index) => {
        const active = option.mode === mode;
        return (
          <button
            key={option.mode}
            type="button"
            onClick={() => onChange(option.mode)}
            aria-pressed={active}
            title={option.full}
            className={`min-h-10 flex-1 px-2 font-mono text-xs font-semibold tracking-tight uppercase ${
              index > 0 ? 'border-l-2 border-ink' : ''
            } ${active ? 'bg-venice-blue text-merino' : 'text-ink hover:bg-merino-dark'}`}
          >
            {option.short}
          </button>
        );
      })}
    </div>
  );
}
