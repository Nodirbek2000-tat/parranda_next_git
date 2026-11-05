"use client";

import { useState } from "react";
import { Paperclip } from "lucide-react";
import type { Attachment } from "@/lib/types";
import { AttachmentList } from "@/components/files/attachment-list";
import { Modal } from "@/components/ui/modal";

/** Paperclip with the number of attached stock documents (TZ §7); opens the files. */
export function DocumentFilesButton({ files, title }: { files: readonly Attachment[]; title: string }) {
  const [open, setOpen] = useState(false);
  if (files.length === 0) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-1.5 inline-flex items-center gap-0.5 rounded-sm align-middle text-xs text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"
        aria-label={`${title}: ${files.length} ta hujjat fayli`}
      >
        <Paperclip className="size-3.5" aria-hidden />
        {files.length}
      </button>
      {open && (
        <Modal title="Hujjat fayllari" description={title} onClose={() => setOpen(false)}>
          <AttachmentList files={files} />
        </Modal>
      )}
    </>
  );
}
