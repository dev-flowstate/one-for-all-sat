import type { RevealMode } from '../../types/settings';

interface RevealModePickerProps {
  value: RevealMode;
  onChange: (value: RevealMode) => void;
}

const OPTIONS: { value: RevealMode; label: string }[] = [
  { value: 'immediate', label: 'Show answer after each question' },
  { value: 'end', label: 'Show all answers at the end' },
];

export function RevealModePicker({ value, onChange }: RevealModePickerProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors sm:text-center ${
            value === opt.value
              ? 'border-venice-blue bg-venice-blue text-merino'
              : 'border-rock-blue/40 bg-white/50 text-venice-blue-dark hover:bg-rock-blue/10'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
