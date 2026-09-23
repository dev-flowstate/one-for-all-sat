import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  /** Also runs on Escape. Leave out for a notice that has only the one button. */
  onCancel?: () => void;
}

/**
 * A modal question. Built on the native <dialog>, which traps focus, answers Escape and
 * hides the page behind it from screen readers without any help.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        (onCancel ?? onConfirm)();
      }}
      className="panel-raised m-auto w-[min(28rem,calc(100vw-2rem))] p-0 text-ink backdrop:bg-ink/50"
    >
      <h2 id={titleId} className="border-b-2 border-ink bg-venice-blue px-4 py-2 font-mono text-sm font-bold tracking-tight text-merino uppercase">
        {title}
      </h2>
      <div className="flex flex-col gap-3 px-4 py-4 text-sm">{children}</div>
      <div className="flex flex-col-reverse gap-3 border-t-2 border-ink bg-merino-dark px-4 py-3 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
        <Button onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </dialog>
  );
}
