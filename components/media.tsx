"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, FileText, ImageOff, LoaderCircle, MapPin, Paperclip, RefreshCw, X } from "lucide-react";
import { api, apiBlob, apiDownload, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtDateTime } from "@/lib/format";
import type { CaseDocument, Photo } from "@/lib/types";
import { Modal } from "./modal";
import { useToast } from "./toast";
import { Alert, Button, IconButton } from "./ui";

/* ================= GPS ================= */

export interface Coords {
  lat: number;
  lng: number;
  accuracy?: number;
}

const GEO_ERRORS: Record<number, string> = {
  1: "Joylashuvga ruxsat berilmadi. Telefon sozlamalarida ruxsat bering.",
  2: "Joylashuvni aniqlab bo‘lmadi. GPS yoqilganini tekshiring.",
  3: "Joylashuvni aniqlash vaqti tugadi. Qayta urinib ko‘ring.",
};

export function getPosition(timeout = 15000): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Bu qurilmada GPS mavjud emas."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(new Error(GEO_ERRORS[err.code] ?? "Joylashuvni aniqlab bo‘lmadi.")),
      { enableHighAccuracy: true, timeout, maximumAge: 30000 },
    );
  });
}

/** "GPS ni aniqlash" button with the result. */
export function GpsButton({ value, onChange }: { value: Coords | null; onChange: (coords: Coords | null) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locate = async () => {
    setLoading(true);
    setError(null);
    try {
      onChange(await getPosition());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Joylashuvni aniqlab bo‘lmadi.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={value ? "secondary" : "accent"} loading={loading} onClick={locate} icon={<MapPin className="size-4" aria-hidden />}>
          {value ? "GPS ni yangilash" : "GPS ni aniqlash"}
        </Button>
        {value && (
          <a
            href={`https://maps.google.com/?q=${value.lat},${value.lng}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-accent underline underline-offset-2"
          >
            {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
            {value.accuracy ? ` (±${Math.round(value.accuracy)} m)` : ""}
          </a>
        )}
      </div>
      {error && <Alert tone="warning">{error}</Alert>}
    </div>
  );
}

/* ================= live photo ================= */

export interface UploadedPhoto {
  id: number;
  preview: string;
  live: boolean;
}

async function uploadPhoto(blob: Blob, live: boolean, coords: Coords | null, takenAt: Date): Promise<number> {
  const form = new FormData();
  form.append("image", blob, `photo-${takenAt.getTime()}.jpg`);
  form.append("taken_at", takenAt.toISOString());
  form.append("live", live ? "true" : "false");
  if (coords) {
    form.append("lat", coords.lat.toFixed(6));
    form.append("lng", coords.lng.toFixed(6));
  }
  const result = await api.upload<{ id: number }>("/files/photo", form);
  return result.id;
}

/**
 * Live camera photos: getUserMedia (back camera) → canvas → upload with live=true, taken_at and GPS.
 * Without a camera: <input type=file accept=image/* capture=environment> with live=false. No gallery picker.
 */
export function LivePhotos({
  value,
  onChange,
  coords,
  onCoords,
  label = "Jonli rasm",
}: {
  value: UploadedPhoto[];
  onChange: (photos: UploadedPhoto[]) => void;
  /** GPS to attach; when missing, the position is requested at capture time. */
  coords: Coords | null;
  onCoords?: (coords: Coords) => void;
  label?: string;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const resolveCoords = useCallback(async (): Promise<Coords | null> => {
    if (coords) return coords;
    try {
      const found = await getPosition(8000);
      onCoords?.(found);
      return found;
    } catch {
      return null;
    }
  }, [coords, onCoords]);

  const save = useCallback(
    async (blob: Blob, live: boolean, takenAt: Date) => {
      setUploading(true);
      try {
        const where = await resolveCoords();
        const id = await uploadPhoto(blob, live, where, takenAt);
        onChange([...valueRef.current, { id, preview: URL.createObjectURL(blob), live }]);
        toast.success("Rasm yuklandi");
        return true;
      } catch (caught) {
        toast.error(errorMessage(caught));
        return false;
      } finally {
        setUploading(false);
      }
    },
    [resolveCoords, onChange, toast],
  );

  const openCamera = () => {
    if (typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function") setOpen(true);
    else fileRef.current?.click();
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Faqat rasm yuklash mumkin.");
      return;
    }
    await save(file, false, new Date());
  };

  const remove = (id: number) => onChange(value.filter((photo) => photo.id !== id));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {value.map((photo) => (
          <div key={photo.id} className="relative size-20 overflow-hidden rounded-xl border border-line bg-subtle">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.preview} alt="Rasm" className="size-full object-cover" />
            {!photo.live && <span className="absolute inset-x-0 bottom-0 bg-warning/90 px-1 text-center text-[10px] text-warning-ink">fayl</span>}
            <button
              type="button"
              onClick={() => remove(photo.id)}
              aria-label="Rasmni olib tashlash"
              className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={openCamera}
          disabled={uploading}
          className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-accent/40 bg-accent-soft/50 text-[11px] font-medium text-primary disabled:opacity-60"
        >
          {uploading ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <Camera className="size-5" aria-hidden />}
          {uploading ? "Yuklanmoqda" : label}
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      {open && (
        <CameraModal
          onClose={() => setOpen(false)}
          onFallback={() => {
            setOpen(false);
            fileRef.current?.click();
          }}
          onCapture={async (blob, takenAt) => {
            const ok = await save(blob, true, takenAt);
            if (ok) setOpen(false);
          }}
          busy={uploading}
        />
      )}
    </div>
  );
}

function CameraModal({
  onClose,
  onCapture,
  onFallback,
  busy,
}: {
  onClose: () => void;
  onCapture: (blob: Blob, takenAt: Date) => void;
  onFallback: () => void;
  busy: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1600 }, height: { ideal: 1200 } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          void video.play().catch(() => undefined);
        }
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        const name = caught instanceof DOMException ? caught.name : "";
        setError(
          name === "NotAllowedError"
            ? "Kameraga ruxsat berilmadi. Ruxsat bering yoki telefon kamerasi orqali suratga oling."
            : "Kamerani ochib bo‘lmadi. Telefon kamerasi orqali suratga oling.",
        );
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [facing]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const takenAt = new Date();
    canvas.toBlob((blob) => blob && onCapture(blob, takenAt), "image/jpeg", 0.85);
  };

  return (
    <Modal title="Jonli rasm" onClose={onClose} busy={busy}>
      <div className="flex flex-col gap-3">
        {error ? (
          <>
            <Alert tone="warning">{error}</Alert>
            <Button onClick={onFallback} icon={<Camera className="size-4" aria-hidden />}>
              Telefon kamerasi bilan olish
            </Button>
          </>
        ) : (
          <>
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-black sm:aspect-video">
              <video ref={videoRef} playsInline muted autoPlay onLoadedData={() => setReady(true)} className="size-full object-cover" />
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
                  <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden /> Kamera ochilmoqda…
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <IconButton
                label="Kamerani almashtirish"
                onClick={() => {
                  setReady(false);
                  setFacing((f) => (f === "environment" ? "user" : "environment"));
                }}
                className="border border-line"
              >
                <RefreshCw className="size-4" aria-hidden />
              </IconButton>
              <Button className="flex-1" onClick={capture} disabled={!ready} loading={busy} icon={<Camera className="size-4" aria-hidden />}>
                Suratga olish
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ================= documents ================= */

export interface UploadedDoc {
  id: number;
  name: string;
}

export function DocumentUpload({ value, onChange }: { value: UploadedDoc[]; onChange: (docs: UploadedDoc[]) => void }) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    setUploading(true);
    const added: UploadedDoc[] = [];
    for (const file of files) {
      try {
        const form = new FormData();
        form.append("file", file, file.name);
        const result = await api.upload<{ id: number }>("/files/document", form);
        added.push({ id: result.id, name: file.name });
      } catch (caught) {
        toast.error(`${file.name}: ${errorMessage(caught)}`);
      }
    }
    setUploading(false);
    if (added.length) onChange([...value, ...added]);
  };

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {value.map((doc) => (
            <li key={doc.id} className="flex items-center gap-2 rounded-lg border border-line bg-subtle px-3 py-2 text-sm">
              <FileText className="size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{doc.name}</span>
              <button type="button" onClick={() => onChange(value.filter((d) => d.id !== doc.id))} aria-label="Olib tashlash" className="text-muted hover:text-danger">
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button variant="secondary" loading={uploading} onClick={() => ref.current?.click()} icon={<Paperclip className="size-4" aria-hidden />} className="self-start">
        Hujjat biriktirish
      </Button>
      <input ref={ref} type="file" multiple className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" onChange={onFile} />
    </div>
  );
}

/* ================= viewing stored files ================= */

/** Image from the private files API (fetched with the bearer token). */
export function AuthImage({ photo, className }: { photo: Photo; className?: string }) {
  const [state, setState] = useState<{ id: number; url: string | null; failed: boolean }>({ id: -1, url: null, failed: false });
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;
    apiBlob(photo.url || `/files/photo/${photo.id}`, controller.signal)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setState({ id: photo.id, url: objectUrl, failed: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ id: photo.id, url: null, failed: true });
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo.id, photo.url]);

  const current = state.id === photo.id ? state : { url: null, failed: false };
  return (
    <>
      <button
        type="button"
        onClick={() => current.url && setZoom(true)}
        className={cn("relative flex items-center justify-center overflow-hidden rounded-xl border border-line bg-subtle", className)}
        aria-label="Rasmni kattalashtirish"
      >
        {current.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.url} alt="Bosqich rasmi" className="size-full object-cover" />
        ) : current.failed ? (
          <ImageOff className="size-5 text-muted" aria-hidden />
        ) : (
          <LoaderCircle className="size-4 animate-spin text-muted" aria-hidden />
        )}
        {photo.live === false && <span className="absolute inset-x-0 bottom-0 bg-warning/90 text-center text-[10px] text-warning-ink">fayl</span>}
      </button>
      {zoom && current.url && (
        <Modal title="Rasm" onClose={() => setZoom(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.url} alt="Bosqich rasmi" className="w-full rounded-xl" />
          <p className="mt-2 text-xs text-muted">
            {photo.live ? "Jonli kamera" : "Fayldan"} · {fmtDateTime(photo.taken_at)}
            {photo.lat && photo.lng ? (
              <>
                {" · "}
                <a href={`https://maps.google.com/?q=${photo.lat},${photo.lng}`} target="_blank" rel="noreferrer" className="text-accent underline">
                  {Number(photo.lat).toFixed(5)}, {Number(photo.lng).toFixed(5)}
                </a>
              </>
            ) : null}
          </p>
        </Modal>
      )}
    </>
  );
}

export function DocumentLink({ doc }: { doc: CaseDocument }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const name = doc.original_name || `hujjat-${doc.id}`;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await apiDownload(`/files/document/${doc.id}`, name);
        } catch (caught) {
          toast.error(errorMessage(caught));
        } finally {
          setBusy(false);
        }
      }}
      className="flex max-w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-left text-sm hover:bg-subtle"
    >
      {busy ? <LoaderCircle className="size-4 animate-spin text-accent" aria-hidden /> : <FileText className="size-4 shrink-0 text-accent" aria-hidden />}
      <span className="truncate">{name}</span>
    </button>
  );
}
