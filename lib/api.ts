/**
 * Typed fetch wrapper for the Django API behind the Next.js `/api` rewrite.
 * - relative `/api/...` paths, never a trailing slash
 * - `Authorization: Bearer <access>` from localStorage
 * - one shared refresh request on 401, then the request is retried once;
 *   if the refresh token is rejected the session is cleared and the route
 *   guard sends the user to /login (a network failure keeps the session)
 * - errors are thrown as ApiError exposing DRF `detail` and field errors
 */

import { session } from "./session";

export type QueryValue = string | number | boolean | null | undefined;
export type Query = Record<string, QueryValue>;

export type FieldErrors = Record<string, string>;

const NETWORK_MESSAGE = "Server bilan aloqa yo‘q. Internet aloqasini tekshirib, qayta urinib ko‘ring.";

const SERVER_MESSAGE = "Server vaqtincha javob bermayapti. Birozdan so‘ng qayta urinib ko‘ring.";

const STATUS_MESSAGES: Record<number, string> = {
  400: "Ma’lumotlarda xatolik bor. Maydonlarni tekshiring.",
  401: "Sessiya muddati tugadi. Qaytadan kiring.",
  403: "Bu amal uchun ruxsatingiz yo‘q.",
  404: "Ma’lumot topilmadi.",
  409: "Amalni bajarib bo‘lmadi: ma’lumotlar o‘zgargan. Sahifani yangilang.",
  429: "Juda ko‘p urinish. Birozdan so‘ng qayta urinib ko‘ring.",
  500: SERVER_MESSAGE,
  502: SERVER_MESSAGE,
  503: SERVER_MESSAGE,
  504: SERVER_MESSAGE,
};

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string | null;
  /** Field name -> human message (multiple DRF messages joined). */
  readonly fields: FieldErrors;

  constructor(status: number, message: string, detail: string | null = null, fields: FieldErrors = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.fields = fields;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError(0, NETWORK_MESSAGE);
}

function flattenMessages(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenMessages);
  if (value && typeof value === "object") return Object.values(value).flatMap(flattenMessages);
  return [];
}

function parseError(status: number, body: unknown): ApiError {
  const fallback =
    STATUS_MESSAGES[status] ??
    (status >= 500 ? SERVER_MESSAGE : `Server xatosi (${status}). Birozdan so‘ng qayta urinib ko‘ring.`);
  // Only a parsed DRF JSON object carries user-facing text. Plain-text / HTML bodies (Next proxy
  // "Internal Server Error", Django DEBUG=False 500 page, nginx / ngrok 502 pages) and every 5xx body
  // are never shown: the Uzbek fallback is used instead.
  if (status >= 500 || !body || typeof body !== "object") {
    return new ApiError(status, fallback);
  }
  if (Array.isArray(body)) {
    const messages = flattenMessages(body);
    return new ApiError(status, messages[0] ?? fallback);
  }

  const record = body as Record<string, unknown>;
  // DRF sends `detail` as a string, but `ValidationError({"detail": "..."})` arrives as a list.
  const detailMessages = flattenMessages(record.detail);
  const detail = detailMessages.length > 0 ? detailMessages.join(" ") : null;
  const fields: FieldErrors = {};
  const general: string[] = [];

  for (const [key, value] of Object.entries(record)) {
    if (key === "detail") continue;
    const messages = flattenMessages(value);
    if (messages.length === 0) continue;
    if (key === "non_field_errors") general.push(...messages);
    else fields[key] = messages.join(" ");
  }

  const message = detail ?? general[0] ?? Object.values(fields)[0] ?? fallback;
  return new ApiError(status, message, detail ?? (general.length ? general.join(" ") : null), fields);
}

export function buildPath(path: string, query?: Query): string {
  const clean = path.replace(/\/+$/, "");
  const url = `/api${clean.startsWith("/") ? clean : `/${clean}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, typeof value === "boolean" ? (value ? "true" : "false") : String(value));
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

/* ---------- Data revision ---------- */

// Every successful POST/PATCH bumps the revision; useApi() includes it in its
// request key, so all visible data refreshes after any state change.
let revision = 0;
const revisionListeners = new Set<() => void>();

export const dataRevision = {
  get: (): number => revision,
  subscribe(listener: () => void): () => void {
    revisionListeners.add(listener);
    return () => revisionListeners.delete(listener);
  },
};

function bumpRevision(): void {
  revision += 1;
  revisionListeners.forEach((listener) => listener());
}

/**
 * - `refreshed`: a new access token is stored
 * - `rejected`: the refresh token is invalid/expired (the session is over)
 * - `unreachable`: network/server failure; keep the session and report a network error
 */
type RefreshOutcome = "refreshed" | "rejected" | "unreachable";

let refreshInFlight: Promise<RefreshOutcome> | null = null;

async function refreshAccessToken(): Promise<RefreshOutcome> {
  const refresh = session.getRefresh();
  if (!refresh) return "rejected";
  let response: Response;
  try {
    response = await fetch(buildPath("/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refresh }),
      cache: "no-store",
    });
  } catch {
    return "unreachable";
  }
  if (response.status >= 500) return "unreachable";
  if (!response.ok) return "rejected";
  try {
    const data = (await response.json()) as { access?: unknown };
    if (typeof data.access !== "string" || !data.access) return "rejected";
    session.setAccess(data.access);
    return "refreshed";
  } catch {
    return "rejected";
  }
}

/** Single-flight: concurrent 401s share one refresh request. */
function refreshOnce(): Promise<RefreshOutcome> {
  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Query;
  /** Send the bearer token and handle 401 with refresh (default true). */
  auth?: boolean;
  signal?: AbortSignal;
  /**
   * Do not bump the data revision after a successful POST/PATCH. For writes that change nothing
   * other pages show (bell "mark as read", logout), so open pages are not refetched.
   */
  silent?: boolean;
}

async function send(url: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.auth !== false) {
    const access = session.getAccess();
    if (access) headers.Authorization = `Bearer ${access}`;
  }
  return fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
    cache: "no-store",
  });
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return requestUrl<T>(buildPath(path, options.query), options);
}

/** Like request(), for a URL already built with buildPath(). */
export async function requestUrl<T>(url: string, options: Omit<RequestOptions, "query"> = {}): Promise<T> {
  let response: Response;
  try {
    response = await send(url, options);
    if (response.status === 401 && options.auth !== false) {
      const outcome = await refreshOnce();
      // A network blip must not log the user out: keep the tokens, report the outage.
      if (outcome === "unreachable") throw new ApiError(0, NETWORK_MESSAGE);
      if (outcome === "rejected") {
        session.clear();
        throw parseError(401, await readBody(response));
      }
      // Retry exactly once with the new token; a second 401 ends the session.
      response = await send(url, options);
      if (response.status === 401) {
        session.clear();
      }
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, NETWORK_MESSAGE);
  }

  const body = await readBody(response);
  if (!response.ok) throw parseError(response.status, body);
  if ((options.method ?? "GET") !== "GET" && !options.silent) bumpRevision();
  return body as T;
}

/* ---------- Authenticated binary requests (files, report exports) ---------- */

/** GET with the bearer token + one refresh on 401 (same rules as requestUrl), returning the raw Response. */
async function fetchAuthorized(url: string, signal?: AbortSignal): Promise<Response> {
  const run = () => {
    const access = session.getAccess();
    return fetch(url, {
      headers: access ? { Authorization: `Bearer ${access}` } : {},
      signal,
      cache: "no-store",
    });
  };
  let response: Response;
  try {
    response = await run();
    if (response.status === 401) {
      const outcome = await refreshOnce();
      if (outcome === "unreachable") throw new ApiError(0, NETWORK_MESSAGE);
      if (outcome === "rejected") {
        session.clear();
        throw parseError(401, await readBody(response));
      }
      response = await run();
      if (response.status === 401) session.clear();
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, NETWORK_MESSAGE);
  }
  if (!response.ok) throw parseError(response.status, await readBody(response));
  return response;
}

/** Normalizes `/api/files/41` and `/files/41` to the proxied URL. */
function apiUrl(path: string): string {
  return path.startsWith("/api/") ? path : buildPath(path);
}

/**
 * A private file as a Blob (API_CONTRACT_V3 §4.4: there is no public media URL).
 * Show it with `URL.createObjectURL(blob)` and revoke the URL on unmount (see `useBlobUrl`).
 */
export async function apiBlob(path: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetchAuthorized(apiUrl(path), signal);
  return response.blob();
}

/** Filename from `Content-Disposition` (`filename*` preferred, V3 §15.3). */
export function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      // fall through to the plain name
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1].trim() : fallback;
}

/**
 * Download an export / file with the server's filename (report Excel/PDF, attachments):
 * fetch as Blob, then click a temporary object-URL link.
 */
export async function apiDownload(path: string, query?: Query, fallbackName = "fayl"): Promise<string> {
  const url = path.startsWith("/api/") ? path : buildPath(path, query);
  const response = await fetchAuthorized(url);
  const name = filenameFromDisposition(response.headers.get("Content-Disposition"), fallbackName);
  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 10_000);
  return name;
}

export interface UploadOptions {
  /** 0–100 while the body is sent. */
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

function xhrUpload<T>(url: string, form: FormData, options: UploadOptions): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Accept", "application/json");
    const access = session.getAccess();
    if (access) xhr.setRequestHeader("Authorization", `Bearer ${access}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      let body: unknown = xhr.responseText;
      try {
        body = xhr.responseText ? (JSON.parse(xhr.responseText) as T) : null;
      } catch {
        // keep the text body
      }
      resolve({ status: xhr.status, body });
    };
    xhr.onerror = () => reject(new ApiError(0, NETWORK_MESSAGE));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    options.signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}

/**
 * Multipart upload with progress (`POST /api/files`, V3 §4.2). XMLHttpRequest is used because
 * fetch() cannot report upload progress. One token refresh on 401, like every other request.
 */
export async function uploadForm<T>(path: string, form: FormData, options: UploadOptions = {}): Promise<T> {
  const url = buildPath(path);
  let result = await xhrUpload<T>(url, form, options);
  if (result.status === 401) {
    const outcome = await refreshOnce();
    if (outcome === "unreachable") throw new ApiError(0, NETWORK_MESSAGE);
    if (outcome === "rejected") {
      session.clear();
      throw parseError(401, result.body);
    }
    options.onProgress?.(0);
    result = await xhrUpload<T>(url, form, options);
    if (result.status === 401) session.clear();
  }
  if (result.status < 200 || result.status >= 300) throw parseError(result.status, result.body);
  return result.body as T;
}

export const api = {
  get<T>(path: string, query?: Query, signal?: AbortSignal): Promise<T> {
    return request<T>(path, { query, signal });
  },
  post<T>(path: string, body?: unknown, options: Omit<RequestOptions, "method" | "body"> = {}): Promise<T> {
    return request<T>(path, { ...options, method: "POST", body: body ?? {} });
  },
  patch<T>(path: string, body: unknown, options: Omit<RequestOptions, "method" | "body"> = {}): Promise<T> {
    return request<T>(path, { ...options, method: "PATCH", body });
  },
  delete<T = null>(path: string, options: Omit<RequestOptions, "method" | "body"> = {}): Promise<T> {
    return request<T>(path, { ...options, method: "DELETE" });
  },
};

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
