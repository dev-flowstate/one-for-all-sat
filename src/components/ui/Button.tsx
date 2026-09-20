import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-venice-blue text-merino hover:bg-venice-blue-dark',
  secondary: 'bg-rock-blue text-venice-blue-dark hover:bg-rock-blue-dark',
  ghost: 'bg-transparent text-venice-blue hover:bg-venice-blue/10',
  danger: 'bg-danger text-merino hover:opacity-90',
};

export function Button({ variant = 'primary', className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
