"use client";

import { useState } from "react";
import { Download, FileText, ImageOff, LoaderCircle } from "lucide-react";
import { apiDownload, toApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { isImage, useBlobUrl } from "@/lib/files";
import { formatDateTime, formatFileSize } from "@/lib/format";
import type { Attachment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

/** Square preview: the image itself (authenticated blob) or a PDF icon. */
export function AttachmentThumb({ file, className }: { file: Attachment; className?: string }) {
  const image = isImage(file.content_type);
  const blob = useBlobUrl(image ? file.url : null);
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-subtle text-muted",
        className,
      )}
    >
      {!image ? (
        <FileText className="size-5" aria-hidden />
      ) : blob.url ? (
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

function ImagePreview({ file, onClose }: { file: Attachment; onClose: () => void }) {
  const blob = useBlobUrl(file.url);
  return (
    <Modal
      title={file.name}
      description={`${formatFileSize(file.size)} · ${formatDateTime(file.created_at)}`}
      onClose={onClose}
      size="lg"
      footer={<DownloadButton file={file} />}
    >
      <div className="flex min-h-48 items-center justify-center rounded-lg bg-subtle">
        {blob.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- object URL of a private file
          <img src={blob.url} alt={file.name} className="max-h-[65vh] w-auto rounded-lg object-contain" />
        ) : blob.error ? (
          <p className="px-4 text-sm text-danger">{blob.error.message}</p>
        ) : (
          <LoaderCircle className="size-6 animate-spin text-accent" aria-label="Yuklanmoqda" />
        )}
      </div>
    </Modal>
  );
}

function DownloadButton({ file }: { file: Attachment }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      loading={busy}
      icon={<Download className="size-4" aria-hidden />}
      onClick={async () => {
        setBusy(true);
        try {
          await apiDownload(file.url, undefined, file.name);
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

/**
 * Files bound to an object (delivery proof, vet conclusions, request photos): image thumbnails open
 * a preview, PDFs download with their original name. Everything is loaded with the user's token.
 */
export function AttachmentList({
  files,
  emptyText = "Fayl biriktirilmagan",
  className,
}: {
  files: readonly Attachment[];
  emptyText?: string;
  className?: string;
}) {
  const toast = useToast();
  const [preview, setPreview] = useState<Attachment | null>(null);

  if (files.length === 0) return <EmptyState icon={FileText} title={emptyText} className="py-6" />;

  const open = async (file: Attachment) => {
    if (isImage(file.content_type)) {
      setPreview(file);
      return;
    }
    try {
      await apiDownload(file.url, undefined, file.name);
    } catch (error) {
      toast.error(toApiError(error).message);
    }
  };

  return (
    <>
      <ul className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4", className)}>
        {files.map((file) => (
          <li key={file.id}>
            <button
              type="button"
              onClick={() => open(file)}
              className="group flex w-full flex-col overflow-hidden rounded-lg border border-line bg-surface text-left transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <AttachmentThumb file={file} className="aspect-[4/3] w-full rounded-none border-0 border-b" />
              <span className="min-w-0 px-2.5 py-2">
                <span className="block truncate text-[13px] text-ink group-hover:text-accent">{file.name}</span>
                <span className="text-xs text-muted">{formatFileSize(file.size)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {preview && <ImagePreview file={preview} onClose={() => setPreview(null)} />}
    </>
  );
}
