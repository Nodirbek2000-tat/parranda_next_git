"use client";

/**
 * Private files (API_CONTRACT_V3 §4): client-side validation (same rules as the server),
 * upload with progress and authenticated previews. The server re-checks everything.
 */

import { useEffect, useState } from "react";
import { apiBlob, isAbortError, toApiError, uploadForm, type ApiError, type UploadOptions } from "./api";
import type { Attachment, AttachmentPurpose } from "./types";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"] as const;
/** Value for `<input accept>`. */
export const ACCEPT_ATTRIBUTE = [...ACCEPTED_TYPES, ...ACCEPTED_EXTENSIONS].join(",");

export const MSG_TOO_BIG = "Fayl hajmi 10 MB dan oshmasligi kerak.";
export const MSG_BAD_TYPE = "Faqat JPG, PNG, WEBP yoki PDF fayl yuklash mumkin.";
export const MSG_IMAGE_ONLY = "Bu yerga faqat JPG, PNG yoki WEBP rasm yuklash mumkin.";

/** Purposes the server limits to photos (owner uploads: no PDF). */
const IMAGE_ONLY_PURPOSES: readonly AttachmentPurpose[] = ["VET_REQUEST"];
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

export function isImageOnlyPurpose(purpose: AttachmentPurpose): boolean {
  return IMAGE_ONLY_PURPOSES.includes(purpose);
}

/** `<input accept>` for a purpose. */
export function acceptAttributeFor(purpose: AttachmentPurpose): string {
  return isImageOnlyPurpose(purpose)
    ? ["image/jpeg", "image/png", "image/webp", ...IMAGE_EXTENSIONS].join(",")
    : ACCEPT_ATTRIBUTE;
}

function extensionOf(name: string): string {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "";
}

/** `null` when the file may be uploaded, otherwise the Uzbek message the server would answer. */
export function validateFile(file: File, purpose?: AttachmentPurpose): string | null {
  if (file.size > MAX_UPLOAD_BYTES) return MSG_TOO_BIG;
  const extOk = (ACCEPTED_EXTENSIONS as readonly string[]).includes(extensionOf(file.name));
  // Some mobile browsers leave `type` empty for camera photos: the extension then decides.
  const typeOk = !file.type || (ACCEPTED_TYPES as readonly string[]).includes(file.type);
  if (!(extOk && typeOk)) return MSG_BAD_TYPE;
  if (purpose && isImageOnlyPurpose(purpose) && !IMAGE_EXTENSIONS.includes(extensionOf(file.name))) {
    return MSG_IMAGE_ONLY;
  }
  return null;
}

export function isImage(contentType: string): boolean {
  return contentType.startsWith("image/");
}

/** `POST /api/files` (multipart). Bind the returned id via the module endpoint's `file_ids`. */
export function uploadFile(file: File, purpose: AttachmentPurpose, options: UploadOptions = {}): Promise<Attachment> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("purpose", purpose);
  return uploadForm<Attachment>("/files", form, options);
}

export interface BlobUrlState {
  url: string | null;
  error: ApiError | null;
  loading: boolean;
}

/**
 * Object URL of a private file (`/api/files/{id}`), revoked on unmount / path change.
 * Pass `null` to skip loading.
 */
export function useBlobUrl(path: string | null): BlobUrlState {
  const [state, setState] = useState<{ path: string | null; url: string | null; error: ApiError | null }>({
    path: null,
    url: null,
    error: null,
  });

  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    let objectUrl: string | null = null;
    apiBlob(path, controller.signal)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setState({ path, url: objectUrl, error: null });
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        setState({ path, url: null, error: toApiError(error) });
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  const current = state.path === path;
  return {
    url: current ? state.url : null,
    error: current ? state.error : null,
    loading: Boolean(path) && !current,
  };
}
