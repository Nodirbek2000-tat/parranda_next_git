"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Layers, RotateCw } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { CaseDetail } from "@/lib/types";
import { Modal } from "./modal";
import { useToast } from "./toast";
import { Alert, Button, Field, Select } from "./ui";

/** "2-partiyani boshlash": a finished household gets its next partiya; paperwork stages are carried over. */
export function NextCycleButton({ detail }: { detail: CaseDetail }) {
  const router = useRouter();
  const toast = useToast();
  const info = detail.next_cycle;
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(String(info?.default_stage ?? 6));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!info?.can) return null;

  const next = (detail.cycle ?? 1) + 1;
  const chosen = Number(start);
  const skipped = info.options.filter((o) => o.number < chosen);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await api.post<CaseDetail>(`/cases/${detail.id}/next-cycle`, { start_stage: chosen });
      toast.success(`${next}-partiya boshlandi: ${created.code}`);
      router.push(`/cases/${created.id}`);
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} icon={<RotateCw className="size-4" aria-hidden />} className="bg-white text-primary hover:bg-white/90">
        {next}-partiyani boshlash
      </Button>
      {open && (
        <Modal
          title={`${next}-partiyani boshlash`}
          onClose={() => setOpen(false)}
          busy={busy}
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
                Bekor qilish
              </Button>
              <Button onClick={submit} loading={busy}>
                Boshlash
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              <b>{detail.code}</b> partiyasi yakunlangan. Shu xonadon uchun yangi partiya ochiladi: xonadon ma’lumotlari, egasi va veterinari
              ko‘chiriladi.
            </p>
            <Field label="Qaysi bosqichdan boshlanadi" htmlFor="nc-start">
              <Select id="nc-start" value={start} onChange={(e) => setStart(e.target.value)}>
                {info.options.map((o) => (
                  <option key={o.number} value={o.number}>
                    {o.number}. {o.title}
                    {o.number === info.default_stage ? " (odatiy)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            {skipped.length > 0 && (
              <p className="rounded-xl bg-subtle px-3 py-2 text-[13px] text-muted">
                Qayta qilinmaydi (o‘tkaziladi): 1. Inspeksiya, {skipped.map((o) => `${o.number}. ${o.title}`).join(", ")}.
                {chosen > 5 ? " Jo‘jaxona (paket) puli qayta hisoblanmaydi." : ""}
              </p>
            )}
            {error && <Alert>{error}</Alert>}
          </div>
        </Modal>
      )}
    </>
  );
}

/** Links between the partiyas of one household (shown when there is more than one). */
export function CycleLinks({ detail }: { detail: CaseDetail }) {
  const cycles = detail.cycles ?? [];
  if (cycles.length < 2) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-sm">
      <Layers className="size-4 text-white/70" aria-hidden />
      <span className="text-white/70">Partiyalar:</span>
      {cycles.map((c) => (
        <Link
          key={c.id}
          href={`/cases/${c.id}`}
          aria-current={c.id === detail.id ? "page" : undefined}
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
            c.id === detail.id ? "bg-white text-primary" : "bg-white/15 text-white hover:bg-white/25",
          )}
        >
          {c.cycle}-partiya · {c.code}
          {c.status === "DONE" ? " ✓" : ""}
        </Link>
      ))}
    </div>
  );
}
