interface ProgressBarProps {
  /** 0-100 */
  value: number;
}

export function ProgressBar({ value }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-rock-blue/25">
      <div className="h-full bg-venice-blue transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}
