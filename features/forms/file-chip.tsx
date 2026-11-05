"use client";

import { useState } from "react";
import { Download, FileText, ImageOff, LoaderCircle } from "lucide-react";
import { apiDownload, toApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useBlobUrl } from "@/lib/files";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

export function filePath(id: number): string {
  return `/api/files/${id}`;
}

/** Square thumbnail of a private image (`/api/files/{id}`, loaded with the token). */
export function PhotoThumb({ id, className }: { id: number; className?: string }) {
  const blob = useBlobUrl(filePath(id));
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-subtle text-muted",
        className,
      )}
    >
      {blob.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- object URL of a private file, not optimizable
        <img src={blob.url} alt="" className="size-full object-cover" />
      ) : blob.error ? (
        <ImageOff className="size-4" aria-hidden />
      ) : (
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
      )}
    </span>
  );
}

function PhotoPreview({ id, name, onClose }: { id: number; name: string; onClose: () => void }) {
  const blob = useBlobUrl(filePath(id));
  return (
    <Modal title={name} onClose={onClose} size="lg" footer={<DownloadFileButton id={id} name={name} />}>
      <div className="flex min-h-48 items-center justify-center rounded-lg bg-subtle">
        {blob.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- object URL of a private file
          <img src={blob.url} alt={name} className="max-h-[65vh] w-auto rounded-lg object-contain" />
        ) : blob.error ? (
          <p className="px-4 text-sm text-danger">{blob.error.message}</p>
        ) : (
          <LoaderCircle className="size-6 animate-spin text-accent" aria-label="Yuklanmoqda" />
        )}
      </div>
    </Modal>
  );
}

export function DownloadFileButton({ id, name, size = "md" }: { id: number; name: string; size?: "sm" | "md" }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      size={size}
      loading={busy}
      icon={<Download className="size-4" aria-hidden />}
      onClick={async () => {
        setBusy(true);
        try {
          await apiDownload(filePath(id), undefined, name);
        } catch (error) {
          toast.error(toApiError(error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      Yuklab olish
    </Button>
  );
}

/** A form file value: photo → thumbnail opening a preview; other files → name with a download button. */
export function FileChip({ id, name, photo }: { id: number; name: string; photo: boolean }) {
  const [open, setOpen] = useState(false);
  if (photo) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex max-w-full items-center gap-3 rounded-lg border border-line bg-surface p-1.5 pr-3 text-left transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <PhotoThumb id={id} className="size-14" />
          <span className="min-w-0 truncate text-[13px] text-ink group-hover:text-accent">{name}</span>
        </button>
        {open && <PhotoPreview id={id} name={name} onClose={() => setOpen(false)} />}
      </>
    );
  }
  return (
    <span className="flex max-w-full flex-wrap items-center gap-2">
      <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
        <FileText className="size-4 shrink-0 text-muted" aria-hidden />
        <span className="truncate">{name}</span>
      </span>
      <DownloadFileButton id={id} name={name} size="sm" />
    </span>
  );
}
