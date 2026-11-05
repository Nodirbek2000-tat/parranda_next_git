"use client";

import type { Submission } from "@/lib/builder-types";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { FileChip } from "./file-chip";

/**
 * A saved form submission (API_CONTRACT_V4 §3.1): the server-rendered `display` list. File and photo
 * values are loaded with the user's token (`/api/files/{id}`): photos as thumbnails, files as downloads.
 */
export function SubmissionView({
  submission,
  showMeta = true,
  className,
}: {
  submission: Submission;
  showMeta?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {showMeta && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
          <span className="font-medium tabular-nums text-ink">{submission.code}</span>
          <span>{submission.form_name}</span>
          <span>v{submission.form_version}</span>
          {submission.submitted_by_name && <span>{submission.submitted_by_name}</span>}
          <span className="tabular-nums">{formatDateTime(submission.created_at)}</span>
          {submission.is_test && <Badge tone="warning">Test</Badge>}
        </div>
      )}
      {submission.display.length === 0 ? (
        <p className="text-sm text-muted">Maydonlar to‘ldirilmagan.</p>
      ) : (
        <dl className="divide-y divide-line rounded-lg border border-line text-sm">
          {submission.display.map((item) => {
            const isFile = (item.type === "file" || item.type === "photo") && item.file_id;
            return (
              <div
                key={item.key}
                className={cn(
                  "flex gap-x-4 gap-y-1.5 px-3 py-2.5",
                  isFile ? "flex-col sm:flex-row sm:items-center sm:justify-between" : "items-start justify-between",
                )}
              >
                <dt className="shrink-0 text-muted">{item.label}</dt>
                <dd
                  className={cn(
                    "min-w-0 font-medium text-ink [overflow-wrap:anywhere]",
                    !isFile && "max-w-[65%] text-right",
                    (item.type === "number" || item.type === "computed") && "tabular-nums",
                  )}
                >
                  {isFile && item.file_id ? (
                    <FileChip id={item.file_id} name={item.value || `Fayl #${item.file_id}`} photo={item.type === "photo"} />
                  ) : (
                    item.value || "—"
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </div>
  );
}
