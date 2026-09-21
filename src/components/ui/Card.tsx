import type { HTMLAttributes, ReactNode } from 'react';

/** `title` is widened to ReactNode, so the native string-only attribute is omitted. */
interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  children: ReactNode;
  /** Retro window chrome: a title bar across the top of the panel. */
  title?: ReactNode;
  /** Pushed to the right of the title bar, e.g. a count or a small action. */
  titleRight?: ReactNode;
}

export function Card({ className = '', title, titleRight, children, ...rest }: CardProps) {
  return (
    <div className={`panel ${className}`} {...rest}>
      {title !== undefined && (
        <div className="flex items-center gap-2 border-b-2 border-ink bg-venice-blue px-3 py-1.5">
          {/* The two dots read as window controls; decorative, so hidden from screen readers. */}
          <span aria-hidden="true" className="flex gap-1">
            <span className="block h-2.5 w-2.5 rounded-full border-2 border-merino" />
            <span className="block h-2.5 w-2.5 rounded-full border-2 border-merino" />
          </span>
          <span className="flex-1 truncate font-mono text-xs font-semibold tracking-wide text-merino uppercase">
            {title}
          </span>
          {titleRight}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
