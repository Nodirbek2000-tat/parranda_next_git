"use client";

import { useState, type ReactNode } from "react";
import { ArrowLeft, CircleCheckBig, History, Save } from "lucide-react";
import { api } from "@/lib/api";
import type { Blueprint, BlueprintKind, BuilderMeta } from "@/lib/builder-types";
import { formatDateTime } from "@/lib/format";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useBlueprintActions } from "./blueprint-actions";
import { KIND_LABELS, parseBlueprintErrors, STATUS_LABELS, STATUS_TONES, type BlueprintErrors } from "./shared";

const NO_ERRORS: BlueprintErrors = { general: [], byKey: {} };

export interface EditorContext {
  /** Server validation errors of the last save (`data.<key>` messages in `byKey`). */
  serverErrors: BlueprintErrors;
  /** A save was attempted: show "required" errors too, not only live format errors. */
  submitted: boolean;
  readOnly: boolean;
}

/** Initial `{name, description, data}` of an editor: the pending change when an active blueprint has one. */
export function editableSource(blueprint: Blueprint | null): { name: string; description: string; data: Record<string, unknown> | null } {
  if (!blueprint) return { name: "", description: "", data: null };
  if (blueprint.pending) {
    return { name: blueprint.pending.name, description: blueprint.pending.description ?? "", data: blueprint.pending.data };
  }
  return { name: blueprint.name, description: blueprint.description ?? "", data: blueprint.data };
}

/**
 * Common frame of every blueprint editor: header with status and lifecycle shortcuts, name + description,
 * the kind-specific body, comment and save (POST new / PATCH existing — an active blueprint parks the change
 * as `pending` until "O‘zgarishni tasdiqlash").
 */
export function EditorShell({
  kind,
  base,
  meta,
  data,
  clientErrors,
  onBack,
  onCreated,
  children,
}: {
  kind: BlueprintKind;
  /** Latest server state (refetched after every save); null for a new blueprint. */
  base: Blueprint | null;
  meta: BuilderMeta | undefined;
  /** Current `data` in API shape. */
  data: Record<string, unknown>;
  /** Client-side validation messages; saving is blocked while any exist. */
  clientErrors: readonly string[];
  onBack: () => void;
  onCreated: (id: number) => void;
  children: (context: EditorContext) => ReactNode;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const actions = useBlueprintActions(meta);
  const source = editableSource(base);
  const [name, setName] = useState(source.name);
  const [description, setDescription] = useState(source.description);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<BlueprintErrors>(NO_ERRORS);
  const snapshot = JSON.stringify({ name: name.trim(), description: description.trim(), data });
  const [baseline, setBaseline] = useState(snapshot);
  const dirty = snapshot !== baseline;
  const labels = KIND_LABELS[kind];
  const readOnly = base?.status === "archived";
  const isActive = base?.status === "active";

  const nameError = serverErrors.name ?? (submitted && !name.trim() ? "Nomini kiriting" : undefined);

  const save = async () => {
    setSubmitted(true);
    if (!name.trim() || clientErrors.length > 0) return;
    setSaving(true);
    setServerErrors(NO_ERRORS);
    const body = {
      name: name.trim(),
      description: description.trim(),
      data,
      ...(comment.trim() ? { comment: comment.trim() } : {}),
    };
    try {
      if (base) {
        const saved = await api.patch<Blueprint>(`/builder/blueprints/${base.id}`, body);
        setBaseline(snapshot);
        setComment("");
        setSubmitted(false);
        toast.success(
          saved.status === "active" || saved.pending
            ? "O‘zgarish saqlandi. U “O‘zgarishni tasdiqlash” bosilgandan keyin kuchga kiradi."
            : "Saqlandi",
        );
      } else {
        const created = await api.post<Blueprint>("/builder/blueprints", { kind, ...body });
        toast.success(`“${created.name}” qoralama sifatida yaratildi`);
        setBaseline(snapshot);
        onCreated(created.id);
      }
    } catch (caught) {
      setServerErrors(parseBlueprintErrors(caught));
    } finally {
      setSaving(false);
    }
  };

  const back = () => {
    if (!dirty || readOnly) {
      onBack();
      return;
    }
    void confirm({
      title: "Saqlanmagan o‘zgarishlar",
      message: <p>Kiritilgan o‘zgarishlar saqlanmagan. Ro‘yxatga qaytsangiz, ular yo‘qoladi.</p>,
      confirmLabel: "Saqlamasdan chiqish",
      tone: "danger",
      onConfirm: async () => onBack(),
    });
  };

  const unknownServerKeys = Object.entries(serverErrors.byKey);
  const canActivate = base && !dirty && (base.status === "draft" || base.status === "test" || (isActive && base.pending));

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <Card>
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-start gap-2">
            <Button variant="ghost" size="sm" className="-ml-2 px-2" onClick={back} aria-label="Ro‘yxatga qaytish">
              <ArrowLeft className="size-4" aria-hidden />
            </Button>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-ink">
                {base ? base.name : `Yangi ${labels.one.toLowerCase()}`}
                {base && <Badge tone={STATUS_TONES[base.status]}>{base.status_display || STATUS_LABELS[base.status]}</Badge>}
                {base?.pending && <Badge tone="warning">Tasdiq kutmoqda</Badge>}
              </p>
              <p className="text-[13px] text-muted">
                {base
                  ? `${labels.one} · versiya ${base.version} · yangilangan ${formatDateTime(base.updated_at)}`
                  : `${labels.one} qoralama sifatida saqlanadi`}
              </p>
            </div>
          </div>
          {base && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" icon={<History className="size-3.5" aria-hidden />} onClick={() => actions.versions(base)}>
                Versiyalar
              </Button>
              {canActivate && (
                <Button size="sm" icon={<CircleCheckBig className="size-3.5" aria-hidden />} onClick={() => actions.activate(base)}>
                  {isActive ? "O‘zgarishni tasdiqlash" : "Faollashtirish"}
                </Button>
              )}
            </div>
          )}
        </div>
        {(isActive || base?.status === "test" || readOnly) && (
          <div className="flex flex-col gap-2 border-t border-line px-4 py-3 sm:px-6">
            {isActive && !base?.pending && (
              <Alert tone="warning">
                Bu {labels.one.toLowerCase()} faol. Saqlangan o‘zgarishlar darhol emas, “O‘zgarishni tasdiqlash” bosilgandan
                keyin kuchga kiradi.
              </Alert>
            )}
            {isActive && base?.pending && (
              <Alert tone="warning">
                Tasdiq kutayotgan o‘zgarish tahrirlanmoqda
                {base.pending_by_name ? ` (${base.pending_by_name}${base.pending_at ? `, ${formatDateTime(base.pending_at)}` : ""})` : ""}.
                Faol versiya tasdiqlanmaguncha o‘zgarmaydi.
              </Alert>
            )}
            {base?.status === "test" && (
              <Alert tone="info">Sinov rejimi: faqat Super Admin ko‘radi va ishlata oladi; yaratilgan yozuvlar “sinov” belgili bo‘ladi.</Alert>
            )}
            {readOnly && <Alert tone="info">Arxivdagi yozuvni tahrirlab bo‘lmaydi. Avval uni tiklang.</Alert>}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Asosiy ma’lumotlar" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Nomi" htmlFor="bp-name" required error={nameError}>
            <Input
              id="bp-name"
              value={name}
              invalid={Boolean(nameError)}
              disabled={readOnly}
              onChange={(event) => setName(event.target.value)}
              autoComplete="off"
              maxLength={200}
            />
          </Field>
          <Field label="Tavsif" htmlFor="bp-description" error={serverErrors.description}>
            <Input
              id="bp-description"
              value={description}
              disabled={readOnly}
              onChange={(event) => setDescription(event.target.value)}
              autoComplete="off"
            />
          </Field>
        </CardBody>
      </Card>

      {children({ serverErrors, submitted, readOnly })}

      {!readOnly && (
        <Card>
          <CardBody className="flex flex-col gap-4">
            <Field
              label="O‘zgarish izohi"
              htmlFor="bp-comment"
              hint="Versiyalar tarixida ko‘rinadi (ixtiyoriy)"
            >
              <Input id="bp-comment" value={comment} onChange={(event) => setComment(event.target.value)} autoComplete="off" />
            </Field>
            {submitted && clientErrors.length > 0 && (
              <Alert>
                <p className="font-medium">Saqlashdan oldin xatolarni tuzating:</p>
                <ul className="mt-1 list-disc pl-5">
                  {clientErrors.slice(0, 8).map((message, index) => (
                    <li key={index}>{message}</li>
                  ))}
                  {clientErrors.length > 8 && <li>… yana {clientErrors.length - 8} ta</li>}
                </ul>
              </Alert>
            )}
            {(serverErrors.general.length > 0 || unknownServerKeys.length > 0) && (
              <Alert>
                {serverErrors.general.map((message, index) => (
                  <p key={`g${index}`}>{message}</p>
                ))}
                {unknownServerKeys.length > 0 && (
                  <ul className="mt-1 list-disc pl-5">
                    {unknownServerKeys.map(([key, message]) => (
                      <li key={key}>
                        <span className="font-mono">{key}</span>: {message}
                      </li>
                    ))}
                  </ul>
                )}
              </Alert>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              {dirty && <span className="text-[13px] text-muted sm:mr-auto">Saqlanmagan o‘zgarishlar bor</span>}
              <Button variant="secondary" onClick={back} disabled={saving}>
                Orqaga
              </Button>
              <Button icon={<Save className="size-4" aria-hidden />} loading={saving} onClick={save} disabled={base !== null && !dirty}>
                {isActive ? "O‘zgarishni saqlash" : "Saqlash"}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
      {actions.dialogs}
    </div>
  );
}
