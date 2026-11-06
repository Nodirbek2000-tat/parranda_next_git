"use client";

import { useState } from "react";
import { Check, Circle, FileDown, MapPin, Phone, Play, ShieldCheck, Undo2, UserPlus, XCircle } from "lucide-react";
import { api, apiDownload, errorMessage } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { fmtDateTime, fmtMoney, personName } from "@/lib/format";
import { effectiveRole, isAdmin, roleLabel } from "@/lib/roles";
import { dataLabel, resolveStageDef, stageDef, STAGES } from "@/lib/stages";
import type { CaseDetail, CaseStage, Me, Photo, CaseDocument, StageEvent } from "@/lib/types";
import { CaseStatusBadge, DeadlineText, StageStatusBadge } from "./case-card";
import { useConfirm } from "./confirm";
import { AuthImage, DocumentLink } from "./media";
import { Modal } from "./modal";
import { StageForm } from "./stage-form";
import { TempPassword } from "./temp-password";
import { useToast } from "./toast";
import { Alert, Button, Card } from "./ui";

const ACTION_LABELS: Record<string, string> = {
  create: "Yaratildi",
  submit: "Topshirildi",
  approve: "Tasdiqlandi",
  return: "Qaytarildi",
  reject: "Rad etildi",
};

function stageNumberOf(item: { stage?: number; stage_number?: number }): number | undefined {
  return item.stage_number ?? item.stage;
}

/** Stages sorted 1..10; missing ones are filled from the local chain for display. */
function allStages(detail: CaseDetail): CaseStage[] {
  const byNumber = new Map(detail.stages?.map((s) => [s.number, s]));
  return STAGES.map(
    (def) => byNumber.get(def.number) ?? { number: def.number, key: def.key, title: def.title, status: "WAITING" as const },
  );
}

type Can = { submit: boolean; approve: boolean; return: boolean; reject: boolean };

/** `can` from the API; if it is missing, a best-effort guess from the role (the server still decides). */
function permissions(detail: CaseDetail, stage: CaseStage | undefined, user: Me): Can {
  if (detail.can) {
    return { submit: !!detail.can.submit, approve: !!detail.can.approve, return: !!detail.can.return, reject: !!detail.can.reject };
  }
  const none = { submit: false, approve: false, return: false, reject: false };
  if (!stage || detail.status !== "IN_PROGRESS") return none;
  const def = stageDef(stage.number);
  const role = effectiveRole(user);
  const admin = role === "ADMIN" || role === "SUPERADMIN";
  const executor = def?.executor === role || (stage.number === 9 && admin);
  const approver = def?.approver === role || role === "SUPERADMIN" || (def?.approver === "ADMIN" && admin);
  const open = stage.status === "ACTIVE" || stage.status === "RETURNED";
  return {
    submit: open && executor,
    approve: stage.status === "SUBMITTED" && approver,
    return: (stage.status === "SUBMITTED" && approver) || (stage.status === "ACTIVE" && executor && !def?.approver && stage.number > 1),
    reject: admin || (stage.number === 3 && role === "DIRECTOR" && stage.status === "ACTIVE"),
  };
}

export function CaseView({ detail, readOnly = false }: { detail: CaseDetail; readOnly?: boolean }) {
  const user = useMe();
  const toast = useToast();
  const confirm = useConfirm();
  const [ownerAccount, setOwnerAccount] = useState<{ username: string; temp_password: string | null } | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const stages = allStages(detail);
  const current = detail.status === "IN_PROGRESS" ? stages.find((s) => s.number === detail.current_stage) : undefined;
  const can = permissions(detail, current, user);
  const currentDef = current ? resolveStageDef(current) : undefined;

  const photosFor = (stage: CaseStage): Photo[] => stage.photos ?? (detail.photos ?? []).filter((p) => stageNumberOf(p) === stage.number);
  const docsFor = (stage: CaseStage): CaseDocument[] =>
    stage.documents ?? (detail.documents ?? []).filter((d) => stageNumberOf(d) === stage.number);
  const eventsFor = (stage: CaseStage): StageEvent[] =>
    stage.events ?? (detail.events ?? []).filter((e) => stageNumberOf(e) === stage.number);

  const pkg = detail.package && typeof detail.package === "object" ? detail.package : null;
  const place = [detail.region, detail.district, detail.mfy, detail.address].filter(Boolean).join(", ");

  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      await apiDownload(`/cases/${detail.id}/pdf`, `${detail.code}-dalolatnoma.pdf`);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setPdfBusy(false);
    }
  };

  const approve = () =>
    current &&
    confirm({
      title: "Tasdiqlash",
      message: `«${current.title || currentDef?.title}» bosqichini tasdiqlaysizmi? Keyingi bosqich ochiladi.`,
      confirmLabel: "Tasdiqlash",
      onConfirm: async () => {
        await api.post(`/cases/${detail.id}/stages/${current.number}/approve`, {});
        toast.success("Bosqich tasdiqlandi");
      },
    });

  const sendBack = () =>
    current &&
    confirm({
      title: "Qaytarish",
      message:
        current.status === "SUBMITTED"
          ? "Bosqich ijrochiga qayta ishlash uchun qaytariladi."
          : "Oldingi bosqich ijrochisiga qayta ishlash uchun qaytariladi.",
      confirmLabel: "Qaytarish",
      tone: "danger",
      reason: { label: "Qaytarish sababi", placeholder: "Nimani tuzatish kerak?" },
      onConfirm: async (reason) => {
        await api.post(`/cases/${detail.id}/stages/${current.number}/return`, { reason });
        toast.success("Qaytarildi");
      },
    });

  const reject = () =>
    confirm({
      title: "Rad etish",
      message: `${detail.code} xonadon arizasi butunlay rad etiladi. Bu amalni qaytarib bo‘lmaydi.`,
      confirmLabel: "Rad etish",
      tone: "danger",
      reason: { label: "Rad etish sababi" },
      onConfirm: async (reason) => {
        await api.post(`/cases/${detail.id}/reject`, { reason });
        toast.success("Ariza rad etildi");
      },
    });

  const createOwner = () =>
    confirm({
      title: "Xonadon egasi akkaunti",
      message: `${detail.owner_full_name || "Xonadon egasi"} uchun akkaunt yaratiladi (yoki bog‘lanadi) va vaqtinchalik parol beriladi.`,
      confirmLabel: "Yaratish",
      onConfirm: async () => {
        const result = await api.post<{ username: string; temp_password: string | null }>(`/cases/${detail.id}/owner-account`, {});
        setOwnerAccount(result);
      },
    });

  const showActions = !readOnly || can.submit;

  return (
    <div className="flex flex-col gap-4">
      {/* header */}
      <div className="rounded-2xl border border-primary bg-primary p-4 text-white shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold tracking-wide text-white/80">{detail.code}</span>
          <CaseStatusBadge status={detail.status} label={detail.status_display} />
        </div>
        <h1 className="mt-1 text-xl font-semibold">{detail.owner_full_name || detail.name || "—"}</h1>
        {detail.name && detail.owner_full_name && detail.name !== detail.owner_full_name && <p className="text-sm text-white/70">{detail.name}</p>}
        <div className="mt-2 flex flex-col gap-1 text-sm text-white/80">
          {place && (
            <span className="flex items-start gap-1.5">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
              {place}
              {detail.latitude && detail.longitude ? (
                <a href={`https://maps.google.com/?q=${detail.latitude},${detail.longitude}`} target="_blank" rel="noreferrer" className="ml-1 underline">
                  xarita
                </a>
              ) : null}
            </span>
          )}
          {detail.owner_phone && (
            <a href={`tel:${detail.owner_phone}`} className="flex items-center gap-1.5">
              <Phone className="size-4 shrink-0" aria-hidden />
              {detail.owner_phone}
            </a>
          )}
          <span>
            Paket: <b className="text-white">{pkg?.name || detail.package_name || "—"}</b>
            {pkg?.price ? ` · ${fmtMoney(pkg.price)}` : ""}
          </span>
          <span className="text-xs text-white/60">
            Yaratdi: {personName(detail.created_by)} · {fmtDateTime(detail.created_at)}
          </span>
        </div>
        {detail.status === "REJECTED" && detail.reject_reason && (
          <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-sm">
            <b>Rad etish sababi:</b> {detail.reject_reason}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" loading={pdfBusy} onClick={downloadPdf} icon={<FileDown className="size-4" aria-hidden />}>
            Dalolatnoma (PDF)
          </Button>
          {!readOnly && isAdmin(user) && detail.status !== "REJECTED" && (detail.can?.owner_account ?? true) && (
            <Button variant="secondary" size="sm" onClick={createOwner} icon={<UserPlus className="size-4" aria-hidden />}>
              {detail.owner_user ? "Egasi paroli" : "Egasi akkaunti"}
            </Button>
          )}
        </div>
      </div>

      {/* action panel */}
      {current && showActions && (can.submit || can.approve || can.return || (!readOnly && can.reject)) && (
        <Card className="border-accent/40">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">
              {current.number}. {current.title || currentDef?.title}
            </h2>
            <StageStatusBadge status={current.status} label={current.status_display} />
          </div>
          <DeadlineText due={current.due_at} overdue={current.is_overdue} className="mb-3" />
          {current.status === "RETURNED" && current.return_reason && (
            <Alert tone="warning" className="mb-3">
              <b>Qaytarilgan sabab:</b> {current.return_reason}
            </Alert>
          )}
          {can.submit && currentDef && <StageForm key={`${current.number}-${current.status}`} detail={detail} stage={current} def={currentDef} />}
          {can.approve && current.status === "SUBMITTED" && (
            <p className="mb-3 text-sm text-muted">Ijrochi bosqichni topshirdi. Ma’lumotlarni pastdagi tarixdan tekshirib, tasdiqlang yoki qaytaring.</p>
          )}
          {(can.approve || can.return || (!readOnly && can.reject)) && (
            <div className={cn("flex flex-wrap gap-2", can.submit && "mt-4 border-t border-line pt-4")}>
              {can.approve && (
                <Button onClick={approve} icon={<ShieldCheck className="size-4" aria-hidden />}>
                  Tasdiqlash
                </Button>
              )}
              {can.return && (
                <Button variant="secondary" onClick={sendBack} icon={<Undo2 className="size-4" aria-hidden />}>
                  Qaytarish
                </Button>
              )}
              {!readOnly && can.reject && (
                <Button variant="danger" onClick={reject} icon={<XCircle className="size-4" aria-hidden />}>
                  Rad etish
                </Button>
              )}
            </div>
          )}
        </Card>
      )}

      {/* timeline */}
      <Card>
        <h2 className="mb-3 text-base font-semibold">Bosqichlar</h2>
        <ol className="relative">
          {stages.map((stage, index) => (
            <TimelineItem
              key={stage.number}
              stage={stage}
              isCurrent={stage.number === current?.number}
              last={index === stages.length - 1}
              photos={photosFor(stage)}
              docs={docsFor(stage)}
              events={eventsFor(stage)}
              conclusion={stage.number === 1 ? detail.conclusion : undefined}
            />
          ))}
        </ol>
      </Card>

      {ownerAccount && (
        <Modal title="Xonadon egasi akkaunti" onClose={() => setOwnerAccount(null)} footer={<Button onClick={() => setOwnerAccount(null)}>Yopish</Button>}>
          {ownerAccount.temp_password ? (
            <TempPassword username={ownerAccount.username} password={ownerAccount.temp_password} />
          ) : (
            <Alert tone="info">Akkaunt bog‘landi: {ownerAccount.username}</Alert>
          )}
        </Modal>
      )}
    </div>
  );
}

function TimelineItem({
  stage,
  isCurrent,
  last,
  photos,
  docs,
  events,
  conclusion,
}: {
  stage: CaseStage;
  isCurrent: boolean;
  last: boolean;
  photos: Photo[];
  docs: CaseDocument[];
  events: StageEvent[];
  conclusion?: string;
}) {
  const def = stageDef(stage.number);
  const done = stage.status === "DONE";
  const waiting = stage.status === "WAITING";
  const data = Object.entries(stage.data ?? {}).filter(([key]) => !(key === "conclusion" && conclusion));
  const active = stage.status === "ACTIVE" || stage.status === "RETURNED" || stage.status === "SUBMITTED";

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!last && <span aria-hidden className={cn("absolute left-[15px] top-8 bottom-0 w-0.5", done ? "bg-accent" : "bg-line")} />}
      <span
        className={cn(
          "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2",
          done && "border-accent bg-accent text-white",
          isCurrent && !done && (stage.status === "RETURNED" ? "border-danger bg-danger-soft text-danger" : "border-primary bg-primary text-white"),
          waiting && "border-line-strong bg-surface text-line-strong",
          !done && !isCurrent && !waiting && "border-warning bg-warning-soft text-warning-ink",
        )}
        aria-hidden
      >
        {done ? <Check className="size-4" /> : isCurrent ? <Play className="size-3.5 fill-current" /> : <Circle className="size-3" />}
      </span>
      <div className={cn("min-w-0 flex-1 pt-0.5", waiting && "opacity-60")}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-semibold">
            {stage.number}. {stage.title || def?.title}
          </p>
          {!waiting && <StageStatusBadge status={stage.status} label={stage.status_display} />}
        </div>
        <p className="text-xs text-muted">
          {roleLabel(stage.executor_role ?? def?.executor)}
          {(stage.approver_role ?? def?.approver) ? ` → tasdiq: ${roleLabel(stage.approver_role ?? def?.approver)}` : ""}
        </p>
        {active && <DeadlineText due={stage.due_at} overdue={stage.is_overdue} className="mt-1" />}
        {stage.return_reason && stage.status === "RETURNED" && (
          <p className="mt-1.5 rounded-lg bg-danger-soft px-2.5 py-1.5 text-[13px] text-danger">Qaytarilgan: {stage.return_reason}</p>
        )}

        {(conclusion || data.length > 0 || stage.note) && (
          <dl className="mt-2 grid gap-1 rounded-xl bg-subtle p-2.5 text-[13px]">
            {conclusion && (
              <div>
                <dt className="inline text-muted">Xulosa: </dt>
                <dd className="inline whitespace-pre-line">{conclusion}</dd>
              </div>
            )}
            {data.map(([key, value]) => {
              const row = dataLabel(stage.number, key, value);
              return (
                <div key={key}>
                  <dt className="inline text-muted">{row.label}: </dt>
                  <dd className="inline whitespace-pre-line font-medium">{row.value}</dd>
                </div>
              );
            })}
            {stage.note && (
              <div>
                <dt className="inline text-muted">Izoh: </dt>
                <dd className="inline whitespace-pre-line">{stage.note}</dd>
              </div>
            )}
          </dl>
        )}

        {photos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {photos.map((photo) => (
              <AuthImage key={photo.id} photo={photo} className="size-16" />
            ))}
          </div>
        )}
        {docs.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {docs.map((doc) => (
              <DocumentLink key={doc.id} doc={doc} />
            ))}
          </div>
        )}

        {(stage.submitted_at || stage.decided_at) && (
          <p className="mt-1.5 text-xs text-muted">
            {stage.submitted_at && (
              <>
                Bajardi: {personName(stage.submitted_by, stage.submitted_by_name)}, {fmtDateTime(stage.submitted_at)}
              </>
            )}
            {stage.decided_at && (
              <>
                {stage.submitted_at ? " · " : ""}
                Tasdiqladi: {personName(stage.decided_by, stage.decided_by_name)}, {fmtDateTime(stage.decided_at)}
              </>
            )}
          </p>
        )}

        {events.length > 0 && (
          <details className="mt-1.5 text-xs">
            <summary className="cursor-pointer text-accent">Tarix ({events.length})</summary>
            <ul className="mt-1 flex flex-col gap-1 border-l-2 border-line pl-2.5">
              {events.map((event, index) => (
                <li key={event.id ?? index} className="text-muted">
                  <span className="text-ink">{event.action_display || ACTION_LABELS[event.action] || event.action}</span> —{" "}
                  {personName(event.actor, event.actor_name)}, {fmtDateTime(event.created_at)}
                  {event.note ? <span className="block text-ink">«{event.note}»</span> : null}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </li>
  );
}
