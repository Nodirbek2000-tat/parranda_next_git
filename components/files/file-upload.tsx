"use client";

import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { Camera, CircleAlert, CloudUpload, LoaderCircle, Paperclip, X } from "lucide-react";
import { toApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { acceptAttributeFor, uploadFile, validateFile } from "@/lib/files";
import { formatFileSize } from "@/lib/format";
import type { Attachment, AttachmentPurpose } from "@/lib/types";
import { Button, IconButton } from "@/components/ui/button";
import { AttachmentThumb } from "./attachment-list";

interface PendingUpload {
  key: number;
  name: string;
  size: number;
  progress: number;
  error: string | null;
  controller: AbortController;
}

export interface FileUploadProps {
  /** Upload purpose (V3 §4.2); the server checks it against the role. */
  purpose: AttachmentPurpose;
  /** Files uploaded so far (send `value.map((f) => f.id)` as `file_ids`). */
  value: Attachment[];
  onChange: (files: Attachment[]) => void;
  /** Max files (contract: 0–10 per object, 5 for vet requests). */
  max?: number;
  /** Called with `true` while any upload runs: disable the form's submit button meanwhile. */
  onBusyChange?: (busy: boolean) => void;
  label?: string;
  hint?: string;
  /** Show the camera button (phones; uses `capture="environment"`). Default true. */
  camera?: boolean;
  disabled?: boolean;
  /** Field error from the server (`file_ids`). */
  error?: string;
  id?: string;
}

/**
 * Drag & drop / file picker / phone camera upload with progress and client-side validation
 * (≤ 10 MB, JPG/PNG/WEBP/PDF). Each file is uploaded immediately to `POST /api/files`;
 * the parent binds the returned ids with its own write endpoint.
 */
export function FileUpload({
  purpose,
  value,
  onChange,
  max = 10,
  onBusyChange,
  label = "Fayllar",
  hint = "JPG, PNG, WEBP yoki PDF · har biri 10 MB gacha",
  camera = true,
  disabled = false,
  error,
  id,
}: FileUploadProps) {
  const autoId = useId();
  const inputId = id ?? `upload-${autoId}`;
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [dragging, setDragging] = useState(false);
  const counter = useRef(0);
  const latest = useRef(value);
  const controllers = useRef(new Set<AbortController>());

  useEffect(() => {
    latest.current = value;
  }, [value]);

  const running = pending.some((item) => item.error === null);
  useEffect(() => {
    onBusyChange?.(running);
  }, [running, onBusyChange]);

  useEffect(() => {
    const running = controllers.current;
    // Abort uploads still running when the form closes.
    return () => running.forEach((controller) => controller.abort());
  }, []);

  const remaining = max - value.length - pending.filter((item) => item.error === null).length;

  const start = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    let slots = remaining;
    for (const file of list) {
      counter.current += 1;
      const key = counter.current;
      const controller = new AbortController();
      const invalid = slots <= 0 ? `Ko‘pi bilan ${max} ta fayl biriktirish mumkin.` : validateFile(file, purpose);
      const entry: PendingUpload = { key, name: file.name, size: file.size, progress: 0, error: invalid, controller };
      setPending((items) => [...items, entry]);
      if (invalid) continue;
      slots -= 1;
      controllers.current.add(controller);
      uploadFile(file, purpose, {
        signal: controller.signal,
        onProgress: (progress) =>
          setPending((items) => items.map((item) => (item.key === key ? { ...item, progress } : item))),
      })
        .then((attachment) => {
          setPending((items) => items.filter((item) => item.key !== key));
          latest.current = [...latest.current, attachment];
          onChange(latest.current);
        })
        .catch((caught: unknown) => {
          if (caught instanceof DOMException && caught.name === "AbortError") {
            setPending((items) => items.filter((item) => item.key !== key));
            return;
          }
          const message = toApiError(caught);
          const text = message.fields.file ?? message.fields.purpose ?? message.message;
          setPending((items) => items.map((item) => (item.key === key ? { ...item, error: text } : item)));
        })
        .finally(() => controllers.current.delete(controller));
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!disabled) start(event.dataTransfer.files);
  };

  const dismiss = (item: PendingUpload) => {
    item.controller.abort();
    setPending((items) => items.filter((entry) => entry.key !== item.key));
  };

  const full = remaining <= 0;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={inputId} className="text-[13px] font-medium text-ink">
          {label}
        </label>
        <span className="text-xs tabular-nums text-muted">
          {value.length} / {max}
        </span>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled && !full) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-5 text-center transition-colors",
          dragging ? "border-accent bg-accent-soft" : error ? "border-danger bg-danger-soft/40" : "border-line-strong bg-subtle",
          (disabled || full) && "opacity-60",
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-surface text-accent shadow-card">
          <CloudUpload className="size-5" aria-hidden />
        </span>
        <div className="text-[13px] text-muted">
          <p className="hidden text-ink sm:block">Faylni shu yerga tashlang yoki tanlang</p>
          <p>{full ? "Fayllar soni chegarasiga yetildi" : hint}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {camera && (
            <Button
              variant="accent"
              size="sm"
              className="sm:hidden"
              icon={<Camera className="size-4" aria-hidden />}
              disabled={disabled || full}
              onClick={() => cameraInput.current?.click()}
            >
              Suratga olish
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={<Paperclip className="size-4" aria-hidden />}
            disabled={disabled || full}
            onClick={() => fileInput.current?.click()}
          >
            Fayl tanlash
          </Button>
        </div>
        <input
          ref={fileInput}
          id={inputId}
          type="file"
          multiple={max > 1}
          accept={acceptAttributeFor(purpose)}
          className="sr-only"
          tabIndex={-1}
          disabled={disabled || full}
          aria-describedby={error ? `${inputId}-error` : undefined}
          onChange={(event) => {
            if (event.target.files) start(event.target.files);
            event.target.value = "";
          }}
        />
        {camera && (
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            disabled={disabled || full}
            onChange={(event) => {
              if (event.target.files) start(event.target.files);
              event.target.value = "";
            }}
          />
        )}
      </div>

      {error && (
        <p id={`${inputId}-error`} className="text-[13px] text-danger">
          {error}
        </p>
      )}

      {(pending.length > 0 || value.length > 0) && (
        <ul className="flex flex-col gap-2" aria-live="polite">
          {value.map((file) => (
            <li key={file.id} className="flex items-center gap-3 rounded-lg border border-line bg-surface px-2.5 py-2">
              <AttachmentThumb file={file} className="size-10" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{file.name}</span>
                <span className="text-xs text-muted">{formatFileSize(file.size)}</span>
              </span>
              <IconButton
                label={`${file.name}: olib tashlash`}
                tone="quiet-danger"
                disabled={disabled}
                onClick={() => onChange(value.filter((item) => item.id !== file.id))}
              >
                <X className="size-4" aria-hidden />
              </IconButton>
            </li>
          ))}
          {pending.map((item) => (
            <li
              key={item.key}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-2.5 py-2",
                item.error ? "border-danger/30 bg-danger-soft" : "border-line bg-surface",
              )}
            >
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-md",
                  item.error ? "bg-surface text-danger" : "bg-subtle text-muted",
                )}
              >
                {item.error ? (
                  <CircleAlert className="size-4" aria-hidden />
                ) : (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{item.name}</span>
                {item.error ? (
                  <span className="block text-xs text-danger">{item.error}</span>
                ) : (
                  <span className="mt-1 flex items-center gap-2">
                    <span
                      className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10"
                      role="progressbar"
                      aria-label={`${item.name} yuklanmoqda`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={item.progress}
                    >
                      <span className="block h-full rounded-full bg-accent transition-[width]" style={{ width: `${item.progress}%` }} />
                    </span>
                    <span className="w-9 text-right text-xs tabular-nums text-muted">{item.progress}%</span>
                  </span>
                )}
              </span>
              <IconButton label={item.error ? "Yopish" : "Yuklashni to‘xtatish"} onClick={() => dismiss(item)}>
                <X className="size-4" aria-hidden />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
