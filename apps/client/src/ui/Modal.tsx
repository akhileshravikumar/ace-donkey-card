import { type ReactNode, useEffect, useId, useRef } from 'react';
import { CloseIcon } from './icons';
import { cn } from './cn';

/**
 * A dialog over the faded page: Escape and a click outside close it; focus moves into it and back
 * afterwards. `className` styles the dialog box itself.
 */
export function Dialog({
  labelledBy,
  onClose,
  children,
  className,
}: {
  labelledBy: string;
  onClose(): void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-bar/80 p-16"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={cn('max-h-[90dvh] max-w-full outline-none', className)}
      >
        {children}
      </div>
    </div>
  );
}

/** The dialog from the Rules wireframe: a grey frame with a title and ✕ and a light inner panel. */
export function Modal({
  title,
  onClose,
  children,
  className,
  panelClassName,
}: {
  title: string;
  onClose(): void;
  children: ReactNode;
  className?: string;
  panelClassName?: string;
}) {
  const titleId = useId();
  return (
    <Dialog
      labelledBy={titleId}
      onClose={onClose}
      className={cn('flex w-750 flex-col rounded-dialog bg-dialog px-21 pt-28 pb-20', className)}
    >
      <div className="flex items-center justify-between px-17 pb-14">
        <h2 id={titleId} className="text-w40 font-semibold">
          {title}
        </h2>
        <button type="button" onClick={onClose} aria-label="Close" className="p-6">
          <CloseIcon className="size-24" />
        </button>
      </div>
      <div
        className={cn('min-h-0 overflow-y-auto rounded-panel bg-panel px-22 py-20', panelClassName)}
      >
        {children}
      </div>
    </Dialog>
  );
}

/** Yes/No question in the same frame. */
export function ConfirmModal({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm(): void;
  onClose(): void;
}) {
  return (
    <Modal title={title} onClose={onClose} className="w-640">
      <p className="text-w30">{message}</p>
      <div className="mt-28 flex justify-end gap-20">
        <button type="button" onClick={onClose} className="h-56 rounded-pill bg-bar px-32 text-w30">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className="h-56 rounded-pill bg-button px-32 text-w30 text-white"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
