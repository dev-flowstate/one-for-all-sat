import type { ReactNode } from 'react';

type BadgeTone = 'neutral' | 'success' | 'danger' | 'accent';

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-rock-blue/25 text-venice-blue-dark',
  success: 'bg-success-bg text-success',
  danger: 'bg-danger-bg text-danger',
  accent: 'bg-venice-blue text-merino',
};

export function Badge({ children, tone = 'neutral' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
  );
}
