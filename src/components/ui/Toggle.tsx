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
      className={`press inline-flex min-h-11 items-center gap-2 border-2 border-ink px-3 py-1.5 font-mono text-xs font-semibold tracking-tight uppercase ${
        active
          ? 'bg-venice-blue text-merino shadow-[4px_4px_0_var(--color-ink)]'
          : 'bg-paper text-ink hover:bg-merino-dark'
      } ${className}`}
    >
      {/* A filled square reads as "on" without relying on colour alone. */}
      <span
        aria-hidden="true"
        className={`block h-2.5 w-2.5 border-2 ${active ? 'border-merino bg-merino' : 'border-ink bg-transparent'}`}
      />
      {label}
    </button>
  );
}
