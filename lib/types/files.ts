/** Files (API_CONTRACT_V3 §4). */

export type AttachmentPurpose =
  | "DELIVERY_PROOF"
  | "VET_VISIT"
  | "VACCINATION"
  | "DISEASE"
  | "TREATMENT"
  | "VET_REQUEST"
  | "STOCK_DOCUMENT"
  /** API_CONTRACT_V4 §1.2: file / photo fields of builder forms. */
  | "FORM_FILE";

export type AttachmentContentType = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

/** The `File` object returned by `POST /api/files` and embedded as `files` / `proof_files`. */
export interface Attachment {
  id: number;
  name: string;
  content_type: AttachmentContentType;
  size: number;
  purpose: AttachmentPurpose;
  /** Relative API path (`/api/files/41`): load it with `apiBlob()`, never as a plain <img src>. */
  url: string;
  created_at: string;
}
