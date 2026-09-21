import type { ReactNode } from 'react';

type BadgeTone = 'neutral' | 'success' | 'danger' | 'accent';

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-merino-dark text-ink',
  success: 'bg-success-bg text-success',
  danger: 'bg-danger-bg text-danger',
  accent: 'bg-venice-blue text-merino',
};

export function Badge({ children, tone = 'neutral' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center border-2 border-ink px-2 py-0.5 font-mono text-[11px] font-semibold tracking-tight uppercase ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
