"use client";

import { useState, type ReactNode } from "react";
import { Bug, CalendarDays, MessageSquareHeart, Pill, Send, Stethoscope, Syringe, X } from "lucide-react";
import { api } from "@/lib/api";
import { collect, useForm } from "@/lib/form";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { DISEASE_STATUS, HEALTH_STATUS, VET_REQUEST_STATUS } from "@/lib/status";
import { useApi } from "@/lib/use-api";
import type { Attachment, MyVet, VetRequest } from "@/lib/types";
import { AttachmentList } from "@/components/files/attachment-list";
import { FileUpload } from "@/components/files/file-upload";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { Field, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { DiseaseDetailModal } from "./disease-detail";
import { PlannedDate, TextBlock, vetName } from "./shared";

/** /my/vet — the owner's vet page (V3 §8.8 `GET /api/my/vet`, §15.3). */
export function MyVetPage() {
  const vet = useApi<MyVet>("/my/vet");
  const toast = useToast();
  const confirm = useConfirm();
  const [creating, setCreating] = useState(false);
  const [diseaseId, setDiseaseId] = useState<number | null>(null);
  const data = vet.data;

  if (!data) {
    if (vet.error) {
      return (
        <Card>
          <ErrorState error={vet.error} onRetry={vet.error.status === 403 ? undefined : vet.reload} />
        </Card>
      );
    }
    return <PageSkeleton />;
  }

  const openRequests = data.requests.filter((row) => row.status !== "CLOSED").length;

  const withdraw = (row: VetRequest) => {
    void confirm({
      title: "Murojaatni bekor qilish",
      confirmLabel: "Bekor qilish",
      tone: "danger",
      message: <p>{row.code} murojaati bekor qilinadi. Veterinar uni ko‘rib chiqmaydi.</p>,
      onConfirm: async () => {
        await api.post<VetRequest>(`/vet/requests/${row.id}/close`, {});
        toast.success("Murojaat bekor qilindi");
      },
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <StaleDataError error={vet.error} onRetry={vet.reload} className="rounded-xl border" />
      <PageHeader
        title="Veterinar"
        description={`${data.household.name} · tekshiruvlar, emlashlar, xulosalar va murojaatlar`}
        actions={
          <Button icon={<MessageSquareHeart className="size-4" aria-hidden />} onClick={() => setCreating(true)} disabled={openRequests >= 5}>
            Veterinarga murojaat
          </Button>
        }
      />
      {openRequests >= 5 && <Alert tone="warning">Sizda 5 ta ochiq murojaat bor. Avval javobni kuting.</Alert>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Keyingi tekshiruvlar" icon={Stethoscope} empty="Rejalashtirilgan tekshiruv yo‘q" count={data.upcoming_visits.length}>
          {data.upcoming_visits.map((visit) => (
            <Row
              key={visit.id}
              title={visit.purpose}
              meta={`${visit.code} · ${vetName(visit.vet)}`}
              aside={<PlannedDate date={visit.planned_date} overdue={visit.is_overdue} />}
            />
          ))}
        </Section>
        <Section title="Keyingi emlashlar" icon={Syringe} empty="Rejalashtirilgan emlash yo‘q" count={data.upcoming_vaccinations.length}>
          {data.upcoming_vaccinations.map((item) => (
            <Row
              key={item.id}
              title={item.vaccine_name}
              meta={[item.code, item.dose, item.birds_planned ? `${formatNumber(item.birds_planned)} bosh` : ""].filter(Boolean).join(" · ")}
              aside={<PlannedDate date={item.planned_date} overdue={item.is_overdue} />}
            />
          ))}
        </Section>
      </div>

      <Card>
        <CardHeader title="Oxirgi xulosalar va tavsiyalar" description="Veterinar tekshiruvlari natijasi" />
        <div className="mt-3 border-t border-line">
          {data.recent_conclusions.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Hali tekshiruv o‘tkazilmagan" />
          ) : (
            <ul className="divide-y divide-line">
              {data.recent_conclusions.map((visit) => (
                <li key={visit.id} className="flex flex-col gap-3 px-4 py-4 sm:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-ink">
                      {formatDateTime(visit.done_at)} <span className="font-normal text-muted">· {vetName(visit.vet)}</span>
                    </span>
                    {visit.health_status && <StatusBadge map={HEALTH_STATUS} status={visit.health_status} label={visit.health_status_display ?? undefined} />}
                  </div>
                  <TextBlock title="Xulosa" text={visit.conclusion} />
                  <TextBlock title="Tavsiyalar" text={visit.recommendations} />
                  {visit.files.length > 0 && <AttachmentList files={visit.files} />}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Davolash" icon={Pill} empty="Faol davolash yo‘q" count={data.active_treatments.length}>
          {data.active_treatments.map((row) => (
            <li key={row.id} className="px-4 py-3 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">
                  {row.drug_name}
                  {row.dosage && <span className="font-normal text-muted"> · {row.dosage}</span>}
                </span>
                <span className="text-xs tabular-nums text-muted">
                  {formatDate(row.start_date)}
                  {row.end_date ? ` – ${formatDate(row.end_date)}` : ""}
                </span>
              </div>
              {row.instructions && <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{row.instructions}</p>}
            </li>
          ))}
        </Section>
        <Section title="Ochiq kasalliklar" icon={Bug} empty="Ochiq kasallik yo‘q" count={data.open_diseases.length}>
          {data.open_diseases.map((row) => (
            <li key={row.id}>
              <button type="button" onClick={() => setDiseaseId(row.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-subtle sm:px-6">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">{row.disease_name}</span>
                  <span className="block text-xs tabular-nums text-muted">
                    {row.code} · {formatDate(row.diagnosed_date)} · {formatNumber(row.cases)} holat
                  </span>
                </span>
                <StatusBadge map={DISEASE_STATUS} status={row.status} label={row.status_display} />
              </button>
            </li>
          ))}
        </Section>
      </div>

      <Card>
        <CardHeader title="Murojaatlarim" description={openRequests > 0 ? `Ochiq: ${openRequests} ta` : undefined} />
        <div className="mt-3 border-t border-line">
          {data.requests.length === 0 ? (
            <EmptyState
              icon={MessageSquareHeart}
              title="Murojaat yuborilmagan"
              description="Parrandalarda kasallik belgisi bo‘lsa, rasm bilan veterinarga yozing."
              action={
                <Button size="sm" icon={<Send className="size-3.5" aria-hidden />} onClick={() => setCreating(true)}>
                  Murojaat yuborish
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {data.requests.map((row) => (
                <li key={row.id} className="flex flex-col gap-2 px-4 py-4 sm:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs tabular-nums text-muted">
                      {row.code} · {formatDateTime(row.created_at)}
                    </span>
                    <StatusBadge map={VET_REQUEST_STATUS} status={row.status} label={row.status_display} />
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-ink">{row.text}</p>
                  {row.files.length > 0 && <AttachmentList files={row.files} />}
                  {row.response && (
                    <div className="rounded-lg border border-accent/30 bg-accent-soft/50 px-3 py-2.5">
                      <p className="text-xs font-medium text-muted">Javob{row.vet ? ` · ${row.vet.full_name}` : ""}</p>
                      <p className="mt-0.5 whitespace-pre-wrap text-[13px] text-ink">{row.response}</p>
                    </div>
                  )}
                  {row.allowed_actions.includes("close") && (
                    <div>
                      <Button variant="ghost" size="sm" icon={<X className="size-3.5" aria-hidden />} onClick={() => withdraw(row)}>
                        Bekor qilish
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {creating && <RequestCreateModal onClose={() => setCreating(false)} />}
      {diseaseId !== null && <DiseaseDetailModal id={diseaseId} owner onClose={() => setDiseaseId(null)} />}
    </div>
  );
}

function Section({ title, icon: Icon, empty, count, children }: { title: string; icon: typeof Stethoscope; empty: string; count: number; children: ReactNode }) {
  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Icon className="size-4 text-muted" aria-hidden />
            {title}
          </span>
        }
        actions={count > 0 ? <Badge>{count}</Badge> : undefined}
      />
      <div className="mt-3 border-t border-line">{count === 0 ? <CardBody className="text-sm text-muted">{empty}</CardBody> : <ul className="divide-y divide-line">{children}</ul>}</div>
    </Card>
  );
}

function Row({ title, meta, aside }: { title: string; meta: string; aside: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{title}</span>
        <span className="block text-xs tabular-nums text-muted">{meta}</span>
      </span>
      <span className="text-sm">{aside}</span>
    </li>
  );
}

/** “Veterinarga murojaat” sheet: text 5–2000 + up to 5 photos (V3 §8.5). */
function RequestCreateModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const form = useForm({ text: "" });
  const onSubmit = form.handleSubmit(
    (values) =>
      collect([
        ["text", values.text.trim().length < 5 ? "Muammoni batafsilroq yozing (kamida 5 ta belgi)" : values.text.trim().length > 2000 ? "Ko‘pi bilan 2000 ta belgi" : undefined],
      ]),
    (values) => api.post<VetRequest>("/vet/requests", { text: values.text.trim(), file_ids: files.map((file) => file.id) }),
    (saved) => {
      toast.success(`${saved.code} yuborildi. Veterinar tez orada javob beradi.`);
      onClose();
    },
  );
  return (
    <Modal
      title="Veterinarga murojaat"
      description="Nima kuzatilayotganini yozing: belgilar, nechta parranda, qachondan beri."
      onClose={onClose}
      busy={form.pending}
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.pending}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={form.pending} disabled={uploading} icon={<Send className="size-4" aria-hidden />}>
            Yuborish
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Murojaat matni" required {...form.field("text")}>
          <Textarea {...form.control("text")} rows={5} maxLength={2000} autoFocus placeholder="Masalan: 3 kundan beri 10 ga yaqin tovuq yem yemayapti, yo‘tal bor" />
        </Field>
        <FileUpload
          purpose="VET_REQUEST"
          value={files}
          onChange={setFiles}
          onBusyChange={setUploading}
          max={5}
          label="Rasmlar (5 tagacha)"
          hint="JPG, PNG yoki WEBP · har biri 10 MB gacha"
          error={form.errors.file_ids}
        />
      </div>
      {form.formError && <Alert className="mt-4">{form.formError}</Alert>}
    </Modal>
  );
}

