"use client";

import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "./ui";

/** Native <dialog> modal: mount to open, unmount to close. A bottom sheet on phones. */
export function Modal({
  title,
  onClose,
  onSubmit,
  footer,
  busy = false,
  children,
}: {
  title: string;
  onClose: () => void;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  footer?: ReactNode;
  busy?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  const requestClose = () => {
    if (!busy) onClose();
  };

  const body = (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-5">{children}</div>
      {footer && <footer className="pb-safe flex flex-col-reverse gap-2 border-t border-line px-4 py-3 sm:flex-row sm:justify-end sm:px-5">{footer}</footer>}
    </>
  );

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
      className={cn(
        "w-full max-w-none overflow-hidden border border-line bg-surface p-0 text-ink shadow-pop",
        "mb-0 mt-auto animate-sheet-in rounded-t-2xl sm:m-auto sm:w-[calc(100%-2rem)] sm:max-w-lg sm:rounded-2xl",
        "max-h-[calc(var(--app-height)_-_2rem)]",
      )}
    >
      <div className="flex max-h-[calc(var(--app-height)_-_2rem)] flex-col">
        <header className="flex items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          <IconButton label="Yopish" onClick={requestClose} disabled={busy} className="-mr-2">
            <X className="size-4" aria-hidden />
          </IconButton>
        </header>
        {onSubmit ? (
          <form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            {body}
          </form>
        ) : (
          body
        )}
      </div>
    </dialog>
  );
}
