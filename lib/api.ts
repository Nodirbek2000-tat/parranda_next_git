/**
 * Fetch wrapper for the Django API (ARCHITECTURE_V2 §4).
 * - relative `/api/...` paths, no trailing slash
 * - `Authorization: Bearer <access>`; on 401 one shared refresh, then the request is retried once
 * - errors are thrown as ApiError with the Uzbek `detail` (or the first field error)
 */

import { session } from "./session";

export type Query = Record<string, string | number | boolean | null | undefined>;

const NETWORK_MESSAGE = "Server bilan aloqa yo‘q. Internetni tekshirib, qayta urinib ko‘ring.";
const SERVER_MESSAGE = "Server vaqtincha javob bermayapti. Birozdan so‘ng qayta urinib ko‘ring.";

const STATUS_MESSAGES: Record<number, string> = {
  400: "Ma’lumotlarda xatolik bor. Maydonlarni tekshiring.",
  401: "Sessiya muddati tugadi. Qaytadan kiring.",
  403: "Bu amal uchun ruxsatingiz yo‘q.",
  404: "Ma’lumot topilmadi.",
  409: "Amalni bajarib bo‘lmadi. Sahifani yangilang.",
  413: "Fayl juda katta.",
  429: "Juda ko‘p urinish. Birozdan so‘ng qayta urinib ko‘ring.",
};

export class ApiError extends Error {
  readonly status: number;
  /** Field name -> message (nested `data.<key>` errors are flattened to `<key>`). */
  readonly fields: Record<string, string>;
  readonly body: unknown;

  constructor(status: number, message: string, fields: Record<string, string> = {}, body: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
    this.body = body;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return NETWORK_MESSAGE;
}

function flatten(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flatten);
  if (value && typeof value === "object") return Object.values(value).flatMap(flatten);
  return [];
}

const FIELD_LABELS: Record<string, string> = {
  photo_ids: "Rasm",
  document_ids: "Hujjat",
  package_id: "Paket",
  reason: "Sabab",
};

function parseError(status: number, body: unknown): ApiError {
  const fallback = STATUS_MESSAGES[status] ?? (status >= 500 ? SERVER_MESSAGE : `Server xatosi (${status}).`);
  if (status >= 500 || !body || typeof body !== "object") return new ApiError(status, fallback);
  if (Array.isArray(body)) return new ApiError(status, flatten(body)[0] ?? fallback, {}, body);

  const record = body as Record<string, unknown>;
  const detail = flatten(record.detail).join(" ") || null;
  const fields: Record<string, string> = {};
  const general: string[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (key === "detail") continue;
    if (key === "non_field_errors") {
      general.push(...flatten(value));
      continue;
    }
    // Nested field errors: {"errors": {"chicks_count": ["..."]}} or {"data": {...}}
    if ((key === "data" || key === "errors") && value && typeof value === "object" && !Array.isArray(value)) {
      for (const [inner, innerValue] of Object.entries(value as Record<string, unknown>)) {
        const messages = flatten(innerValue);
        if (messages.length) fields[inner] = messages.join(" ");
      }
      continue;
    }
    const messages = flatten(value);
    if (messages.length) fields[key] = messages.join(" ");
  }
  // 409 at stage 5 may carry the missing items list.
  const missing = Array.isArray(record.missing) ? (record.missing as unknown[]) : null;
  let message = detail ?? general[0] ?? null;
  if (!message) {
    const [key, text] = Object.entries(fields)[0] ?? [];
    message = key ? (FIELD_LABELS[key] ? `${FIELD_LABELS[key]}: ${text}` : text) : fallback;
  }
  if (missing && missing.length && detail) {
    const lines = missing.map((item) => {
      if (item && typeof item === "object") {
        const m = item as Record<string, unknown>;
        const name = String(m.name ?? m.product_name ?? m.product ?? "");
        const unit = m.unit ? ` ${String(m.unit)}` : "";
        const need = m.need ?? m.required ?? m.qty;
        const have = m.have ?? m.balance;
        return `${name}: ${[need !== undefined ? `kerak ${need}${unit}` : "", have !== undefined ? `bor ${have}${unit}` : ""].filter(Boolean).join(", ")}`;
      }
      return String(item);
    });
    message = [detail, ...lines].join("\n");
  }
  return new ApiError(status, message ?? fallback, fields, body);
}

export function buildPath(path: string, query?: Query): string {
  const clean = path.replace(/\/+$/, "");
  const url = `/api${clean.startsWith("/") ? clean : `/${clean}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

/* ---------- data revision: every successful write refreshes visible data ---------- */

let revision = 0;
const revisionListeners = new Set<() => void>();
export const dataRevision = {
  get: () => revision,
  subscribe(listener: () => void) {
    revisionListeners.add(listener);
    return () => {
      revisionListeners.delete(listener);
    };
  },
};
function bumpRevision() {
  revision += 1;
  revisionListeners.forEach((listener) => listener());
}

/* ---------- token refresh (single flight) ---------- */

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
    const data = (await response.json()) as { access?: unknown; refresh?: unknown };
    if (typeof data.access !== "string" || !data.access) return "rejected";
    if (typeof data.refresh === "string" && data.refresh) session.setTokens(data.access, data.refresh);
    else session.setAccess(data.access);
    return "refreshed";
  } catch {
    return "rejected";
  }
}

function refreshOnce(): Promise<RefreshOutcome> {
  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
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

/** Runs `run` with the current token; on 401 refreshes once and retries once. */
async function withAuth(run: () => Promise<Response>, auth: boolean): Promise<Response> {
  let response: Response;
  try {
    response = await run();
    if (response.status === 401 && auth) {
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
  return response;
}

function authHeader(): Record<string, string> {
  const access = session.getAccess();
  return access ? { Authorization: `Bearer ${access}` } : {};
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
}

export async function requestUrl<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const auth = options.auth !== false;
  const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await withAuth(() => {
    const headers: Record<string, string> = { Accept: "application/json", ...(auth ? authHeader() : {}) };
    if (options.body !== undefined && !isForm) headers["Content-Type"] = "application/json";
    return fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : isForm ? (options.body as FormData) : JSON.stringify(options.body),
      signal: options.signal,
      cache: "no-store",
    });
  }, auth);
  const body = await readBody(response);
  if (!response.ok) throw parseError(response.status, body);
  if ((options.method ?? "GET") !== "GET") bumpRevision();
  return body as T;
}

export const api = {
  get<T>(path: string, query?: Query, signal?: AbortSignal): Promise<T> {
    return requestUrl<T>(buildPath(path, query), { signal });
  },
  post<T>(path: string, body?: unknown, auth = true): Promise<T> {
    return requestUrl<T>(buildPath(path), { method: "POST", body: body ?? {}, auth });
  },
  patch<T>(path: string, body: unknown): Promise<T> {
    return requestUrl<T>(buildPath(path), { method: "PATCH", body });
  },
  delete<T = null>(path: string): Promise<T> {
    return requestUrl<T>(buildPath(path), { method: "DELETE" });
  },
  /** Multipart upload (files). */
  upload<T>(path: string, form: FormData): Promise<T> {
    return requestUrl<T>(buildPath(path), { method: "POST", body: form });
  },
};

/** A private file (photo, document) as a Blob, with the bearer token. */
export async function apiBlob(path: string, signal?: AbortSignal): Promise<Blob> {
  const url = path.startsWith("/api/") ? path : buildPath(path);
  const response = await withAuth(() => fetch(url, { headers: authHeader(), signal, cache: "no-store" }), true);
  if (!response.ok) throw parseError(response.status, await readBody(response));
  return response.blob();
}

function filenameFrom(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      // use the plain name
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1].trim() : fallback;
}

/** Download a file (PDF, document) with the auth header and the server's filename. */
export async function apiDownload(path: string, fallbackName: string): Promise<void> {
  const url = path.startsWith("/api/") ? path : buildPath(path);
  const response = await withAuth(() => fetch(url, { headers: authHeader(), cache: "no-store" }), true);
  if (!response.ok) throw parseError(response.status, await readBody(response));
  const name = filenameFrom(response.headers.get("Content-Disposition"), fallbackName);
  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 15_000);
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** Lists may come as a plain array or as a DRF page `{results: [...]}`. */
export function listOf<T>(data: T[] | { results?: T[] } | null | undefined): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return Array.isArray(data.results) ? data.results : [];
}
