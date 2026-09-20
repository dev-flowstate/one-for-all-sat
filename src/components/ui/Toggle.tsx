interface ToggleProps {
  active: boolean;
  onToggle: () => void;
  label: string;
  className?: string;
}

export function Toggle({ active, onToggle, label, className = '' }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={onToggle}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        active ? 'bg-venice-blue text-merino' : 'bg-rock-blue/30 text-venice-blue-dark hover:bg-rock-blue/50'
      } ${className}`}
    >
      {label}
    </button>
  );
}
