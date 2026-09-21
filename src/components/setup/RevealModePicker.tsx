import type { RevealMode } from '../../types/settings';

interface RevealModePickerProps {
  value: RevealMode;
  onChange: (value: RevealMode) => void;
}

const OPTIONS: { value: RevealMode; label: string }[] = [
  { value: 'immediate', label: 'After each question' },
  { value: 'end', label: 'At the end' },
];

export function RevealModePicker({ value, onChange }: RevealModePickerProps) {
  return (
    <div className="flex border-2 border-ink bg-paper">
      {OPTIONS.map((opt, index) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`min-h-11 flex-1 px-3 py-2.5 text-xs font-semibold tracking-tight uppercase sm:text-sm ${
            index > 0 ? 'border-l-2 border-ink' : ''
          } ${value === opt.value ? 'bg-venice-blue text-merino' : 'text-ink hover:bg-merino-dark'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
