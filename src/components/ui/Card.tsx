import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className = '', children, ...rest }: CardProps) {
  return (
    <div className={`rounded-xl border border-rock-blue/30 bg-white/60 p-4 shadow-sm ${className}`} {...rest}>
      {children}
    </div>
  );
}
