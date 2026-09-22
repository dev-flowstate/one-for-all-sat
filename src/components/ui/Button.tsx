import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'panel press bg-coral text-paper hover:bg-coral-dark',
  secondary: 'panel press bg-rock-blue text-ink hover:bg-rock-blue-dark',
  ghost: 'border-2 border-transparent bg-transparent text-venice-blue hover:border-ink hover:bg-paper',
  danger: 'panel press bg-danger text-paper hover:brightness-110',
  // Pairs with `danger` wherever a choice is being graded, so the two read as opposites.
  success: 'panel press bg-success text-paper hover:brightness-110',
};

export function Button({ variant = 'primary', className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2.5 font-mono text-sm font-semibold tracking-tight uppercase disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
