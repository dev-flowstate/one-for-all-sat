import { useEffect, useState } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { satLabel, satStart } from '../../data/satDates';

const pad = (n: number) => String(n).padStart(2, '0');

/** A live countdown to the student's SAT, ticking every second. Nothing without a date. */
export function SatCountdown() {
  const satDate = useSettingsStore((s) => s.profile?.satDate);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!satDate) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [satDate]);

  if (!satDate) return null;
  const left = Math.floor((satStart(satDate).getTime() - now) / 1000);
  if (left <= 0) return null;

  const days = Math.floor(left / 86400);
  const clock = `${pad(Math.floor((left % 86400) / 3600))}:${pad(Math.floor((left % 3600) / 60))}:${pad(left % 60)}`;

  return (
    <div
      role="timer"
      aria-label={`${days} days, ${clock} until your SAT on ${satLabel(satDate)}`}
      className="bb-soft border-2 border-ink bg-venice-blue px-3 py-1.5 text-merino shadow-[4px_4px_0_var(--color-ink)]"
    >
      <p className="font-mono text-[10px] font-semibold tracking-tight uppercase">SAT · {satLabel(satDate)}</p>
      <p className="font-mono text-lg leading-tight font-bold tabular-nums">
        {days}
        <span className="text-xs font-semibold">{days === 1 ? ' day ' : ' days '}</span>
        {clock}
      </p>
    </div>
  );
}
