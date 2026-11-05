"use client";

import { useState, type ReactNode } from "react";
import { History, RotateCcw } from "lucide-react";
import { api, toApiError } from "@/lib/api";
import type { Blueprint, BlueprintListItem, BuilderMeta, ConfigVersion } from "@/lib/builder-types";
import { formatDateTime } from "@/lib/format";
import { useAllPages, useApi } from "@/lib/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Field, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { describeChanges, type NameLookup, type Snapshot } from "./changes";
import { KIND_LABELS, STATUS_LABELS, STATUS_TONES } from "./shared";

/** Minimal shape the actions need (a list row or a full blueprint). */
export type BlueprintRef = Pick<BlueprintListItem, "id" | "kind" | "name" | "status" | "version" | "usage"> & {
  has_pending?: boolean;
  pending?: Blueprint["pending"];
};

export function hasPending(item: BlueprintRef): boolean {
  return Boolean(item.has_pending ?? item.pending);
}

/** id → name over every blueprint (task templates refer to forms / documents, processes to tasks). */
export function useNameLookup(enabled: boolean): NameLookup {
  const all = useAllPages<BlueprintListItem>(enabled ? "/builder/blueprints" : null);
  return (id) => {
    if (id === null || id === undefined) return "yo‘q";
    return all.data?.results.find((item) => item.id === id)?.name ?? `#${id}`;
  };
}

function snapshotOf(blueprint: Pick<Blueprint, "name" | "description" | "data">): Snapshot {
  return { name: blueprint.name, description: blueprint.description ?? "", data: blueprint.data ?? {} };
}

export function ChangeList({ lines }: { lines: readonly string[] }) {
  if (lines.length === 0) return <p className="text-[13px] text-muted">Farq yo‘q.</p>;
  return (
    <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] text-ink">
      {lines.map((line, index) => (
        <li key={index}>{line}</li>
      ))}
    </ul>
  );
}

/**
 * Lifecycle actions of a blueprint (API_CONTRACT_V4 §1.1), each behind a confirmation.
 * Lists refresh automatically after every mutation (dataRevision).
 */
export function useBlueprintActions(meta: BuilderMeta | undefined, onOpen?: (id: number) => void) {
  const confirm = useConfirm();
  const toast = useToast();
  const [activating, setActivating] = useState<BlueprintRef | null>(null);
  const [versions, setVersions] = useState<BlueprintRef | null>(null);

  const kindOne = (item: BlueprintRef) => KIND_LABELS[item.kind].one.toLowerCase();

  const test = (item: BlueprintRef) =>
    void confirm({
      title: "Sinovga o‘tkazish",
      confirmLabel: "Sinovga o‘tkazish",
      message: (
        <div className="flex flex-col gap-2">
          <p>
            <strong>{item.name}</strong> sinov rejimiga o‘tadi.
          </p>
          <p className="text-[13px] text-muted">
            Sinovdagi {kindOne(item)} faqat Super Admin uchun ko‘rinadi. Undan yaratilgan vazifa va topshiruvlar “sinov”
            belgisini oladi, dalolatnoma va statistikaga kirmaydi.
          </p>
        </div>
      ),
      onConfirm: async () => {
        await api.post(`/builder/blueprints/${item.id}/test`);
        toast.success("Sinov rejimiga o‘tkazildi");
      },
    });

  const discard = (item: BlueprintRef) =>
    void confirm({
      title: "O‘zgarishni bekor qilish",
      confirmLabel: "Bekor qilish",
      tone: "danger",
      message: (
        <p>
          <strong>{item.name}</strong> uchun tasdiq kutayotgan o‘zgarish o‘chiriladi. Faol versiya o‘zgarmaydi.
        </p>
      ),
      onConfirm: async () => {
        await api.post(`/builder/blueprints/${item.id}/discard-pending`);
        toast.success("O‘zgarish bekor qilindi");
      },
    });

  const archive = (item: BlueprintRef) =>
    void confirm({
      title: "Arxivlash",
      confirmLabel: "Arxivlash",
      tone: "danger",
      message: (
        <div className="flex flex-col gap-2">
          <p>
            <strong>{item.name}</strong> arxivga o‘tkaziladi va yangi ishlarda tanlab bo‘lmaydi. Eski ma’lumotlar
            saqlanib qoladi.
          </p>
          {item.usage.referenced_by.length > 0 && (
            <Alert tone="warning">
              Bunga bog‘liq: {item.usage.referenced_by.map((ref) => `${KIND_LABELS[ref.kind]?.one ?? ref.kind} “${ref.name}”`).join(", ")}.
              Avval ularni arxivlang yoki o‘zgartiring.
            </Alert>
          )}
          {item.usage.users > 0 && (
            <Alert tone="warning">Bu profil {item.usage.users} foydalanuvchiga biriktirilgan.</Alert>
          )}
        </div>
      ),
      onConfirm: async () => {
        await api.post(`/builder/blueprints/${item.id}/archive`);
        toast.success("Arxivlandi");
      },
    });

  const restore = (item: BlueprintRef) =>
    void confirm({
      title: "Arxivdan tiklash",
      confirmLabel: "Tiklash",
      message: (
        <p>
          <strong>{item.name}</strong> qoralama sifatida tiklanadi. Ishlatish uchun uni qayta faollashtiring.
        </p>
      ),
      onConfirm: async () => {
        await api.post(`/builder/blueprints/${item.id}/restore`);
        toast.success("Tiklandi (qoralama)");
      },
    });

  const duplicate = (item: BlueprintRef) =>
    void confirm({
      title: "Nusxa olish",
      confirmLabel: "Nusxa olish",
      message: (
        <p>
          <strong>{item.name}</strong> nusxasi qoralama sifatida yaratiladi.
        </p>
      ),
      onConfirm: async () => {
        const copy = await api.post<Blueprint>(`/builder/blueprints/${item.id}/duplicate`);
        toast.success(`“${copy.name}” yaratildi`);
        onOpen?.(copy.id);
      },
    });

  const remove = (item: BlueprintRef) =>
    void confirm({
      title: "O‘chirish",
      confirmLabel: "O‘chirish",
      tone: "danger",
      message: (
        <p>
          <strong>{item.name}</strong> qoralamasi butunlay o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.
        </p>
      ),
      onConfirm: async () => {
        await api.delete(`/builder/blueprints/${item.id}`);
        toast.success("O‘chirildi");
      },
    });

  const dialogs: ReactNode = (
    <>
      {activating && <ActivateModal item={activating} meta={meta} onClose={() => setActivating(null)} />}
      {versions && <VersionsModal item={versions} meta={meta} onClose={() => setVersions(null)} />}
    </>
  );

  return {
    test,
    activate: (item: BlueprintRef) => setActivating(item),
    discard,
    archive,
    restore,
    duplicate,
    remove,
    versions: (item: BlueprintRef) => setVersions(item),
    dialogs,
  };
}

/** "Faollashtirish" (draft/test) or "O‘zgarishni tasdiqlash" (active with pending) with a readable diff. */
function ActivateModal({ item, meta, onClose }: { item: BlueprintRef; meta: BuilderMeta | undefined; onClose: () => void }) {
  const toast = useToast();
  const detail = useApi<Blueprint>(`/builder/blueprints/${item.id}`);
  const names = useNameLookup(item.kind === "task" || item.kind === "process");
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blueprint = detail.data;
  const isPendingConfirm = item.status === "active";

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      await api.post(`/builder/blueprints/${item.id}/activate`, comment.trim() ? { comment: comment.trim() } : {});
      toast.success(isPendingConfirm ? "O‘zgarish tasdiqlandi va kuchga kirdi" : "Faollashtirildi");
      onClose();
    } catch (caught) {
      setPending(false);
      setError(toApiError(caught).message);
    }
  };

  const lines =
    blueprint?.pending ? describeChanges(item.kind, snapshotOf(blueprint), snapshotOf(blueprint.pending), meta, names) : [];

  return (
    <Modal
      title={isPendingConfirm ? "O‘zgarishni tasdiqlash" : "Faollashtirish"}
      description={item.name}
      onClose={onClose}
      busy={pending}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Bekor qilish
          </Button>
          <Button loading={pending} onClick={submit} disabled={!blueprint || (isPendingConfirm && !blueprint.pending)}>
            {isPendingConfirm ? "Tasdiqlash" : "Faollashtirish"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-sm">
        {!blueprint && detail.error ? (
          <ErrorState error={detail.error} onRetry={detail.reload} />
        ) : !blueprint ? (
          <TableSkeleton rows={3} />
        ) : isPendingConfirm ? (
          blueprint.pending ? (
            <>
              <p>
                Tasdiqlangandan so‘ng o‘zgarish darhol kuchga kiradi (versiya {blueprint.version} → {blueprint.version + 1}).
                Avval yaratilgan vazifa va topshiruvlar eski ta’rif bo‘yicha qoladi.
              </p>
              <div className="rounded-lg border border-line bg-subtle px-3 py-3">
                <p className="mb-2 text-[13px] font-medium text-ink">
                  Nima o‘zgargan
                  {blueprint.pending_by_name && (
                    <span className="font-normal text-muted">
                      {" "}
                      · {blueprint.pending_by_name}
                      {blueprint.pending_at ? `, ${formatDateTime(blueprint.pending_at)}` : ""}
                    </span>
                  )}
                </p>
                <ChangeList lines={lines} />
                {blueprint.pending.comment && <p className="mt-2 text-[13px] text-muted">Izoh: {blueprint.pending.comment}</p>}
              </div>
            </>
          ) : (
            <Alert tone="info">Tasdiq kutayotgan o‘zgarish yo‘q.</Alert>
          )
        ) : (
          <>
            <p>
              <strong>{blueprint.name}</strong> faollashtiriladi va barcha tegishli foydalanuvchilar uchun ishlay boshlaydi.
            </p>
            {item.status === "test" && (
              <p className="text-[13px] text-muted">Sinov paytida yaratilgan ma’lumotlar “sinov” belgisi bilan qoladi.</p>
            )}
          </>
        )}
        {blueprint && (!isPendingConfirm || blueprint.pending) && (
          <Field label="Izoh (ixtiyoriy)" htmlFor="activate-comment">
            <Textarea
              id="activate-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Masalan: yangi maydon qo‘shildi"
              rows={2}
            />
          </Field>
        )}
        {error && <Alert>{error}</Alert>}
      </div>
    </Modal>
  );
}

/** History of a blueprint (newest first) with "Shu versiyaga qaytarish". */
function VersionsModal({ item, meta, onClose }: { item: BlueprintRef; meta: BuilderMeta | undefined; onClose: () => void }) {
  const confirm = useConfirm();
  const toast = useToast();
  const versions = useApi<ConfigVersion[]>(`/builder/blueprints/${item.id}/versions`);
  const detail = useApi<Blueprint>(`/builder/blueprints/${item.id}`);
  const names = useNameLookup(item.kind === "task" || item.kind === "process");
  const current = detail.data;

  const revert = (version: ConfigVersion) =>
    void confirm({
      title: "Shu versiyaga qaytarish",
      confirmLabel: "Qaytarish",
      message: (
        <div className="flex flex-col gap-2">
          <p>
            <strong>{version.name}</strong> — {version.version}-versiya ma’lumotlari qayta qo‘llanadi.
          </p>
          <p className="text-[13px] text-muted">
            {item.status === "active"
              ? "Faol bo‘lgani uchun o‘zgarish tasdiq kutadi: “O‘zgarishni tasdiqlash” bosilgandan keyin kuchga kiradi."
              : "O‘zgarish darhol saqlanadi (yangi versiya yoziladi)."}
          </p>
        </div>
      ),
      onConfirm: async () => {
        await api.post(`/builder/blueprints/${item.id}/revert`, { version: version.version });
        toast.success(item.status === "active" ? "Qaytarish tasdiq kutmoqda" : "Versiya qaytarildi");
        onClose();
      },
    });

  const list = versions.data;

  return (
    <Modal
      title="Versiyalar tarixi"
      description={`${item.name} · hozirgi versiya ${current?.version ?? item.version}`}
      onClose={onClose}
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Yopish
        </Button>
      }
    >
      {!list && versions.error ? (
        <ErrorState error={versions.error} onRetry={versions.reload} />
      ) : !list ? (
        <TableSkeleton rows={4} />
      ) : list.length === 0 ? (
        <EmptyState icon={History} title="Tarix bo‘sh" />
      ) : (
        <ol className="flex flex-col gap-3">
          {list.map((version) => {
            const isCurrent = current ? version.version === current.version : version.version === item.version;
            const lines = current
              ? describeChanges(item.kind, snapshotOf(current), { name: version.name, description: current.description, data: version.data }, meta, names)
              : [];
            const status = version.status as keyof typeof STATUS_LABELS;
            return (
              <li key={version.id} className="rounded-lg border border-line px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                      {version.version}-versiya · {version.name}
                      {STATUS_LABELS[status] && <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>}
                      {isCurrent && <Badge tone="success">Hozirgi</Badge>}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatDateTime(version.created_at)}
                      {version.created_by_name ? ` · ${version.created_by_name}` : ""}
                    </p>
                    {version.comment && <p className="mt-1 text-[13px] text-ink">{version.comment}</p>}
                  </div>
                  {!isCurrent && item.status !== "archived" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<RotateCcw className="size-3.5" aria-hidden />}
                      onClick={() => revert(version)}
                    >
                      Shu versiyaga qaytarish
                    </Button>
                  )}
                </div>
                {!isCurrent && current && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[13px] text-muted hover:text-ink">Hozirgidan farqi</summary>
                    <div className="mt-2">
                      <ChangeList lines={lines} />
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Modal>
  );
}
