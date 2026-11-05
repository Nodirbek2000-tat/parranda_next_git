"use client";

import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "./button";

interface ModalProps {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  /** When set, body and footer are wrapped in a <form>. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  footer?: ReactNode;
  /** Prevent closing while a request is running. */
  busy?: boolean;
  size?: "md" | "lg";
  children: ReactNode;
}

/**
 * Accessible modal built on the native <dialog> (focus trap, Esc, top layer).
 * Mount it to open, unmount it to close.
 */
export function Modal({ title, description, onClose, onSubmit, footer, busy = false, size = "md", children }: ModalProps) {
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

  const content = (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 sm:px-6">{children}</div>
      {footer && (
        <footer className="flex flex-col-reverse gap-2 border-t border-line px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
          {footer}
        </footer>
      )}
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
        "m-auto w-[calc(100%-2rem)] overflow-hidden rounded-xl border border-line bg-surface p-0 text-ink shadow-xl",
        "max-h-[calc(var(--app-height)_-_2rem)]",
        size === "lg" ? "max-w-2xl" : "max-w-lg",
      )}
    >
      <div className="flex max-h-[calc(var(--app-height)_-_2rem)] flex-col">
        <header className="flex items-start justify-between gap-4 px-4 pb-4 pt-4 sm:px-6 sm:pt-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-ink">
              {title}
            </h2>
            {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
          </div>
          <IconButton label="Yopish" onClick={requestClose} disabled={busy} className="-mr-2 -mt-1">
            <X className="size-4" aria-hidden />
          </IconButton>
        </header>
        {onSubmit ? (
          <form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            {content}
          </form>
        ) : (
          content
        )}
      </div>
    </dialog>
  );
}
