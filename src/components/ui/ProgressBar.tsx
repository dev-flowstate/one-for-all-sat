interface ProgressBarProps {
  /** 0-100 */
  value: number;
}

export function ProgressBar({ value }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="h-3 w-full border-2 border-ink bg-paper">
      <div className="h-full bg-coral transition-[width] duration-200" style={{ width: `${pct}%` }} />
    </div>
  );
}
