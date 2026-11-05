"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, MapPin, PackageCheck, PencilLine, Truck, UserCheck, Users, XCircle } from "lucide-react";
import { api, toApiError, type FieldErrors } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { formatNumber, todayIso } from "@/lib/format";
import { useAllPages } from "@/lib/use-api";
import { useCompanySettings } from "@/lib/use-settings";
import type { Attachment, Driver, LogisticsTask, TaskAction, User, Vehicle } from "@/lib/types";
import { FileUpload } from "@/components/files/file-upload";
import { SignaturePad } from "@/components/files/signature-pad";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Summary } from "@/components/ui/summary";
import { useToast } from "@/components/ui/toast";
import { itemsSummary, totalKgText } from "./shared";

type ModalKind = "assign" | "deliver" | "confirm" | "cancel" | "edit";

const PRIMARY_ORDER: readonly TaskAction[] = ["accept", "start", "deliver", "confirm", "assign", "edit", "cancel"];

/** Buttons for the task's `allowed_actions` only (V3 §15.3); irreversible ones ask first. */
export function TaskActions({ task, className }: { task: LogisticsTask; className?: string }) {
  const user = useCurrentUser();
  const confirm = useConfirm();
  const toast = useToast();
  const [modal, setModal] = useState<ModalKind | null>(null);
  const actions = PRIMARY_ORDER.filter((action) => task.allowed_actions.includes(action));
  if (actions.length === 0) return null;

  const post = (action: string, body: object = {}) => api.post<LogisticsTask>(`/logistics/tasks/${task.id}/${action}`, body);

  const accept = () =>
    void confirm({
      title: "Topshiriqni qabul qilish",
      confirmLabel: "Qabul qilish",
      message: (
        <p>
          <strong>{task.code}</strong> ({task.household.name}) ishga olinadi. Shundan so‘ng yukni ortib, “Yo‘lga chiqdim”ni
          bosing.
        </p>
      ),
      onConfirm: async () => {
        await post("accept");
        toast.success(`${task.code} qabul qilindi`);
      },
    });

  const start = () =>
    void confirm({
      title: "Yo‘lga chiqish",
      confirmLabel: "Yo‘lga chiqdim",
      message: <StartMessage task={task} />,
      onConfirm: async () => {
        const position = await currentPosition();
        await post("start", position ?? {});
        toast.success(`${task.code}: yetkazib berish boshlandi`);
      },
    });

  const handlers: Record<TaskAction, () => void> = {
    accept,
    start,
    assign: () => setModal("assign"),
    deliver: () => setModal("deliver"),
    confirm: () => setModal("confirm"),
    cancel: () => setModal("cancel"),
    edit: () => setModal("edit"),
  };
  const isOwner = user.role === "OWNER";
  const labels: Record<TaskAction, { label: string; icon: ReactNode; variant: "primary" | "secondary" | "danger" | "accent" }> = {
    accept: { label: "Qabul qilish", icon: <UserCheck className="size-4" aria-hidden />, variant: "primary" },
    start: { label: "Yo‘lga chiqdim", icon: <Truck className="size-4" aria-hidden />, variant: "primary" },
    deliver: { label: "Yetkazildi", icon: <PackageCheck className="size-4" aria-hidden />, variant: "primary" },
    confirm: {
      label: isOwner ? "Qabul qildim" : "Egasi nomidan tasdiqlash",
      icon: <CheckCircle2 className="size-4" aria-hidden />,
      variant: isOwner ? "primary" : "secondary",
    },
    assign: {
      label: task.vehicle ? "Qayta biriktirish" : "Biriktirish",
      icon: <Users className="size-4" aria-hidden />,
      variant: task.status === "NEW" ? "primary" : "secondary",
    },
    edit: { label: "Tahrirlash", icon: <PencilLine className="size-4" aria-hidden />, variant: "secondary" },
    cancel: { label: "Bekor qilish", icon: <XCircle className="size-4" aria-hidden />, variant: "secondary" },
  };
  // Only one filled (primary) button: the first one in the order above.
  const firstPrimary = actions.find((action) => labels[action].variant === "primary");

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {actions.map((action) => {
        const meta = labels[action];
        const variant = meta.variant === "primary" && action !== firstPrimary ? "secondary" : meta.variant;
        return (
          <Button
            key={action}
            variant={variant}
            icon={meta.icon}
            onClick={handlers[action]}
            className={cn("flex-1 sm:flex-none", action === "cancel" && "text-danger")}
          >
            {meta.label}
          </Button>
        );
      })}
      {modal === "assign" && <AssignModal task={task} onClose={() => setModal(null)} />}
      {modal === "deliver" && <DeliverModal task={task} onClose={() => setModal(null)} />}
      {modal === "confirm" && <ConfirmReceiptModal task={task} onClose={() => setModal(null)} />}
      {modal === "cancel" && <CancelModal task={task} onClose={() => setModal(null)} />}
      {modal === "edit" && <EditModal task={task} onClose={() => setModal(null)} />}
    </div>
  );
}

function StartMessage({ task }: { task: LogisticsTask }) {
  return (
    <div className="flex flex-col gap-3">
      <p>
        Yuk ombordan chiqim qilinadi va xonadon egasiga xabar boradi. Bu amalni qaytarib bo‘lmaydi (faqat administrator
        topshiriqni bekor qilib, yukni omborga qaytarishi mumkin).
      </p>
      <Summary
        items={[
          ["Topshiriq", task.code],
          ["Yuk", itemsSummary(task, 5)],
          ...(totalKgText(task) ? ([["Jami", totalKgText(task)]] as const) : []),
        ]}
      />
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <MapPin className="size-3.5" aria-hidden />
        Ruxsat bersangiz, joriy joylashuvingiz tarixga yoziladi.
      </p>
    </div>
  );
}

/** Browser geolocation with a short timeout; `null` when denied or unavailable (never blocks the action). */
function currentPosition(): Promise<{ latitude: number; longitude: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: Math.round(position.coords.latitude * 1e6) / 1e6,
          longitude: Math.round(position.coords.longitude * 1e6) / 1e6,
        }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 },
    );
  });
}

/* ---------- shared modal form state ---------- */

function useActionForm() {
  const toast = useToast();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const run = (fields: readonly string[], action: () => Promise<unknown>, success: string, onDone: () => void) => {
    if (pending) return;
    setPending(true);
    setFormError(null);
    action()
      .then(() => {
        toast.success(success);
        onDone();
      })
      .catch((caught: unknown) => {
        const error = toApiError(caught);
        setPending(false);
        const known = Object.fromEntries(Object.entries(error.fields).filter(([key]) => fields.includes(key)));
        setErrors(known);
        const rest = Object.entries(error.fields)
          .filter(([key]) => !fields.includes(key))
          .map(([, message]) => message);
        const general = [error.detail, ...rest].filter(Boolean).join(" ");
        setFormError(general || (Object.keys(known).length === 0 ? error.message : null));
      });
  };
  return { errors, setErrors, formError, pending, run };
}

function Footer({ onClose, pending, label, danger }: { onClose: () => void; pending: boolean; label: string; danger?: boolean }) {
  return (
    <>
      <Button variant="secondary" onClick={onClose} disabled={pending}>
        Yopish
      </Button>
      <Button type="submit" variant={danger ? "danger" : "primary"} loading={pending}>
        {label}
      </Button>
    </>
  );
}

/* ---------- assign ---------- */

function AssignModal({ task, onClose }: { task: LogisticsTask; onClose: () => void }) {
  const user = useCurrentUser();
  const prefix = useId();
  const vehicles = useAllPages<Vehicle>("/logistics/vehicles", { is_active: true });
  const drivers = useAllPages<Driver>("/logistics/drivers", { is_active: true });
  const workers = useAllPages<User>(user.role === "ADMIN" ? "/users" : null, { role: "LOGISTICS", is_active: true });
  const [vehicle, setVehicle] = useState(task.vehicle ? String(task.vehicle.id) : "");
  const [driver, setDriver] = useState(task.driver ? String(task.driver.id) : "");
  const [responsible, setResponsible] = useState(task.responsible ? String(task.responsible.id) : "");
  const form = useActionForm();

  const chosenVehicle = vehicles.data?.results.find((item) => String(item.id) === vehicle);
  const overCapacity = chosenVehicle?.capacity_kg != null && task.total_kg > chosenVehicle.capacity_kg;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clientErrors: FieldErrors = {};
    if (!vehicle) clientErrors.vehicle = "Transportni tanlang";
    if (!driver) clientErrors.driver = "Haydovchini tanlang";
    form.setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;
    form.run(
      ["vehicle", "driver", "responsible"],
      () =>
        api.post(`/logistics/tasks/${task.id}/assign`, {
          vehicle: Number(vehicle),
          driver: Number(driver),
          responsible: responsible ? Number(responsible) : null,
        }),
      `${task.code}: transport va haydovchi biriktirildi`,
      onClose,
    );
  };

  return (
    <Modal
      title={task.vehicle ? "Qayta biriktirish" : "Transport va haydovchi biriktirish"}
      description={task.status === "ACCEPTED" ? "Qayta biriktirilsa, topshiriqni yana qabul qilish kerak bo‘ladi." : undefined}
      onClose={onClose}
      onSubmit={submit}
      busy={form.pending}
      footer={<Footer onClose={onClose} pending={form.pending} label="Biriktirish" />}
    >
      <div className="flex flex-col gap-4">
        <Field
          label="Transport"
          htmlFor={`${prefix}-vehicle`}
          error={form.errors.vehicle ?? (overCapacity ? `Yuk (${formatNumber(task.total_kg)} kg) sig‘imdan oshadi` : undefined)}
          hint={totalKgText(task) ? `Yuk: ${totalKgText(task)}` : undefined}
          required
        >
          <Select id={`${prefix}-vehicle`} value={vehicle} invalid={Boolean(form.errors.vehicle) || overCapacity} onChange={(e) => setVehicle(e.target.value)}>
            <option value="">{vehicles.data ? "Tanlang" : "Yuklanmoqda…"}</option>
            {(vehicles.data?.results ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.plate_number}
                {item.model ? `, ${item.model}` : ""}
                {item.capacity_kg ? ` · ${formatNumber(item.capacity_kg)} kg` : ""} · faol: {item.active_tasks}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Haydovchi" htmlFor={`${prefix}-driver`} error={form.errors.driver} required>
          <Select id={`${prefix}-driver`} value={driver} invalid={Boolean(form.errors.driver)} onChange={(e) => setDriver(e.target.value)}>
            <option value="">{drivers.data ? "Tanlang" : "Yuklanmoqda…"}</option>
            {(drivers.data?.results ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.full_name} · faol: {item.active_tasks}
                {item.user ? "" : " · Telegram yo‘q"}
              </option>
            ))}
          </Select>
        </Field>
        {user.role === "ADMIN" && (
          <Field
            label="Mas’ul logistika xodimi"
            htmlFor={`${prefix}-responsible`}
            error={form.errors.responsible}
            hint="Bo‘sh qolsa: haydovchiga bog‘langan xodim"
          >
            <Select id={`${prefix}-responsible`} value={responsible} onChange={(e) => setResponsible(e.target.value)}>
              <option value="">Avtomatik</option>
              {(workers.data?.results ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.first_name || item.last_name ? `${item.first_name} ${item.last_name}`.trim() : item.username}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {form.formError && <Alert>{form.formError}</Alert>}
      </div>
    </Modal>
  );
}

/* ---------- deliver ---------- */

function DeliverModal({ task, onClose }: { task: LogisticsTask; onClose: () => void }) {
  const prefix = useId();
  const settings = useCompanySettings();
  const proofRequired = settings?.delivery_proof_required ?? true;
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [recipient, setRecipient] = useState(task.delivery.contact_name);
  const [note, setNote] = useState("");
  const form = useActionForm();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (uploading) return;
    if (proofRequired && files.length === 0) {
      form.setErrors({ file_ids: "Yetkazib berish dalilini (foto yoki imzo) biriktiring." });
      return;
    }
    form.run(
      ["file_ids", "recipient_name", "note"],
      async () => {
        const position = await currentPosition();
        return api.post(`/logistics/tasks/${task.id}/deliver`, {
          file_ids: files.map((file) => file.id),
          recipient_name: recipient.trim(),
          note: note.trim(),
          ...(position ?? {}),
        });
      },
      `${task.code}: yetkazildi`,
      onClose,
    );
  };

  return (
    <Modal
      title="Yetkazib berishni yakunlash"
      description={`${task.code} · ${task.household.name}`}
      onClose={onClose}
      onSubmit={submit}
      busy={form.pending || uploading}
      footer={<Footer onClose={onClose} pending={form.pending || uploading} label="Yetkazildi" />}
    >
      <div className="flex flex-col gap-4">
        <FileUpload
          id={`${prefix}-files`}
          purpose="DELIVERY_PROOF"
          value={files}
          onChange={(next) => {
            setFiles(next);
            form.setErrors({});
          }}
          onBusyChange={setUploading}
          max={10}
          camera
          label={proofRequired ? "Dalil (foto yoki imzo) *" : "Dalil (foto yoki imzo)"}
          hint="JPG, PNG, WEBP yoki PDF, 10 MB gacha"
          error={form.errors.file_ids}
        />
        {files.length < 10 && (
          <SignaturePad
            purpose="DELIVERY_PROOF"
            disabled={form.pending}
            onSaved={(file) => {
              setFiles((current) => [...current, file]);
              form.setErrors({});
            }}
          />
        )}
        <Field label="Qabul qilgan shaxs" htmlFor={`${prefix}-recipient`} error={form.errors.recipient_name}>
          <Input id={`${prefix}-recipient`} maxLength={200} value={recipient} onChange={(e) => setRecipient(e.target.value)} />
        </Field>
        <Field label="Izoh" htmlFor={`${prefix}-note`} error={form.errors.note}>
          <Textarea id={`${prefix}-note`} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {form.formError && <Alert>{form.formError}</Alert>}
      </div>
    </Modal>
  );
}

/* ---------- confirm receipt (owner, or admin on the owner's behalf) ---------- */

export function ConfirmReceiptModal({
  task,
  onClose,
  initialProblem = false,
}: {
  task: Pick<LogisticsTask, "id" | "code" | "household">;
  onClose: () => void;
  initialProblem?: boolean;
}) {
  const user = useCurrentUser();
  const prefix = useId();
  const isAdmin = user.role === "ADMIN";
  const [ok, setOk] = useState(!initialProblem);
  const [issue, setIssue] = useState("");
  const form = useActionForm();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = issue.trim();
    if (!ok && text.length < 3) {
      form.setErrors({ issue_note: "Muammoni qisqacha yozing." });
      return;
    }
    if (isAdmin && text.length < 3) {
      form.setErrors({ issue_note: "Egasi nomidan tasdiqlash sababini yozing." });
      return;
    }
    form.run(
      ["issue_note", "received_ok"],
      () => api.post(`/logistics/tasks/${task.id}/confirm`, { received_ok: ok, issue_note: text }),
      ok ? `${task.code}: qabul qilindi` : `${task.code}: muammo bilan qabul qilindi`,
      onClose,
    );
  };

  return (
    <Modal
      title={isAdmin ? "Egasi nomidan tasdiqlash" : "Mahsulotni qabul qilish"}
      description={`${task.code} · ${task.household.name}`}
      onClose={onClose}
      onSubmit={submit}
      busy={form.pending}
      footer={<Footer onClose={onClose} pending={form.pending} label="Tasdiqlash" />}
    >
      <div className="flex flex-col gap-4">
        <div role="radiogroup" aria-label="Qabul holati" className="grid grid-cols-2 gap-2">
          {[
            { value: true, label: "Muammosiz qabul qilindi" },
            { value: false, label: "Muammo bor" },
          ].map((option) => (
            <button
              key={String(option.value)}
              type="button"
              role="radio"
              aria-checked={ok === option.value}
              onClick={() => setOk(option.value)}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                ok === option.value
                  ? option.value
                    ? "border-accent bg-accent-soft font-medium text-accent"
                    : "border-warning bg-warning-soft font-medium text-warning-ink"
                  : "border-line text-ink hover:border-line-strong",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <Field
          label={ok ? (isAdmin ? "Sabab (egasi nomidan)" : "Izoh") : "Muammo"}
          htmlFor={`${prefix}-issue`}
          error={form.errors.issue_note}
          required={!ok || isAdmin}
          hint={!ok ? "Masalan: 2 qop yirtilgan, miqdor kam" : undefined}
        >
          <Textarea id={`${prefix}-issue`} maxLength={1000} value={issue} invalid={Boolean(form.errors.issue_note)} onChange={(e) => setIssue(e.target.value)} />
        </Field>
        {form.formError && <Alert>{form.formError}</Alert>}
      </div>
    </Modal>
  );
}

/* ---------- cancel ---------- */

function CancelModal({ task, onClose }: { task: LogisticsTask; onClose: () => void }) {
  const prefix = useId();
  const [reason, setReason] = useState("");
  const form = useActionForm();
  const inTransit = task.status === "IN_TRANSIT";

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (reason.trim().length < 3) {
      form.setErrors({ reason: "Sababni yozing (kamida 3 ta belgi)." });
      return;
    }
    form.run(["reason"], () => api.post(`/logistics/tasks/${task.id}/cancel`, { reason: reason.trim() }), `${task.code} bekor qilindi`, onClose);
  };

  return (
    <Modal
      title="Topshiriqni bekor qilish"
      description={`${task.code} · ${task.household.name}`}
      onClose={onClose}
      onSubmit={submit}
      busy={form.pending}
      footer={<Footer onClose={onClose} pending={form.pending} label="Bekor qilish" danger />}
    >
      <div className="flex flex-col gap-4">
        <Alert tone="warning">
          {inTransit
            ? "Yuk yo‘lda: bekor qilinsa, mahsulotlar omborga kirim qilib qaytariladi."
            : "Zaxiralangan mahsulotlar bo‘shatiladi."}
          {task.order && ` ${task.order.code} buyurtmasi “Tasdiqlandi” holatiga qaytadi.`}
        </Alert>
        <Field label="Sabab" htmlFor={`${prefix}-reason`} error={form.errors.reason} required>
          <Textarea id={`${prefix}-reason`} maxLength={500} value={reason} invalid={Boolean(form.errors.reason)} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {form.formError && <Alert>{form.formError}</Alert>}
      </div>
    </Modal>
  );
}

/* ---------- edit (planned date / note) ---------- */

function EditModal({ task, onClose }: { task: LogisticsTask; onClose: () => void }) {
  const prefix = useId();
  const [plannedDate, setPlannedDate] = useState(task.planned_date ?? "");
  const [note, setNote] = useState(task.note);
  const form = useActionForm();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (plannedDate && plannedDate < todayIso() && plannedDate !== task.planned_date) {
      form.setErrors({ planned_date: "Sana o‘tgan kun bo‘lishi mumkin emas." });
      return;
    }
    const body: Record<string, string | null> = { note: note.trim() };
    if (plannedDate !== (task.planned_date ?? "")) body.planned_date = plannedDate || null;
    form.run(["planned_date", "note"], () => api.patch(`/logistics/tasks/${task.id}`, body), "Saqlandi", onClose);
  };

  return (
    <Modal
      title="Topshiriqni tahrirlash"
      description="Mahsulotlarni o‘zgartirish uchun topshiriqni bekor qilib, yangisini yarating."
      onClose={onClose}
      onSubmit={submit}
      busy={form.pending}
      footer={<Footer onClose={onClose} pending={form.pending} label="Saqlash" />}
    >
      <div className="flex flex-col gap-4">
        <Field label="Reja sanasi" htmlFor={`${prefix}-date`} error={form.errors.planned_date}>
          <Input id={`${prefix}-date`} type="date" min={todayIso()} value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} />
        </Field>
        <Field label="Izoh" htmlFor={`${prefix}-note`} error={form.errors.note}>
          <Textarea id={`${prefix}-note`} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {form.formError && <Alert>{form.formError}</Alert>}
      </div>
    </Modal>
  );
}
