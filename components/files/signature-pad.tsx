"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Eraser, LoaderCircle, PenLine } from "lucide-react";
import { toApiError } from "@/lib/api";
import { uploadFile } from "@/lib/files";
import type { Attachment, AttachmentPurpose } from "@/lib/types";
import { Button } from "@/components/ui/button";

const WIDTH = 600;
const HEIGHT = 200;

/**
 * On-screen signature of the recipient (TZ §2 "Yetkazib berish dalillarini (foto, imzo)"): drawn with a
 * finger or mouse, saved as a PNG upload of the given purpose and handed to `onSaved` like any other file.
 */
export function SignaturePad({
  purpose,
  disabled = false,
  onSaved,
}: {
  purpose: AttachmentPurpose;
  disabled?: boolean;
  onSaved: (file: Attachment) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    context.lineWidth = 2.5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#16251B";
  }, []);

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    };
  };

  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    if (disabled || saving) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const { x, y } = point(event);
    context.beginPath();
    context.moveTo(x, y);
  };

  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const { x, y } = point(event);
    context.lineTo(x, y);
    context.stroke();
    setEmpty(false);
  };

  const end = () => {
    drawing.current = false;
  };

  const clear = () => {
    const element = canvas.current;
    element?.getContext("2d")?.clearRect(0, 0, WIDTH, HEIGHT);
    setEmpty(true);
    setError(null);
  };

  const save = async () => {
    const element = canvas.current;
    if (!element || empty) return;
    setSaving(true);
    setError(null);
    try {
      const blob = await new Promise<Blob | null>((resolve) => element.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Imzoni saqlab bo‘lmadi.");
      const file = new File([blob], "imzo.png", { type: "image/png" });
      onSaved(await uploadFile(file, purpose));
      clear();
    } catch (exc) {
      setError(toApiError(exc).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-1.5 text-[13px] text-muted">
        <PenLine className="size-3.5" aria-hidden />
        Qabul qiluvchi imzosi (ixtiyoriy)
      </span>
      <canvas
        ref={canvas}
        width={WIDTH}
        height={HEIGHT}
        className="h-32 w-full touch-none rounded-lg border border-dashed border-line-strong bg-surface"
        aria-label="Imzo maydoni: barmoq yoki sichqoncha bilan imzo qo‘ying"
        role="img"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={<Eraser className="size-3.5" aria-hidden />}
          onClick={clear}
          disabled={empty || saving}
        >
          Tozalash
        </Button>
        <Button
          size="sm"
          icon={saving ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> : undefined}
          onClick={save}
          disabled={empty || saving || disabled}
        >
          Imzoni biriktirish
        </Button>
      </div>
      {error && <p className="text-[13px] text-danger">{error}</p>}
    </div>
  );
}
